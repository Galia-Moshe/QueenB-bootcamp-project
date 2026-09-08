import { Router } from "express";
import mongoose from "mongoose";
import { isAdmin, requireAuth } from "../middleware/auth";
import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { Meeting, meetingStatuses } from "../models/Meeting";
import { MentorProfile } from "../models/MentorProfile";
import { Notification } from "../models/Notification";
import { User } from "../models/User";

const router = Router();

const DEFAULT_MEETING_DURATION_MINUTES = 60;
const MISSING_FEEDBACK_DAYS = 7;
const OUTSTANDING_MENTOR_SESSION_THRESHOLD = 10;

async function getMeetingEndTime(meeting: {
  selectedTime?: Date;
  mentorId: unknown;
  availabilityWindowId?: unknown;
}): Promise<Date | null> {
  if (!meeting.selectedTime) {
    return null;
  }

  if (meeting.availabilityWindowId) {
    const windowId =
      meeting.availabilityWindowId &&
      typeof meeting.availabilityWindowId === "object" &&
      "_id" in (meeting.availabilityWindowId as object)
        ? (meeting.availabilityWindowId as { _id: unknown })._id
        : meeting.availabilityWindowId;
    const window = await AvailabilityWindow.findById(windowId);
    if (window) {
      return new Date(`${window.date}T${window.endTime}:00`);
    }
  }

  const mentorUserId =
    meeting.mentorId &&
    typeof meeting.mentorId === "object" &&
    "_id" in (meeting.mentorId as object)
      ? (meeting.mentorId as { _id: unknown })._id
      : meeting.mentorId;

  const mentorProfile = await MentorProfile.findOne({ userId: mentorUserId });
  const durationMinutes =
    mentorProfile?.meetingLength && mentorProfile.meetingLength > 0
      ? mentorProfile.meetingLength
      : DEFAULT_MEETING_DURATION_MINUTES;

  return new Date(meeting.selectedTime.getTime() + durationMinutes * 60 * 1000);
}

router.use(requireAuth, isAdmin);

router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    return res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.get("/mentors/requests", async (_req, res, next) => {
  try {
    const requests = await MentorProfile.find({ approvalStatus: "pending" })
      .populate("userId", "-passwordHash")
      .sort({ createdAt: -1 });

    const unviewedCount = await MentorProfile.countDocuments({
      approvalStatus: "pending",
      isViewedByAdmin: false,
    });

    return res.json({
      requests,
      unviewedCount,
      hasUnviewed: unviewedCount > 0,
    });
  } catch (error) {
    next(error);
  }
});

router.put("/mentors/requests/mark-viewed", async (_req, res, next) => {
  try {
    const result = await MentorProfile.updateMany(
      { approvalStatus: "pending", isViewedByAdmin: false },
      { $set: { isViewedByAdmin: true } }
    );

    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.put("/mentors/requests/:id/approve", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "מזהה בקשה לא תקין" });
    }

    const mentorProfile = await MentorProfile.findById(id);

    if (!mentorProfile) {
      return res.status(404).json({ error: "בקשת המנטורית לא נמצאה" });
    }

    if (mentorProfile.approvalStatus !== "pending") {
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    mentorProfile.approvalStatus = "approved";
    mentorProfile.rejectionReason = null;
    mentorProfile.isViewedByAdmin = true;
    await mentorProfile.save();

    await Notification.create({
      recipient: mentorProfile.userId,
      type: "mentor_approved",
      message: "בקשתך להפוך למנטורית אושרה! אפשר להתחיל לקבל פגישות.",
      actionUrl: "/",
    });

    const populated = await MentorProfile.findById(mentorProfile._id).populate(
      "userId",
      "-passwordHash"
    );

    return res.json({ mentorProfile: populated });
  } catch (error) {
    next(error);
  }
});

router.put("/mentors/requests/:id/reject", async (req, res, next) => {
  try {
    const { id } = req.params;
    const rejectionReason =
      typeof req.body?.rejectionReason === "string" ? req.body.rejectionReason.trim() : "";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "מזהה בקשה לא תקין" });
    }

    const mentorProfile = await MentorProfile.findById(id);

    if (!mentorProfile) {
      return res.status(404).json({ error: "בקשת המנטורית לא נמצאה" });
    }

    if (mentorProfile.approvalStatus !== "pending") {
      return res.status(409).json({ error: "הבקשה כבר טופלה" });
    }

    mentorProfile.approvalStatus = "rejected";
    mentorProfile.rejectionReason = rejectionReason || null;
    mentorProfile.isViewedByAdmin = true;
    await mentorProfile.save();

    const reasonSuffix = rejectionReason ? `סיבה: ${rejectionReason}` : "";
    await Notification.create({
      recipient: mentorProfile.userId,
      type: "mentor_rejected",
      message: `בקשתך להפוך למנטורית נדחתה.${reasonSuffix}`,
      actionUrl: "/mentor-profile",
    });

    const populated = await MentorProfile.findById(mentorProfile._id).populate(
      "userId",
      "-passwordHash"
    );

    return res.json({ mentorProfile: populated });
  } catch (error) {
    next(error);
  }
});

