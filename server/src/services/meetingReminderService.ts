import jwt from "jsonwebtoken";
import { Types, type HydratedDocument } from "mongoose";
import {
  Meeting,
  type MeetingDocument,
  type MeetingParticipantRole,
} from "../models/Meeting";
import type { UserDocument } from "../models/User";
import { sendEmail } from "./emailService";

const DAY_MS = 24 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const SEND_LOCK_MS = 10 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 60 * 1000;
const DEFAULT_TIME_ZONE = "Asia/Jerusalem";
const TOKEN_PURPOSE = "meeting_attendance_confirmation";
const PARTICIPANT_ROLES: MeetingParticipantRole[] = ["mentor", "mentee"];

type ReminderKind = "24h" | "3h";

type ReminderFields = {
  sent: "reminder24hSentAt" | "reminder3hSentAt";
  sending: "reminder24hSendingAt" | "reminder3hSendingAt";
  failed: "reminder24hFailedAt" | "reminder3hFailedAt";
};

type PopulatedUser = Pick<UserDocument, "_id" | "email" | "username">;

type PopulatedMeeting = Omit<HydratedDocument<MeetingDocument>, "mentorId" | "menteeId"> & {
  mentorId: Types.ObjectId | PopulatedUser;
  menteeId: Types.ObjectId | PopulatedUser;
};

type MeetingTokenSource = {
  _id: unknown;
  selectedTime?: Date;
};

type AttendanceConfirmationTokenPayload = jwt.JwtPayload & {
  purpose: typeof TOKEN_PURPOSE;
  meetingId: string;
  participantId: string;
  role: MeetingParticipantRole;
  selectedTime: string;
};

type ConfirmAttendanceResult =
  | {
      ok: true;
      alreadyConfirmed: boolean;
      meetingId: string;
      role: MeetingParticipantRole;
      selectedTime: Date;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

let workerStarted = false;
let workerRunning = false;

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

function getAppBaseUrl() {
  const configuredUrl = process.env.APP_BASE_URL || process.env.SERVER_PUBLIC_URL;
  const baseUrl = configuredUrl?.trim() || `http://localhost:${process.env.PORT || 5000}`;
  return baseUrl.replace(/\/+$/, "");
}

function getMeetingTimeZone() {
  return process.env.MEETING_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;
}

function getPollIntervalMs() {
  const configuredInterval = Number(process.env.MEETING_REMINDER_POLL_INTERVAL_MS);

  if (Number.isFinite(configuredInterval) && configuredInterval >= 10_000) {
    return configuredInterval;
  }

  return DEFAULT_POLL_INTERVAL_MS;
}

function reminderFields(kind: ReminderKind): ReminderFields {
  if (kind === "24h") {
    return {
      sent: "reminder24hSentAt",
      sending: "reminder24hSendingAt",
      failed: "reminder24hFailedAt",
    };
  }

  return {
    sent: "reminder3hSentAt",
    sending: "reminder3hSendingAt",
    failed: "reminder3hFailedAt",
  };
}

function isPopulatedUser(value: unknown): value is PopulatedUser {
  return Boolean(value && typeof value === "object" && "_id" in value && "email" in value);
}

function getParticipantUser(meeting: PopulatedMeeting, role: MeetingParticipantRole) {
  const participant = role === "mentor" ? meeting.mentorId : meeting.menteeId;
  return isPopulatedUser(participant) ? participant : null;
}

function getOtherParticipantUser(meeting: PopulatedMeeting, role: MeetingParticipantRole) {
  const participant = role === "mentor" ? meeting.menteeId : meeting.mentorId;
  return isPopulatedUser(participant) ? participant : null;
}

function getParticipantId(meeting: PopulatedMeeting, role: MeetingParticipantRole) {
  const participant = role === "mentor" ? meeting.mentorId : meeting.menteeId;
  return isPopulatedUser(participant) ? participant._id : participant;
}

function getParticipantIdField(role: MeetingParticipantRole) {
  return role === "mentor" ? "mentorId" : "menteeId";
}

function getAttendanceState(
  meeting: PopulatedMeeting | HydratedDocument<MeetingDocument>,
  role: MeetingParticipantRole
) {
  return meeting.attendanceConfirmation?.[role] ?? {};
}

function missingOrNull(path: string) {
  return [{ [path]: { $exists: false } }, { [path]: null }];
}

function formatErrorMessage(error: string) {
  return error.length > 500 ? `${error.slice(0, 497)}...` : error;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function formatDate(date: Date) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "full",
      timeZone: getMeetingTimeZone(),
    }).format(date);
  } catch (_error) {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "full" }).format(date);
  }
}

