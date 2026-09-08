import cron from "node-cron";
import type { HydratedDocument } from "mongoose";
import { Meeting, type MeetingDocument } from "../models/Meeting";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { getMeetingEndTime } from "../utils/meetingTime";

const MENTOR_POST_MEETING_NOTIFICATION_TYPE = "mentor_post_meeting_thank_you" as const;

function formatMeetingDateTime(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function postMeetingNotificationNotSentFilter() {
  return [
    { mentorPostMeetingNotificationSentAt: { $exists: false } },
    { mentorPostMeetingNotificationSentAt: null },
  ];
}

async function sendMentorPostMeetingNotification(
  meeting: HydratedDocument<MeetingDocument>,
  now: Date
) {
  const mentee = await User.findById(meeting.menteeId).select("username");
  const menteeName = mentee?.username.trim();

  if (!menteeName) {
    return false;
  }

  const claimed = await Meeting.findOneAndUpdate(
    {
      _id: meeting._id,
      status: "scheduled",
      selectedTime: meeting.selectedTime,
      $or: postMeetingNotificationNotSentFilter(),
    },
    { $set: { mentorPostMeetingNotificationSentAt: now } },
    { new: true }
  );

  if (!claimed) {
    return false;
  }

  await Notification.create({
    recipient: claimed.mentorId,
    type: MENTOR_POST_MEETING_NOTIFICATION_TYPE,
    meetingId: claimed._id,
    message: `תודה שהשקעת מזמנך לתת ייעוץ ל${menteeName} 💜\nאם תרצי לכתוב סיכום לפגישה הזו, לחצי כאן.`,
    actionUrl: `/profile?role=mentor&summaryMeetingId=${String(claimed._id)}`,
    actionStatus: "pending",
  });

  return true;
}

/**
 * Every minute: find scheduled meetings whose end time
 * (selectedTime + duration) has passed, send attendance-check
 * notifications to mentor and mentee, send a mentor thank-you,
 * and set the corresponding sent timestamps.
 */
export function startAttendanceCheckJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const candidates = await Meeting.find({
        status: "scheduled",
        selectedTime: { $exists: true, $lte: now },
        $or: [
          { attendancePromptedAt: { $exists: false } },
          ...postMeetingNotificationNotSentFilter(),
        ],
      });

      let promptedCount = 0;
      let thankedMentorCount = 0;

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

        if (claimed) {
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

        if (await sendMentorPostMeetingNotification(meeting, now)) {
          thankedMentorCount += 1;
        }
      }

      if (promptedCount > 0) {
        console.log(`Attendance check: prompted ${promptedCount} meeting(s)`);
      }
      if (thankedMentorCount > 0) {
        console.log(`Post-meeting thank-you: notified ${thankedMentorCount} mentor(s)`);
      }
    } catch (error) {
      console.error("Attendance check job failed", error);
    }
  });

  console.log("Attendance check cron job started (every minute, at meeting end)");
}

/**
 * Every 15 minutes: find attendance-confirmed / feedback_submitted meetings
 * whose feedback reminder is due, notify participants who still owe feedback,
 * and reschedule feedbackReminderAt +48h until both have submitted.
 */
export function startFeedbackReminderJob() {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const now = new Date();

      const meetings = await Meeting.find({
        status: { $in: ["attendance_confirmed", "feedback_submitted"] },
        feedbackReminderAt: { $exists: true, $lte: now },
      });

      let notifiedCount = 0;

      for (const meeting of meetings) {
        // Claim this due reminder so concurrent cron ticks don't double-send.
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

        const recipients = [claimed.mentorId, claimed.menteeId].filter((userId) => {
          return !claimed.feedbacks.some(
            (feedback) => String(feedback.fromUserId) === String(userId)
          );
        });

        if (recipients.length === 0) {
          // Both submitted — leave feedbackReminderAt cleared.
          continue;
        }

        const when = claimed.selectedTime
          ? formatMeetingDateTime(claimed.selectedTime)
          : "הפגישה";
        const message = `תזכורת: נשמח לשמוע איך היה! אפשר למלא משוב על הפגישה מ-${when}`;

        await Notification.create(
          recipients.map((recipient) => ({
            recipient,
            type: "feedback_reminder" as const,
            meetingId: claimed._id,
            message,
            actionStatus: "pending" as const,
          }))
        );

        await Meeting.updateOne(
          { _id: claimed._id },
          { $set: { feedbackReminderAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } }
        );

        notifiedCount += 1;
      }

      if (notifiedCount > 0) {
        console.log(`Feedback reminder: notified for ${notifiedCount} meeting(s)`);
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
