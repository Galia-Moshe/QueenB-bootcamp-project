import { Router } from "express";
import mongoose, { type HydratedDocument } from "mongoose";
import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { Meeting, type MeetingDocument } from "../models/Meeting";
import { MentorProfile } from "../models/MentorProfile";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import {
  confirmAttendanceFromToken,
  queueAttendanceReminderCheck,
} from "../services/meetingReminderService";

const router = Router();

/** Meeting statuses that block booking another slot with the same mentor. */
const ACTIVE_MEETING_STATUSES = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
] as const;

const ACTIVE_MEETING_WITH_MENTOR_ERROR = {
  error:
    "יש לך כבר פגישה עתידית או בקשה ממתינה עם המנטורית הזו. לא ניתן לקבוע פגישה נוספת עד שהיא תסתיים.",
  message: "You already have an active meeting scheduled with this mentor.",
} as const;

function isSameId(first: unknown, second: unknown) {
  return String(first) === String(second);
}

async function findActiveMeetingWithMentor(mentorId: unknown, menteeId: unknown) {
  return Meeting.findOne({
    mentorId,
    menteeId,
    status: { $in: [...ACTIVE_MEETING_STATUSES] },
  });
}

/** Id of a possibly-populated ref field: a populated doc's `_id`, or a raw ObjectId/string. */
function idOf(value: unknown) {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

/** Both sides confirmed attendance (status and/or attendanceResponses). */
function isMeetingAttendanceConfirmed(meeting: Pick<MeetingDocument, "status" | "attendanceResponses">) {
  const bothSaidYes =
    meeting.attendanceResponses?.mentor === "yes" &&
    meeting.attendanceResponses?.mentee === "yes";

  return (
    bothSaidYes ||
    meeting.status === "attendance_confirmed" ||
    meeting.status === "feedback_submitted"
  );
}

function parseDateList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => new Date(String(item)))
    .filter((date) => !Number.isNaN(date.getTime()));
}

function populateMeeting(query: ReturnType<typeof Meeting.find>) {
  return query
    .populate("mentorId", "-passwordHash")
    .populate("menteeId", "-passwordHash")
    .populate("availabilityWindowId")
    .sort({ updatedAt: -1 });
}

function formatWindowDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
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

function renderConfirmationPage(title: string, message: string) {
  return [
    "<!doctype html>",
    "<html lang=\"he\" dir=\"rtl\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<title>${escapeHtml(title)}</title>`,
    "</head>",
    "<body>",
    `<main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main>`,
    "</body>",
    "</html>",
  ].join("");
}

function formatConfirmationDateTime(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: process.env.MEETING_TIME_ZONE || "Asia/Jerusalem",
  }).format(date);
}

router.get("/confirm-attendance/:token", async (req, res, next) => {
  try {
    const result = await confirmAttendanceFromToken(req.params.token);

    if (!result.ok) {
      return res
        .status(result.status)
        .type("html")
        .send(renderConfirmationPage("אישור ההגעה נכשל", result.message));
    }

    const title = result.alreadyConfirmed ? "ההגעה כבר אושרה" : "ההגעה אושרה";
    const message = `אישרנו את ההגעה שלך לפגישה בתאריך ${formatConfirmationDateTime(
      result.selectedTime
    )}.`;

    return res.type("html").send(renderConfirmationPage(title, message));
  } catch (error) {
    next(error);
  }
});

function toDateKey(date: Date) {
  // AvailabilityWindow.date is a "YYYY-MM-DD" string — compare with a string, never a Date.
  // Use local calendar parts so Israel midnight isn't shifted by UTC.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function toMentorObjectId(mentorId: unknown) {
  if (mentorId instanceof mongoose.Types.ObjectId) {
    return mentorId;
  }

  if (mentorId && typeof mentorId === "object" && "_id" in mentorId) {
    return toMentorObjectId((mentorId as { _id: unknown })._id);
  }

  const asString = String(mentorId);
  if (!mongoose.Types.ObjectId.isValid(asString)) {
    throw new Error(`Invalid mentorId for availability check: ${asString}`);
  }

  return new mongoose.Types.ObjectId(asString);
}

/** Same availability rules as GET /mentors/:mentorId/availability, limited to today+. */
async function mentorHasFutureAvailability(mentorId: unknown) {
  const mentorObjectId = toMentorObjectId(mentorId);
  const todayKey = toDateKey(new Date());
  const filter = {
    mentorId: mentorObjectId,
    status: "available" as const,
    date: { $gte: todayKey },
  };

  const count = await AvailabilityWindow.countDocuments(filter);

  console.log("[mentorHasFutureAvailability]", {
    mentorId: String(mentorObjectId),
    filter: { ...filter, mentorId: String(mentorObjectId), date: filter.date },
    count,
  });

  return count > 0;
}