function formatTime(date: Date) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      timeStyle: "short",
      timeZone: getMeetingTimeZone(),
    }).format(date);
  } catch (_error) {
    return new Intl.DateTimeFormat("he-IL", { timeStyle: "short" }).format(date);
  }
}

function createAttendanceConfirmationToken(
  meeting: MeetingTokenSource,
  role: MeetingParticipantRole,
  participantId: unknown
) {
  if (!meeting.selectedTime) {
    throw new Error("Cannot create an attendance confirmation token without selectedTime");
  }

  return jwt.sign(
    {
      purpose: TOKEN_PURPOSE,
      meetingId: String(meeting._id),
      participantId: String(participantId),
      role,
      selectedTime: meeting.selectedTime.toISOString(),
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

function verifyAttendanceConfirmationToken(token: string): AttendanceConfirmationTokenPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (!payload || typeof payload === "string") {
      return null;
    }

    if (
      payload.purpose !== TOKEN_PURPOSE ||
      typeof payload.meetingId !== "string" ||
      typeof payload.participantId !== "string" ||
      !PARTICIPANT_ROLES.includes(payload.role as MeetingParticipantRole) ||
      typeof payload.selectedTime !== "string"
    ) {
      return null;
    }

    return payload as AttendanceConfirmationTokenPayload;
  } catch (_error) {
    return null;
  }
}

function createConfirmationUrl(
  meeting: MeetingTokenSource,
  role: MeetingParticipantRole,
  participantId: unknown
) {
  const token = createAttendanceConfirmationToken(meeting, role, participantId);
  return `${getAppBaseUrl()}/api/meetings/confirm-attendance/${encodeURIComponent(token)}`;
}

function buildReminderEmail(
  meeting: PopulatedMeeting,
  role: MeetingParticipantRole,
  kind: ReminderKind
) {
  const participant = getParticipantUser(meeting, role);
  const otherParticipant = getOtherParticipantUser(meeting, role);

  if (!participant || !meeting.selectedTime) {
    return null;
  }

  const otherName = otherParticipant?.username || "המשתתפת השנייה";
  const meetingDate = formatDate(meeting.selectedTime);
  const meetingTime = formatTime(meeting.selectedTime);
  const confirmationUrl = createConfirmationUrl(meeting, role, participant._id);
  const subject =
    kind === "3h"
      ? "תזכורת: אשרי הגעה לפגישת QueenB"
      : "אשרי הגעה לפגישת QueenB";

  const escapedDate = escapeHtml(meetingDate);
  const escapedTime = escapeHtml(meetingTime);
  const escapedOtherName = escapeHtml(otherName);
  const escapedConfirmationUrl = escapeHtml(confirmationUrl);

  return {
    to: participant.email,
    subject,
    text: [
      "נא אשרי הגעה לפגישת QueenB.",
      "",
      `תאריך הפגישה: ${meetingDate}`,
      `שעת הפגישה: ${meetingTime}`,
      `עם: ${otherName}`,
      "",
      `אישור הגעה: ${confirmationUrl}`,
    ].join("\n"),
    html: [
      "<div dir=\"rtl\" style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933; text-align: right;\">",
      "<h1 style=\"font-size: 20px; margin: 0 0 16px;\">אישור הגעה לפגישה</h1>",
      `<p>פגישת QueenB שלך נקבעה לתאריך <strong>${escapedDate}</strong> בשעה <strong>${escapedTime}</strong>.</p>`,
      `<p>הפגישה היא עם <strong>${escapedOtherName}</strong>.</p>`,
      "<p>אנא אשרי שתגיעי לפגישה.</p>",
      `<p><a href="${escapedConfirmationUrl}" style="display: inline-block; background: #146c94; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none;">אישור הגעה</a></p>`,
      "</div>",
    ].join(""),
  };
}

function isMeetingReminderEligible(
  meeting: PopulatedMeeting | HydratedDocument<MeetingDocument>,
  now: Date
) {
  return (
    meeting.status === "scheduled" &&
    meeting.selectedTime instanceof Date &&
    !Number.isNaN(meeting.selectedTime.getTime()) &&
    meeting.selectedTime.getTime() > now.getTime()
  );
}

function shouldSendReminder24h(meeting: PopulatedMeeting, role: MeetingParticipantRole, now: Date) {
  if (!meeting.selectedTime) {
    return false;
  }

  const state = getAttendanceState(meeting, role);
  const msUntilStart = meeting.selectedTime.getTime() - now.getTime();
  return msUntilStart <= DAY_MS && !state.confirmedAt && !state.reminder24hSentAt;
}

function shouldSendReminder3h(meeting: PopulatedMeeting, role: MeetingParticipantRole, now: Date) {
  if (!meeting.selectedTime) {
    return false;
  }

  const state = getAttendanceState(meeting, role);
  const threeHourDueAt = new Date(meeting.selectedTime.getTime() - THREE_HOURS_MS);
  const scheduledAt = meeting.scheduledAt ?? meeting.createdAt;
  const msUntilStart = meeting.selectedTime.getTime() - now.getTime();

  return (
    msUntilStart <= THREE_HOURS_MS &&
    Boolean(scheduledAt ? scheduledAt.getTime() < threeHourDueAt.getTime() : true) &&
    Boolean(state.reminder24hSentAt && state.reminder24hSentAt.getTime() < threeHourDueAt.getTime()) &&
    !state.confirmedAt &&
    !state.reminder3hSentAt
  );
}

async function loadMeetingWithParticipants(meetingId: unknown) {
  return (await Meeting.findById(meetingId)
    .populate("mentorId", "email username")
    .populate("menteeId", "email username")) as PopulatedMeeting | null;
}

async function claimReminderSend(
  meeting: PopulatedMeeting,
  role: MeetingParticipantRole,
  kind: ReminderKind,
  now: Date
) {
  if (!meeting.selectedTime) {
    return null;
  }

  const fields = reminderFields(kind);
  const sentPath = `attendanceConfirmation.${role}.${fields.sent}`;
  const sendingPath = `attendanceConfirmation.${role}.${fields.sending}`;
  const failedPath = `attendanceConfirmation.${role}.${fields.failed}`;
  const confirmedPath = `attendanceConfirmation.${role}.confirmedAt`;
  const staleLockCutoff = new Date(now.getTime() - SEND_LOCK_MS);
  const retryCutoff = new Date(now.getTime() - RETRY_DELAY_MS);
  const andFilters: Record<string, unknown>[] = [
    { $or: missingOrNull(sentPath) },
    {
      $or: [
        ...missingOrNull(sendingPath),
        { [sendingPath]: { $lte: staleLockCutoff } },
      ],
    },
    {
      $or: [
        ...missingOrNull(failedPath),
        { [failedPath]: { $lte: retryCutoff } },
      ],
    },
    { $or: missingOrNull(confirmedPath) },
  ];

  if (kind === "3h") {
    const reminder24hSentPath = `attendanceConfirmation.${role}.reminder24hSentAt`;
    const threeHourDueAt = new Date(meeting.selectedTime.getTime() - THREE_HOURS_MS);
    andFilters.push({ [reminder24hSentPath]: { $exists: true, $lt: threeHourDueAt } });
  }

  const claimedAt = new Date();
  const claimedMeeting = await Meeting.findOneAndUpdate(
    {
      _id: meeting._id,
      status: "scheduled",
      selectedTime: meeting.selectedTime,
      [getParticipantIdField(role)]: getParticipantId(meeting, role),
      $and: andFilters,
    },
    {
      $set: { [sendingPath]: claimedAt },
      $unset: { [`attendanceConfirmation.${role}.reminderError`]: "" },
    },
    { new: true }
  );

  return claimedMeeting ? claimedAt : null;
}

async function releaseReminderClaim(
  meetingId: unknown,
  role: MeetingParticipantRole,
  kind: ReminderKind,
  claimedAt: Date
) {
  const fields = reminderFields(kind);
  const sendingPath = `attendanceConfirmation.${role}.${fields.sending}`;

  await Meeting.updateOne(
    { _id: meetingId, [sendingPath]: claimedAt },
    { $unset: { [sendingPath]: "" } }
  );
}

async function markReminderSent(
  meetingId: unknown,
  role: MeetingParticipantRole,
  kind: ReminderKind,
  claimedAt: Date
) {
  const fields = reminderFields(kind);
  const sentPath = `attendanceConfirmation.${role}.${fields.sent}`;
  const sendingPath = `attendanceConfirmation.${role}.${fields.sending}`;
  const failedPath = `attendanceConfirmation.${role}.${fields.failed}`;

  await Meeting.updateOne(
    { _id: meetingId, [sendingPath]: claimedAt },
    {
      $set: { [sentPath]: new Date() },
      $unset: {
        [sendingPath]: "",
        [failedPath]: "",
        [`attendanceConfirmation.${role}.reminderError`]: "",
      },
    }
  );
}

async function markReminderFailed(
  meetingId: unknown,
  role: MeetingParticipantRole,
  kind: ReminderKind,
  claimedAt: Date,
  error: string
) {
  const fields = reminderFields(kind);
  const sendingPath = `attendanceConfirmation.${role}.${fields.sending}`;
  const failedPath = `attendanceConfirmation.${role}.${fields.failed}`;

  await Meeting.updateOne(
    { _id: meetingId, [sendingPath]: claimedAt },
    {
      $set: {
        [failedPath]: new Date(),
        [`attendanceConfirmation.${role}.reminderError`]: formatErrorMessage(error),
      },
      $unset: { [sendingPath]: "" },
    }
  );
}

async function sendReminderToParticipant(
  meeting: PopulatedMeeting,
  role: MeetingParticipantRole,
  kind: ReminderKind,
  now: Date
) {
  const claimedAt = await claimReminderSend(meeting, role, kind, now);

  if (!claimedAt) {
    return;
  }

  const currentMeeting = await loadMeetingWithParticipants(meeting._id);

  if (!currentMeeting || !isMeetingReminderEligible(currentMeeting, new Date())) {
    await releaseReminderClaim(meeting._id, role, kind, claimedAt);
    return;
  }

  if (kind === "3h" && getAttendanceState(currentMeeting, role).confirmedAt) {
    await releaseReminderClaim(meeting._id, role, kind, claimedAt);
    return;
  }

  const email = buildReminderEmail(currentMeeting, role, kind);

  if (!email) {
    await markReminderFailed(meeting._id, role, kind, claimedAt, "Missing participant email data");
    return;
  }

  const result = await sendEmail(email);

  if (result.ok) {
    await markReminderSent(meeting._id, role, kind, claimedAt);
    return;
  }

  await markReminderFailed(meeting._id, role, kind, claimedAt, result.error);
}

async function sendReminderKind(meeting: PopulatedMeeting, kind: ReminderKind, now: Date) {
  for (const role of PARTICIPANT_ROLES) {
    const shouldSend =
      kind === "24h"
        ? shouldSendReminder24h(meeting, role, now)
        : shouldSendReminder3h(meeting, role, now);

    if (shouldSend) {
      await sendReminderToParticipant(meeting, role, kind, now);
    }
  }
}

export async function processAttendanceRemindersForMeeting(meetingId: unknown, now = new Date()) {
  const meeting = await loadMeetingWithParticipants(meetingId);

  if (!meeting || !isMeetingReminderEligible(meeting, now)) {
    return;
  }

  await sendReminderKind(meeting, "24h", now);

  const meetingAfter24h = await loadMeetingWithParticipants(meetingId);

  if (!meetingAfter24h || !isMeetingReminderEligible(meetingAfter24h, now)) {
    return;
  }

  await sendReminderKind(meetingAfter24h, "3h", now);
}

export function queueAttendanceReminderCheck(meetingId: unknown) {
  void processAttendanceRemindersForMeeting(meetingId).catch((error) => {
    console.error("[meeting-reminders] Failed to process immediate reminder check", error);
  });
}

export async function processDueAttendanceReminders(now = new Date()) {
  const dueMeetings = await Meeting.find({
    status: "scheduled",
    selectedTime: {
      $gt: now,
      $lte: new Date(now.getTime() + DAY_MS),
    },
  })
    .select("_id")
    .limit(100);

  for (const meeting of dueMeetings) {
    await processAttendanceRemindersForMeeting(meeting._id, now);
  }
}

export function startMeetingReminderWorker() {
  if (workerStarted || process.env.MEETING_REMINDER_WORKER_DISABLED === "true") {
    return;
  }

  workerStarted = true;

  const run = async () => {
    if (workerRunning) {
      return;
    }

    workerRunning = true;

    try {
      await processDueAttendanceReminders();
    } catch (error) {
      console.error("[meeting-reminders] Failed to process due reminders", error);
    } finally {
      workerRunning = false;
    }
  };

  void run();
  const interval = setInterval(run, getPollIntervalMs());
  interval.unref();
}

export async function confirmAttendanceFromToken(
  token: string,
  now = new Date()
): Promise<ConfirmAttendanceResult> {
  const payload = verifyAttendanceConfirmationToken(token);

  if (!payload) {
    return { ok: false, status: 400, message: "קישור אישור ההגעה לא תקין או שפג תוקפו." };
  }

  if (
    !Types.ObjectId.isValid(payload.meetingId) ||
    !Types.ObjectId.isValid(payload.participantId)
  ) {
    return { ok: false, status: 400, message: "קישור אישור ההגעה לא תקין." };
  }

  const selectedTimeFromToken = new Date(payload.selectedTime);

  if (Number.isNaN(selectedTimeFromToken.getTime())) {
    return { ok: false, status: 400, message: "קישור אישור ההגעה לא תקין." };
  }

  const meeting = await Meeting.findById(payload.meetingId);

  if (!meeting) {
    return { ok: false, status: 404, message: "הפגישה לא נמצאה." };
  }

  if (!meeting.selectedTime) {
    return {
      ok: false,
      status: 409,
      message: "לא ניתן לאשר הגעה לפגישה הזו.",
    };
  }

  if (meeting.selectedTime.toISOString() !== selectedTimeFromToken.toISOString()) {
    return {
      ok: false,
      status: 409,
      message: "קישור האישור כבר לא מתאים למועד הנוכחי של הפגישה.",
    };
  }

  const participantIdField = getParticipantIdField(payload.role);

  if (String(meeting[participantIdField]) !== payload.participantId) {
    return {
      ok: false,
      status: 403,
      message: "קישור האישור לא שייך למשתתפת הזו בפגישה.",
    };
  }

  const confirmedPath = `attendanceConfirmation.${payload.role}.confirmedAt`;
  const existingState = getAttendanceState(meeting, payload.role);

  if (existingState.confirmedAt) {
    return {
      ok: true,
      alreadyConfirmed: true,
      meetingId: String(meeting._id),
      role: payload.role,
      selectedTime: meeting.selectedTime,
    };
  }

  if (meeting.status !== "scheduled") {
    return {
      ok: false,
      status: 409,
      message: "לא ניתן לאשר הגעה לפגישה הזו.",
    };
  }

  if (meeting.selectedTime.getTime() <= now.getTime()) {
    return {
      ok: false,
      status: 409,
      message: "הפגישה כבר התחילה או עברה.",
    };
  }

  const updatedMeeting = await Meeting.findOneAndUpdate(
    {
      _id: meeting._id,
      status: "scheduled",
      selectedTime: meeting.selectedTime,
      [participantIdField]: payload.participantId,
      $or: missingOrNull(confirmedPath),
    },
    {
      $set: { [confirmedPath]: now },
    },
    { new: true }
  );

  if (!updatedMeeting) {
    const latestMeeting = await Meeting.findById(meeting._id);
    const latestState = latestMeeting ? getAttendanceState(latestMeeting, payload.role) : null;

    if (latestMeeting?.status === "scheduled" && latestState?.confirmedAt) {
      return {
        ok: true,
        alreadyConfirmed: true,
        meetingId: String(latestMeeting._id),
        role: payload.role,
        selectedTime: latestMeeting.selectedTime ?? meeting.selectedTime,
      };
    }

    return {
      ok: false,
      status: 409,
      message: "לא ניתן לאשר הגעה לפגישה הזו.",
    };
  }

  return {
    ok: true,
    alreadyConfirmed: false,
    meetingId: String(updatedMeeting._id),
    role: payload.role,
    selectedTime: updatedMeeting.selectedTime ?? meeting.selectedTime,
  };
}
