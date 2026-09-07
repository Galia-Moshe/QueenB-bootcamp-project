import cron from "node-cron";
import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { Meeting } from "../models/Meeting";
import { MentorProfile } from "../models/MentorProfile";
import { Notification } from "../models/Notification";

const DEFAULT_MEETING_DURATION_MINUTES = 60;

function formatMeetingDateTime(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

async function getMeetingEndTime(meeting: {
  selectedTime?: Date;
  mentorId: unknown;
  availabilityWindowId?: unknown;
}): Promise<Date | null> {
  if (!meeting.selectedTime) {
    return null;
  }

  if (meeting.availabilityWindowId) {
    const window = await AvailabilityWindow.findById(meeting.availabilityWindowId);
    if (window) {
      return new Date(`${window.date}T${window.endTime}:00`);
    }
  }

  const mentorProfile = await MentorProfile.findOne({ userId: meeting.mentorId });
  const durationMinutes =
    mentorProfile?.meetingLength && mentorProfile.meetingLength > 0
      ? mentorProfile.meetingLength
      : DEFAULT_MEETING_DURATION_MINUTES;

  return new Date(meeting.selectedTime.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Every minute: find scheduled meetings whose end time
 * (selectedTime + duration) has passed, send attendance-check
 * notifications to mentor and mentee, and set attendancePromptedAt.
 */
export function startAttendanceCheckJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const candidates = await Meeting.find({
        status: "scheduled",
        selectedTime: { $exists: true, $lte: now },
        attendancePromptedAt: { $exists: false },
      });

      let promptedCount = 0;

      for (const meeting of candidates) {
        const endTime = await getMeetingEndTime(meeting);
        if (!endTime || endTime > now) {
          continue;
        }

        const when = formatMeetingDateTime(meeting.selectedTime!);
        const message = `האם הפגישה שלך מתאריך ${when} התקיימה?`;

        const claimed = await Meeting.findOneAndUpdate(
          {
            _id: meeting._id,
            status: "scheduled",
            attendancePromptedAt: { $exists: false },
          },
          { $set: { attendancePromptedAt: new Date() } },
          { new: true }
        );

        if (!claimed) {
          continue;
        }

        await Notification.create([
          {
            recipient: claimed.mentorId,
            type: "attendance_check",
            meetingId: claimed._id,
            message,
            actionStatus: "pending",
          },
          {
            recipient: claimed.menteeId,
            type: "attendance_check",
            meetingId: claimed._id,
            message,
            actionStatus: "pending",
          },
        ]);

        promptedCount += 1;
      }

      if (promptedCount > 0) {
        console.log(`Attendance check: prompted ${promptedCount} meeting(s)`);
      }
    } catch (error) {
      console.error("Attendance check job failed", error);
    }
  });

  console.log("Attendance check cron job started (every minute, at meeting end)");
}

/**
 * Every 15 minutes: find attendance-confirmed meetings whose feedback reminder
 * is due, notify participants who have not submitted feedback yet, and clear
 * feedbackReminderAt to prevent repeat sends.
 */
export function startFeedbackReminderJob() {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const now = new Date();

      const meetings = await Meeting.find({
        status: { $in: ["attendance_confirmed", "feedback_submitted"] },
        feedbackReminderAt: { $exists: true, $lte: now },
      });

      for (const meeting of meetings) {
        const claimed = await Meeting.findOneAndUpdate(
          {
            _id: meeting._id,
            status: { $in: ["attendance_confirmed", "feedback_submitted"] },
            feedbackReminderAt: { $exists: true, $lte: now },
          },
          { $unset: { feedbackReminderAt: 1 } },
          { new: true }
        );

        if (!claimed) {
          continue;
        }

        const when = claimed.selectedTime
          ? formatMeetingDateTime(claimed.selectedTime)
          : "הפגישה";
        const message = `תזכורת: נשמח לשמוע איך היה! אפשר למלא משוב על הפגישה מ-${when}`;

        const recipients = [claimed.mentorId, claimed.menteeId].filter((userId) => {
          return !claimed.feedbacks.some(
            (feedback) => String(feedback.fromUserId) === String(userId)
          );
        });

        if (recipients.length === 0) {
          continue;
        }

        await Notification.create(
          recipients.map((recipient) => ({
            recipient,
            type: "feedback_reminder" as const,
            meetingId: claimed._id,
            message,
            actionStatus: "pending" as const,
          }))
        );
      }

      if (meetings.length > 0) {
        console.log(`Feedback reminder: notified for ${meetings.length} meeting(s)`);
      }
    } catch (error) {
      console.error("Feedback reminder job failed", error);
    }
  });

  console.log("Feedback reminder cron job started (every 15 minutes)");
}

/**
 * Every 15 minutes: remind mentors who deferred adding availability after
 * agreeing to reschedule, then clear availabilityReminderAt.
 */
export function startAvailabilityReminderJob() {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const now = new Date();

      const meetings = await Meeting.find({
        availabilityReminderAt: { $exists: true, $lte: now },
      });

      for (const meeting of meetings) {
        const claimed = await Meeting.findOneAndUpdate(
          {
            _id: meeting._id,
            availabilityReminderAt: { $exists: true, $lte: now },
          },
          { $unset: { availabilityReminderAt: 1 } },
          { new: true }
        );

        if (!claimed) {
          continue;
        }

        await Notification.create({
          recipient: claimed.mentorId,
          type: "availability_reminder",
          meetingId: claimed._id,
          message:
            "תזכורת: אנא הוסיפי זמנים פנויים ביומן כדי לאפשר תיאום פגישה מחדש",
          actionUrl: "/profile?availability=1",
          actionStatus: "pending",
        });
      }

      if (meetings.length > 0) {
        console.log(`Availability reminder: notified for ${meetings.length} meeting(s)`);
      }
    } catch (error) {
      console.error("Availability reminder job failed", error);
    }
  });

  console.log("Availability reminder cron job started (every 15 minutes)");
}