router.get("/meetings", async (req, res, next) => {
  try {
    const { status, userId, mentorId } = req.query;
    const filter: Record<string, unknown> = {};

    if (typeof status === "string" && status) {
      filter.status = status;
    }

    if (typeof mentorId === "string" && mentorId) {
      filter.mentorId = mentorId;
    } else if (typeof userId === "string" && userId) {
      filter.$or = [{ mentorId: userId }, { menteeId: userId }];
    }

    const meetings = await Meeting.find(filter)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("feedbacks.fromUserId", "-passwordHash")
      .sort({ updatedAt: -1 });

    return res.json({ meetings });
  } catch (error) {
    next(error);
  }
});

router.patch("/meetings/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;

    if (typeof status !== "string" || !meetingStatuses.includes(status as (typeof meetingStatuses)[number])) {
      return res.status(400).json({ error: "סטטוס הפגישה אינו תקין" });
    }

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "הפגישה לא נמצאה" });
    }

    meeting.status = status as (typeof meetingStatuses)[number];
    await meeting.save();

    if (status !== "attendance_confirmed") {
      await Meeting.updateOne({ _id: meeting._id }, { $unset: { feedbackReminderAt: 1 } });
    }

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash")
      .populate("feedbacks.fromUserId", "-passwordHash");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