router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { mentorId } = req.body;

    if (!mentorId || !mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).json({ error: "יש לבחור מנטורית תקינה" });
    }

    if (isSameId(mentorId, req.user!._id)) {
      return res.status(400).json({ error: "אי אפשר לבקש פגישה עם עצמך" });
    }

    const mentorProfile = await MentorProfile.findOne({
      userId: mentorId,
      approvalStatus: "approved",
    });
    if (!mentorProfile) {
      return res.status(404).json({ error: "המנטורית לא נמצאה" });
    }

    const existingActiveMeeting = await findActiveMeetingWithMentor(mentorId, req.user!._id);
    if (existingActiveMeeting) {
      return res.status(400).json(ACTIVE_MEETING_WITH_MENTOR_ERROR);
    }

    const meeting = await Meeting.create({
      mentorId,
      menteeId: req.user!._id,
      status: "pending_mentor_times",
    });

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash");

    return res.status(201).json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.post("/from-availability", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { availabilityWindowId, topics } = req.body;

    if (!availabilityWindowId || !mongoose.Types.ObjectId.isValid(availabilityWindowId)) {
      return res.status(400).json({ error: "יש לבחור מועד תקין" });
    }

    const availabilityWindow = await AvailabilityWindow.findById(availabilityWindowId);
    if (!availabilityWindow) {
      return res.status(404).json({ error: "המועד המבוקש לא נמצא" });
    }

    if (isSameId(availabilityWindow.mentorId, req.user!._id)) {
      return res.status(400).json({ error: "אי אפשר לבקש פגישה עם עצמך" });
    }

    const mentorProfile = await MentorProfile.findOne({
      userId: availabilityWindow.mentorId,
      approvalStatus: "approved",
    });
    if (!mentorProfile) {
      return res.status(404).json({ error: "המנטורית לא נמצאה" });
    }

    if (mentorProfile.topics.length > 0) {
      const isValidTopicSelection =
        Array.isArray(topics) &&
        topics.length > 0 &&
        topics.every((selected) => typeof selected === "string" && mentorProfile.topics.includes(selected));

      if (!isValidTopicSelection) {
        return res.status(400).json({ error: "יש לבחור לפחות נושא אחד תקין מתוך רשימת הנושאים של המנטורית" });
      }
    }

    const existingActiveMeeting = await findActiveMeetingWithMentor(
      availabilityWindow.mentorId,
      req.user!._id
    );

    if (existingActiveMeeting) {
      return res.status(400).json(ACTIVE_MEETING_WITH_MENTOR_ERROR);
    }

    // A mentee who canceled two of her own approved meetings with this mentor may never
    // book her again, regardless of how many active meetings she currently has with her.
    const qualifyingCancellations = await Meeting.countDocuments({
      mentorId: availabilityWindow.mentorId,
      menteeId: req.user!._id,
      status: "canceled",
      canceledBy: "mentee",
    });

    if (qualifyingCancellations >= 2) {
      return res.status(409).json({
        error: "לא ניתן לקבוע פגישה נוספת עם המנטורית הזו לאחר ביטולים קודמים מצידך",
      });
    }

    // Atomically claim the slot: only the request that flips available -> pending may proceed.
    const claimedWindow = await AvailabilityWindow.findOneAndUpdate(
      { _id: availabilityWindowId, status: "available" },
      { $set: { status: "pending" } },
      { new: true }
    );

    if (!claimedWindow) {
      return res.status(409).json({ error: "המועד שבחרת כבר נתפס. אנא בחרי מועד אחר." });
    }

    let populatedMeeting;

    try {
      const meeting = await Meeting.create({
        mentorId: claimedWindow.mentorId,
        menteeId: req.user!._id,
        status: "pending_mentor_times",
        availabilityWindowId: claimedWindow._id,
        ...(mentorProfile.topics.length > 0 ? { topics } : {}),
      });

      populatedMeeting = await Meeting.findById(meeting._id)
        .populate("mentorId", "-passwordHash")
        .populate("menteeId", "-passwordHash")
        .populate("availabilityWindowId");
    } catch (creationError) {
      await AvailabilityWindow.findOneAndUpdate(
        { _id: availabilityWindowId, status: "pending" },
        { $set: { status: "available" } }
      );
      throw creationError;
    }

    // Booking succeeded: notify the mentor. Kept outside the block above so a
    // notification failure never triggers the availability-window rollback.
    await Notification.create({
      recipient: claimedWindow.mentorId,
      type: "new_meeting_request",
      message: `קיבלת בקשה חדשה לפגישה בתאריך ${formatWindowDate(claimedWindow.date)} בשעה ${claimedWindow.startTime}–${claimedWindow.endTime}`,
    });

    return res.status(201).json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.get("/my", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const role = req.query.role;
    const filter = {
      ...(role === "mentor" ? { mentorId: req.user!._id } : { menteeId: req.user!._id }),
      status: { $ne: "canceled" },
    };

    // populate() widens the query's static type past what TS can track through the chain;
    // the runtime shape is exactly HydratedDocument<MeetingDocument> with ref fields populated.
    const meetings = (await populateMeeting(Meeting.find(filter))) as HydratedDocument<MeetingDocument>[];

    if (role === "mentor") {
      return res.json({ meetings });
    }

    // For a mentee, tell the frontend how many qualifying cancellations she already has with
    // each mentor shown here, so it can warn before what would become her second one.
    const mentorIds = Array.from(new Set(meetings.map((meeting) => idOf(meeting.mentorId))));

    const cancellationCounts = mentorIds.length
      ? await Meeting.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          {
            $match: {
              menteeId: req.user!._id,
              status: "canceled",
              canceledBy: "mentee",
              mentorId: { $in: mentorIds.map((id) => new mongoose.Types.ObjectId(id)) },
            },
          },
          { $group: { _id: "$mentorId", count: { $sum: 1 } } },
        ])
      : [];

    const cancellationCountByMentorId = new Map(
      cancellationCounts.map((entry) => [String(entry._id), entry.count])
    );

    const meetingsWithCancellationCount = meetings.map((meeting) => ({
      ...meeting.toObject(),
      menteeCancellationCountWithMentor: cancellationCountByMentorId.get(idOf(meeting.mentorId)) ?? 0,
    }));

    return res.json({ meetings: meetingsWithCancellationCount });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/propose-times", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    if (!isSameId(meeting.mentorId, req.user!._id)) {
      return res.status(403).json({ error: "רק המנטורית יכולה להציע זמנים" });
    }

    if (meeting.status === "canceled") {
      return res.status(400).json({ error: "לא ניתן לעדכן פגישה שבוטלה" });
    }

    const proposedTimes = parseDateList(req.body.proposedTimes);
    if (proposedTimes.length === 0) {
      return res.status(400).json({ error: "יש להזין לפחות זמן אחד תקין" });
    }

    meeting.proposedTimes = proposedTimes;
    meeting.status = "pending_mentee_selection";
    await meeting.save();

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/select-time", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    if (!isSameId(meeting.menteeId, req.user!._id)) {
      return res.status(403).json({ error: "רק המנטית יכולה לבחור זמן" });
    }

    if (meeting.status === "canceled") {
      return res.status(400).json({ error: "לא ניתן לעדכן פגישה שבוטלה" });
    }

    const selectedTime = new Date(String(req.body.selectedTime));
    if (Number.isNaN(selectedTime.getTime())) {
      return res.status(400).json({ error: "יש לבחור זמן תקין" });
    }

    const isProposedTime = meeting.proposedTimes.some(
      (time) => time.getTime() === selectedTime.getTime()
    );

    if (!isProposedTime) {
      return res.status(400).json({ error: "יש לבחור אחד מהזמנים שהמנטורית הציעה" });
    }

    meeting.selectedTime = selectedTime;
    meeting.status = "scheduled";
    meeting.scheduledAt = new Date();
    meeting.attendanceConfirmation = { mentor: {}, mentee: {} };
    await meeting.save();

    await User.findByIdAndUpdate(meeting.mentorId, { $inc: { mentoringSessionsCount: 1 } });
    await User.findByIdAndUpdate(meeting.menteeId, { $inc: { menteeSessionsCount: 1 } });
    queueAttendanceReminderCheck(meeting._id);

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/approve", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    if (!isSameId(meeting.mentorId, req.user!._id)) {
      return res.status(403).json({ error: "רק המנטורית של הפגישה יכולה לאשר אותה" });
    }

    if (!meeting.availabilityWindowId) {
      return res.status(400).json({ error: "לא ניתן לאשר פגישה זו בדרך הזו" });
    }

    if (meeting.status !== "pending_mentor_times") {
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    const availabilityWindow = await AvailabilityWindow.findById(meeting.availabilityWindowId);
    if (!availabilityWindow) {
      return res.status(404).json({ error: "חלון הזמינות של הפגישה לא נמצא" });
    }

    if (!isSameId(availabilityWindow.mentorId, req.user!._id)) {
      return res.status(403).json({ error: "רק המנטורית של הפגישה יכולה לאשר אותה" });
    }

    if (availabilityWindow.status !== "pending") {
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    // Atomically claim the approval: only the request that flips pending -> booked may proceed.
    const bookedWindow = await AvailabilityWindow.findOneAndUpdate(
      { _id: availabilityWindow._id, status: "pending" },
      { $set: { status: "booked" } },
      { new: true }
    );

    if (!bookedWindow) {
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    const selectedTime = new Date(`${bookedWindow.date}T${bookedWindow.startTime}:00`);
    const scheduledAt = new Date();

    const scheduledMeeting = await Meeting.findOneAndUpdate(
      { _id: meeting._id, status: "pending_mentor_times" },
      {
        $set: {
          status: "scheduled",
          selectedTime,
          scheduledAt,
          attendanceConfirmation: { mentor: {}, mentee: {} },
        },
      },
      { new: true }
    );

    if (!scheduledMeeting) {
      // The meeting moved out of the pending state concurrently: undo the window claim
      // rather than leaving a "booked" window with no matching scheduled meeting.
      await AvailabilityWindow.findOneAndUpdate(
        { _id: bookedWindow._id, status: "booked" },
        { $set: { status: "pending" } }
      );
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    await User.findByIdAndUpdate(scheduledMeeting.mentorId, { $inc: { mentoringSessionsCount: 1 } });
    await User.findByIdAndUpdate(scheduledMeeting.menteeId, { $inc: { menteeSessionsCount: 1 } });

    await Notification.create({
      recipient: scheduledMeeting.menteeId,
      type: "meeting_approved",
      message: `בקשתך לפגישה בתאריך ${formatWindowDate(bookedWindow.date)} בשעה ${bookedWindow.startTime}–${bookedWindow.endTime} אושרה`,
    });

    queueAttendanceReminderCheck(scheduledMeeting._id);

    const populatedMeeting = await Meeting.findById(scheduledMeeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/reject", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    if (!isSameId(meeting.mentorId, req.user!._id)) {
      return res.status(403).json({ error: "רק המנטורית של הפגישה יכולה לדחות אותה" });
    }

    if (!meeting.availabilityWindowId) {
      return res.status(400).json({ error: "לא ניתן לדחות פגישה זו בדרך הזו" });
    }

    if (meeting.status !== "pending_mentor_times") {
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    const availabilityWindow = await AvailabilityWindow.findById(meeting.availabilityWindowId);
    if (!availabilityWindow) {
      return res.status(404).json({ error: "חלון הזמינות של הפגישה לא נמצא" });
    }

    if (!isSameId(availabilityWindow.mentorId, req.user!._id)) {
      return res.status(403).json({ error: "רק המנטורית של הפגישה יכולה לדחות אותה" });
    }

    if (availabilityWindow.status !== "pending") {
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    // Atomically release the slot: only the rejection that finds it still "pending" may proceed.
    const releasedWindow = await AvailabilityWindow.findOneAndUpdate(
      { _id: availabilityWindow._id, status: "pending" },
      { $set: { status: "available" } },
      { new: true }
    );

    if (!releasedWindow) {
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    const canceledMeeting = await Meeting.findOneAndUpdate(
      { _id: meeting._id, status: "pending_mentor_times" },
      { $set: { status: "canceled" } },
      { new: true }
    );

    if (!canceledMeeting) {
      // The meeting moved out of the pending state concurrently: undo the window release
      // rather than leaving an "available" window whose meeting was never actually canceled.
      // Guarded on "available" so it never clobbers a slot another mentee has since re-booked.
      await AvailabilityWindow.findOneAndUpdate(
        { _id: releasedWindow._id, status: "available" },
        { $set: { status: "pending" } }
      );
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    await Notification.create({
      recipient: canceledMeeting.menteeId,
      type: "meeting_rejected",
      message: `בקשתך לפגישה בתאריך ${formatWindowDate(releasedWindow.date)} בשעה ${releasedWindow.startTime}–${releasedWindow.endTime} נדחתה`,
    });

    const populatedMeeting = await Meeting.findById(canceledMeeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/cancel", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    const isMentee = isSameId(meeting.menteeId, req.user!._id);
    const isMentor = isSameId(meeting.mentorId, req.user!._id);

    if (!isMentee && !isMentor) {
      return res.status(403).json({ error: "אין לך הרשאה לבטל את הפגישה הזו" });
    }

    if (meeting.status !== "scheduled") {
      return res.status(409).json({ error: "אפשר לבטל רק פגישה שאושרה" });
    }

    if (!meeting.availabilityWindowId) {
      return res.status(400).json({ error: "לא ניתן לבטל פגישה זו בדרך הזו" });
    }

    const availabilityWindow = await AvailabilityWindow.findById(meeting.availabilityWindowId);
    if (!availabilityWindow) {
      return res.status(404).json({ error: "חלון הזמינות של הפגישה לא נמצא" });
    }

    if (availabilityWindow.status !== "booked") {
      return res.status(409).json({ error: "הפגישה כבר טופלה" });
    }

    // Atomically claim the cancellation: only the request that finds the slot still "booked" may proceed.
    // A mentee cancellation reopens the slot for booking; a mentor cancellation closes it permanently
    // (deleted, same as how a mentor removes an unwanted "available" slot elsewhere).
    const releasedWindow = isMentee
      ? await AvailabilityWindow.findOneAndUpdate(
          { _id: availabilityWindow._id, status: "booked" },
          { $set: { status: "available" } },
          { new: true }
        )
      : await AvailabilityWindow.findOneAndDelete({ _id: availabilityWindow._id, status: "booked" });

    if (!releasedWindow) {
      return res.status(409).json({ error: "הפגישה כבר טופלה" });
    }

    const canceledMeeting = await Meeting.findOneAndUpdate(
      { _id: meeting._id, status: "scheduled" },
      { $set: { status: "canceled", canceledBy: isMentee ? "mentee" : "mentor" } },
      { new: true }
    );

    if (!canceledMeeting) {
      // The meeting moved out of the scheduled state concurrently: undo the window change
      // rather than leaving a meeting that was never actually canceled with its slot released/closed.
      if (isMentee) {
        // Guarded on "available" so it never clobbers a slot another mentee has since re-booked.
        await AvailabilityWindow.findOneAndUpdate(
          { _id: releasedWindow._id, status: "available" },
          { $set: { status: "booked" } }
        );
      } else {
        await AvailabilityWindow.create({
          _id: releasedWindow._id,
          mentorId: releasedWindow.mentorId,
          date: releasedWindow.date,
          startTime: releasedWindow.startTime,
          endTime: releasedWindow.endTime,
          status: "booked",
        });
      }
      return res.status(409).json({ error: "הפגישה כבר טופלה" });
    }

    await Notification.create({
      recipient: isMentee ? canceledMeeting.mentorId : canceledMeeting.menteeId,
      type: "meeting_canceled",
      message: isMentee
        ? `המנטית ביטלה את הפגישה בתאריך ${formatWindowDate(releasedWindow.date)} בשעה ${releasedWindow.startTime}–${releasedWindow.endTime}`
        : `המנטורית ביטלה את הפגישה בתאריך ${formatWindowDate(releasedWindow.date)} בשעה ${releasedWindow.startTime}–${releasedWindow.endTime}`,
    });

    const populatedMeeting = await Meeting.findById(canceledMeeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decline", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    const isMentee = isSameId(meeting.menteeId, req.user!._id);
    const isMentor = isSameId(meeting.mentorId, req.user!._id);

    if (!isMentee && !isMentor) {
      return res.status(403).json({ error: "אין לך הרשאה לעדכן את הפגישה הזו" });
    }

    if (meeting.status === "scheduled") {
      return res.status(409).json({ error: "לא ניתן לבטל פגישה זו בדרך הזו" });
    }

    if (meeting.status === "canceled") {
      const populatedMeeting = await Meeting.findById(meeting._id)
        .populate("mentorId", "-passwordHash")
        .populate("menteeId", "-passwordHash")
        .populate("availabilityWindowId");

      return res.json({ meeting: populatedMeeting });
    }

    // Reopen the linked slot for booking — never delete the AvailabilityWindow.
    // A mentee (or mentor) decline of a pending request must return the slot to "available".
    let releasedWindow: {
      _id: mongoose.Types.ObjectId;
      status: string;
    } | null = null;
    let previousWindowStatus: "pending" | "booked" | null = null;

    if (meeting.availabilityWindowId) {
      const availabilityWindow = await AvailabilityWindow.findById(meeting.availabilityWindowId);

      if (
        availabilityWindow &&
        (availabilityWindow.status === "pending" || availabilityWindow.status === "booked")
      ) {
        previousWindowStatus = availabilityWindow.status;
        releasedWindow = await AvailabilityWindow.findOneAndUpdate(
          { _id: availabilityWindow._id, status: previousWindowStatus },
          { $set: { status: "available" } },
          { new: true }
        );

        if (!releasedWindow) {
          return res.status(409).json({ error: "הבקשה כבר טופלה" });
        }
      }
    }

    const canceledMeeting = await Meeting.findOneAndUpdate(
      { _id: meeting._id, status: meeting.status },
      { $set: { status: "canceled", canceledBy: isMentee ? "mentee" : "mentor" } },
      { new: true }
    );

    if (!canceledMeeting) {
      // Meeting moved concurrently: undo the window release rather than leaving an "available"
      // window whose meeting was never actually canceled. Guarded on "available" so it never
      // clobbers a slot another mentee has since re-booked.
      if (releasedWindow && previousWindowStatus) {
        await AvailabilityWindow.findOneAndUpdate(
          { _id: releasedWindow._id, status: "available" },
          { $set: { status: previousWindowStatus } }
        );
      }
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    const populatedMeeting = await Meeting.findById(canceledMeeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/attendance", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    // Legacy meetings may still have attendanceResponses as an array — normalize first.
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      await Meeting.collection.updateOne(
        {
          _id: new mongoose.Types.ObjectId(req.params.id),
          $or: [
            { attendanceResponses: { $type: "array" } },
            { attendanceResponses: { $exists: false } },
            { attendanceResponses: null },
          ],
        },
        { $set: { attendanceResponses: { mentor: null, mentee: null } } }
      );
    }

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    const isMentor = isSameId(meeting.mentorId, req.user!._id);
    const isMentee = isSameId(meeting.menteeId, req.user!._id);

    if (!isMentor && !isMentee) {
      return res.status(403).json({ error: "אין לך הרשאה לעדכן את הפגישה הזו" });
    }

    if (meeting.status !== "scheduled") {
      return res.status(409).json({ error: "ניתן לענות על אישור הגעה רק לפגישה מתוזמנת" });
    }

    const attended = req.body.attended === true || req.body.attended === "true";
    const didNotAttend = req.body.attended === false || req.body.attended === "false";

    if (!attended && !didNotAttend) {
      return res.status(400).json({ error: "יש לציין האם הפגישה התקיימה" });
    }

    const responseValue = attended ? "yes" : "no";
    const roleKey = isMentor ? "mentor" : "mentee";

    const currentResponses = {
      mentor: meeting.attendanceResponses?.mentor ?? null,
      mentee: meeting.attendanceResponses?.mentee ?? null,
    };

    if (currentResponses[roleKey] != null) {
      return res.status(409).json({ error: "כבר ענית על אישור ההגעה לפגישה זו" });
    }

    currentResponses[roleKey] = responseValue;
    meeting.attendanceResponses = currentResponses;
    meeting.markModified("attendanceResponses");

    let outcome: "awaiting_other" | "confirmed" | "canceled" | "disputed" = "awaiting_other";
    let message = "תודה! המערכת ממתינה לאישור המשתתפת השנייה.";

    const mentorResponse = currentResponses.mentor;
    const menteeResponse = currentResponses.mentee;

    if (mentorResponse != null && menteeResponse != null) {
      if (mentorResponse === "yes" && menteeResponse === "yes") {
        meeting.status = "attendance_confirmed";
        outcome = "confirmed";
        message =
          "שתיכן אישרתן שהפגישה התקיימה. אפשר למלא משוב עכשיו או לקבל תזכורת בעוד 24 שעות.";
      } else if (mentorResponse === "no" && menteeResponse === "no") {
        if (meeting.availabilityWindowId) {
          await AvailabilityWindow.findOneAndUpdate(
            { _id: meeting.availabilityWindowId, status: "booked" },
            { $set: { status: "available" } }
          );
        }
        meeting.status = "canceled";
        outcome = "canceled";
        message = "הפגישה בוטלה לאחר ששתיכן דיווחתן שהיא לא התקיימה.";
      } else {
        meeting.status = "disputed";
        outcome = "disputed";
        message = "התקבל דיווח לא תואם לגבי הפגישה. הנושא הועבר לבדיקת צוות המערכת.";
      }
    } else if (!attended) {
      message = "תודה על העדכון. המערכת ממתינה לתשובת המשתתפת השנייה.";
    }

    await meeting.save();

    const waitingMessage = "תודה! המערכת ממתינה לאישור המשתתפת השנייה.";
    const feedbackPromptMessage =
      "שתיכן אישרתן שהפגישה התקיימה. מלאי משוב עכשיו, או הזכירי לי מחר (בעוד 24 שעות).";
    const discrepancyMessage =
      "התקבל דיווח לא תואם לגבי הפגישה. הנושא הועבר לבדיקת צוות המערכת.";

    await Notification.updateMany(
      {
        meetingId: meeting._id,
        type: "attendance_check",
        recipient: req.user!._id,
        actionStatus: "pending",
      },
      {
        $set: {
          actionStatus:
            outcome === "confirmed"
              ? "feedback_choice"
              : outcome === "awaiting_other" && attended
                ? "awaiting_other"
                : "answered",
          read: true,
          ...(outcome === "awaiting_other" && attended ? { message: waitingMessage } : {}),
        },
      }
    );

    if (outcome === "confirmed") {
      await Notification.updateMany(
        {
          meetingId: meeting._id,
          type: "attendance_check",
        },
        {
          $set: {
            actionStatus: "feedback_choice",
            read: false,
            message: feedbackPromptMessage,
          },
        }
      );
    }

    if (outcome === "canceled" || outcome === "disputed") {
      await Notification.updateMany(
        {
          meetingId: meeting._id,
          type: "attendance_check",
          actionStatus: { $in: ["pending", "feedback_choice", "awaiting_other"] },
        },
        { $set: { actionStatus: "answered", read: true } }
      );
    }

    if (outcome === "canceled") {
      const rescheduleMessage = "הפגישה לא התקיימה. האם תרצי לתאם אותה מחדש?";
      await Notification.create([
        {
          recipient: meeting.mentorId,
          type: "reschedule_inquiry",
          meetingId: meeting._id,
          message: rescheduleMessage,
          actionStatus: "pending",
        },
        {
          recipient: meeting.menteeId,
          type: "reschedule_inquiry",
          meetingId: meeting._id,
          message: rescheduleMessage,
          actionStatus: "pending",
        },
      ]);
    }

    if (outcome === "disputed") {
      await Notification.create([
        {
          recipient: meeting.mentorId,
          type: "attendance_discrepancy",
          meetingId: meeting._id,
          message: discrepancyMessage,
        },
        {
          recipient: meeting.menteeId,
          type: "attendance_discrepancy",
          meetingId: meeting._id,
          message: discrepancyMessage,
        },
      ]);
    }

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId");

    return res.json({ meeting: populatedMeeting, outcome, message });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/remind-feedback", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    const isMentor = isSameId(meeting.mentorId, req.user!._id);
    const isMentee = isSameId(meeting.menteeId, req.user!._id);

    if (!isMentor && !isMentee) {
      return res.status(403).json({ error: "אין לך הרשאה לעדכן את הפגישה הזו" });
    }

    if (
      meeting.status !== "attendance_confirmed" &&
      meeting.status !== "feedback_submitted"
    ) {
      return res.status(409).json({ error: "ניתן לקבוע תזכורת משוב רק לאחר אישור שהפגישה התקיימה" });
    }

    if (meeting.feedbacks.some((f) => String(f.fromUserId) === String(req.user!._id))) {
      return res.status(409).json({ error: "כבר שלחת משוב לפגישה זו" });
    }

    meeting.feedbackReminderAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await meeting.save();

    await Notification.updateMany(
      {
        meetingId: meeting._id,
        recipient: req.user!._id,
        type: { $in: ["attendance_check", "feedback_reminder"] },
        actionStatus: { $in: ["pending", "feedback_choice", "awaiting_other"] },
      },
      { $set: { actionStatus: "answered", read: true } }
    );

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/reschedule-interest", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    const isMentor = isSameId(meeting.mentorId, req.user!._id);
    const isMentee = isSameId(meeting.menteeId, req.user!._id);

    if (!isMentor && !isMentee) {
      return res.status(403).json({ error: "אין לך הרשאה לעדכן את הפגישה הזו" });
    }

    if (meeting.status !== "canceled") {
      return res.status(409).json({ error: "ניתן לענות על תיאום מחדש רק לפגישה שבוטלה" });
    }

    if (
      meeting.attendanceResponses?.mentor !== "no" ||
      meeting.attendanceResponses?.mentee !== "no"
    ) {
      return res.status(409).json({ error: "תיאום מחדש זמין רק כאשר שתיכן דיווחתן שהפגישה לא התקיימה" });
    }

    const interested = req.body.interested === true || req.body.interested === "true";
    const notInterested = req.body.interested === false || req.body.interested === "false";

    if (!interested && !notInterested) {
      return res.status(400).json({ error: "יש לציין האם תרצי לתאם מחדש" });
    }

    const roleKey = isMentor ? "mentor" : "mentee";
    const currentInterest = {
      mentor: meeting.rescheduleInterest?.mentor ?? null,
      mentee: meeting.rescheduleInterest?.mentee ?? null,
    };

    if (currentInterest[roleKey] != null) {
      return res.status(409).json({ error: "כבר ענית על בקשת התיאום מחדש" });
    }

    currentInterest[roleKey] = interested ? "yes" : "no";
    meeting.rescheduleInterest = currentInterest;
    meeting.markModified("rescheduleInterest");
    await meeting.save();

    await Notification.updateMany(
      {
        meetingId: meeting._id,
        recipient: req.user!._id,
        type: "reschedule_inquiry",
        actionStatus: "pending",
      },
      { $set: { actionStatus: "answered", read: true } }
    );

    const schedulePath = `/schedule/${String(meeting.mentorId)}`;
    const bothInterested =
      currentInterest.mentor === "yes" && currentInterest.mentee === "yes";

    let hasAvailableWindows: boolean | undefined;
    let menteeNotified = false;

    if (isMentor && interested) {
      hasAvailableWindows = await mentorHasFutureAvailability(meeting.mentorId);

      if (currentInterest.mentee === "yes") {
        await Notification.create({
          recipient: meeting.menteeId,
          type: "reschedule_ready",
          meetingId: meeting._id,
          message: "המנטורית אישרה! לחצי כאן לקביעת הזמן החדש",
          actionUrl: schedulePath,
          actionStatus: "pending",
        });
        menteeNotified = true;
      }
    }

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId");

    return res.json({
      meeting: populatedMeeting,
      role: roleKey,
      interested,
      bothInterested,
      hasAvailableWindows,
      menteeNotified,
      schedulePath: bothInterested && isMentee ? schedulePath : undefined,
      mentorId: String(meeting.mentorId),
      message: !interested
        ? "תודה על העדכון."
        : isMentor
          ? menteeNotified
            ? "תודה! שלחנו למנטית קישור לקביעת זמן חדש."
            : "תודה! נעדכן את המנטית כשהיא תאשר גם."
          : bothInterested
            ? "שתיכן מעוניינות בתיאום מחדש. אפשר לקבוע זמן חדש עכשיו."
            : "מעולה! נמתין לאישור המנטורית ונשלח לך קישור לקביעה מחדש",
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/remind-availability", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    if (!isSameId(meeting.mentorId, req.user!._id)) {
      return res.status(403).json({ error: "רק המנטורית יכולה לקבוע תזכורת זמינות" });
    }

    if (meeting.status !== "canceled") {
      return res.status(409).json({ error: "תזכורת זמינות זמינה רק לפגישה שבוטלה" });
    }

    if (meeting.rescheduleInterest?.mentor !== "yes") {
      return res.status(409).json({ error: "ניתן לקבוע תזכורת רק לאחר אישור עניין בתיאום מחדש" });
    }

    const hasWindows = await mentorHasFutureAvailability(meeting.mentorId);
    if (hasWindows) {
      return res.status(409).json({ error: "כבר יש לך זמנים פנויים ביומן" });
    }

    meeting.availabilityReminderAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await meeting.save();

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId");

    return res.json({
      meeting: populatedMeeting,
      message: "תזכורת נקבעה. נזכיר לך בעוד 24 שעות להוסיף זמנים פנויים.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/feedback", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    const isMentor = isSameId(meeting.mentorId, req.user!._id);
    const isMentee = isSameId(meeting.menteeId, req.user!._id);

    if (!isMentor && !isMentee) {
      return res.status(403).json({ error: "אין לך הרשאה לשלוח משוב לפגישה הזו" });
    }

    if (!isMeetingAttendanceConfirmed(meeting)) {
      return res.status(409).json({ error: "ניתן לשלוח משוב רק לאחר אישור שהפגישה התקיימה" });
    }

    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      return res.status(400).json({ error: "יש להזין תוכן משוב" });
    }

    const role = isMentor ? "mentor" : "mentee";
    const alreadySubmitted = meeting.feedbacks.some(
      (feedback) => isSameId(feedback.fromUserId, req.user!._id)
    );

    if (alreadySubmitted) {
      return res.status(409).json({ error: "כבר שלחת משוב לפגישה זו" });
    }

    meeting.feedbacks.push({
      fromUserId: req.user!._id,
      role,
      content,
    });
    meeting.status = "feedback_submitted";
    await meeting.save();

    await Meeting.updateOne({ _id: meeting._id }, { $unset: { feedbackReminderAt: 1 } });

    await Notification.deleteMany({
      recipient: req.user!._id,
      meetingId: meeting._id,
      type: { $in: ["feedback_reminder", "attendance_check"] },
    });

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("availabilityWindowId")
      .populate("feedbacks.fromUserId", "-passwordHash");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

export default router;