router.get("/alerts", async (_req, res, next) => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - MISSING_FEEDBACK_DAYS * 24 * 60 * 60 * 1000);

    const [disputes, attendanceConfirmedCandidates, outstandingMentors] = await Promise.all([
      Meeting.find({ status: "disputed" })
        .populate("mentorId", "username email mentoringSessionsCount")
        .populate("menteeId", "username email menteeSessionsCount")
        .sort({ updatedAt: -1 }),
      Meeting.find({
        status: "attendance_confirmed",
        selectedTime: { $exists: true, $lt: oneWeekAgo },
      })
        .populate("mentorId", "username email")
        .populate("menteeId", "username email")
        .sort({ selectedTime: 1 }),
      User.find({ mentoringSessionsCount: { $gt: OUTSTANDING_MENTOR_SESSION_THRESHOLD } })
        .select("-passwordHash")
        .sort({ mentoringSessionsCount: -1 }),
    ]);

    const missingFeedback: typeof attendanceConfirmedCandidates = [];
    for (const meeting of attendanceConfirmedCandidates) {
      const endTime = await getMeetingEndTime(meeting);
      if (endTime && endTime.getTime() < oneWeekAgo.getTime()) {
        missingFeedback.push(meeting);
      }
    }

    return res.json({
      disputes,
      missingFeedback,
      outstandingMentors,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/statistics", async (_req, res, next) => {
  try {
    // --- Step 1: Mentee Statistics ---
    // Users who booked at least one meeting as mentees, joined with MentorProfile
    // to distinguish pure mentees from dual-role (mentor + mentee) users.
    const menteeStatsResult = await User.aggregate<{
      totalMentees: number;
      totalDualRole: number;
    }>([
      { $match: { menteeSessionsCount: { $gt: 0 } } },
      {
        $lookup: {
          from: MentorProfile.collection.name,
          localField: "_id",
          foreignField: "userId",
          as: "mentorProfile",
        },
      },
      {
        $addFields: {
          approvedMentorProfile: {
            $filter: {
              input: "$mentorProfile",
              as: "profile",
              cond: { $eq: ["$$profile.approvalStatus", "approved"] },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalMentees: {
            $sum: {
              $cond: [{ $eq: [{ $size: "$approvedMentorProfile" }, 0] }, 1, 0],
            },
          },
          totalDualRole: {
            $sum: {
              $cond: [{ $gt: [{ $size: "$approvedMentorProfile" }, 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    const menteeStats = menteeStatsResult[0] ?? {
      totalMentees: 0,
      totalDualRole: 0,
    };

    // --- Step 2: Mentor Statistics ---
    // Approved MentorProfiles joined with User to count how many mentors
    // have actually mentored (mentoringSessionsCount > 0).
    const mentorStatsResult = await MentorProfile.aggregate<{
      totalMentors: number;
      activeMentors: number;
    }>([
      { $match: { approvalStatus: "approved" } },
      {
        $lookup: {
          from: User.collection.name,
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $group: {
          _id: null,
          totalMentors: { $sum: 1 },
          activeMentors: {
            $sum: {
              $cond: [{ $gt: ["$user.mentoringSessionsCount", 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    const mentorStats = mentorStatsResult[0] ?? {
      totalMentors: 0,
      activeMentors: 0,
    };

    // --- Step 3: Meeting Status Breakdown ---
    // Group all meetings by status and count each group.
    const statusCountsResult = await Meeting.aggregate<{
      _id: string;
      count: number;
    }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

    const byStatus = Object.fromEntries(
      meetingStatuses.map((status) => [status, 0])
    ) as Record<(typeof meetingStatuses)[number], number>;

    for (const row of statusCountsResult) {
      if (row._id in byStatus) {
        byStatus[row._id as (typeof meetingStatuses)[number]] = row.count;
      }
    }

    // --- Step 4: Time-Based Meeting Statistics ---
    // Count meetings created (createdAt) OR scheduled (selectedTime)
    // within the current calendar week (Mon–Sun) and current month.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const dayOfWeek = now.getDay(); // 0 = Sunday
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const [thisWeek, thisMonth] = await Promise.all([
      Meeting.countDocuments({
        $or: [{ createdAt: { $gte: startOfWeek } }, { selectedTime: { $gte: startOfWeek } }],
      }),
      Meeting.countDocuments({
        $or: [{ createdAt: { $gte: startOfMonth } }, { selectedTime: { $gte: startOfMonth } }],
      }),
    ]);

    // --- Step 5: Feedback & Quality ---
    // Response rate = feedback_submitted / (completed + feedback_submitted).
    // Meetings move from "completed" to "feedback_submitted", so both count as finished.
    // No numeric rating field exists on feedbacks yet → averageRating is null.
    const finishedMeetings = byStatus.completed + byStatus.feedback_submitted;
    const feedbackResponseRate =
      finishedMeetings === 0
        ? 0
        : Math.round((byStatus.feedback_submitted / finishedMeetings) * 1000) / 10;

    const averageRating: number | null = null;

    // --- Step 6: Trends & Demand ---
    // Top topics from approved MentorProfile; top tech stacks & languages from linked User docs.
    const demandResult = await MentorProfile.aggregate<{
      topics: Array<{ name: string; count: number }>;
      techStacks: Array<{ name: string; count: number }>;
      programmingLanguages: Array<{ name: string; count: number }>;
    }>([
      { $match: { approvalStatus: "approved" } },
      {
        $lookup: {
          from: User.collection.name,
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          topics: [
            { $unwind: "$topics" },
            { $group: { _id: "$topics", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, name: "$_id", count: 1 } },
          ],
          techStacks: [
            { $unwind: "$user.techStack" },
            { $group: { _id: "$user.techStack", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, name: "$_id", count: 1 } },
          ],
          programmingLanguages: [
            { $unwind: "$user.programmingLanguages" },
            { $group: { _id: "$user.programmingLanguages", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, name: "$_id", count: 1 } },
          ],
        },
      },
    ]);

    const demand = demandResult[0] ?? {
      topics: [],
      techStacks: [],
      programmingLanguages: [],
    };

    // --- Step 7: Bottlenecks & System Warnings ---
    // Cancellation rate = canceled / total meetings.
    // At capacity = mentors whose mentoringSessionsCount >= maxMeetings (when maxMeetings is set).
    const totalMeetings = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    const cancellationRate =
      totalMeetings === 0
        ? 0
        : Math.round((byStatus.canceled / totalMeetings) * 1000) / 10;

    const mentorsAtCapacityResult = await MentorProfile.aggregate<{ count: number }>([
      {
        $match: {
          approvalStatus: "approved",
          maxMeetings: { $exists: true, $ne: null, $gt: 0 },
        },
      },
      {
        $lookup: {
          from: User.collection.name,
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $match: {
          $expr: { $gte: ["$user.mentoringSessionsCount", "$maxMeetings"] },
        },
      },
      { $count: "count" },
    ]);

    const mentorsAtCapacity = mentorsAtCapacityResult[0]?.count ?? 0;

    // --- Step 8: Community Growth ---
    // New users this month (createdAt >= startOfMonth).
    // Mentor ratio = % of all users who have an approved MentorProfile.
    const [newUsersThisMonth, totalUsers] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments(),
    ]);

    const mentorToMenteeRatio =
      totalUsers === 0
        ? 0
        : Math.round((mentorStats.totalMentors / totalUsers) * 1000) / 10;

    return res.json({
      mentees: {
        totalMentees: menteeStats.totalMentees,
        totalDualRole: menteeStats.totalDualRole,
      },
      mentors: {
        activeMentors: mentorStats.activeMentors,
        totalMentors: mentorStats.totalMentors,
      },
      meetings: {
        byStatus,
        thisWeek,
        thisMonth,
      },
      feedback: {
        responseRate: feedbackResponseRate,
        averageRating,
      },
      demand: {
        topTopics: demand.topics,
        topTechStacks: demand.techStacks,
        topProgrammingLanguages: demand.programmingLanguages,
      },
      bottlenecks: {
        cancellationRate,
        mentorsAtCapacity,
      },
      growth: {
        newUsersThisMonth,
        mentorToMenteeRatio,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
