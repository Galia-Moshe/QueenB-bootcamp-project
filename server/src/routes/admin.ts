import { Router } from "express";
import { isAdmin, requireAuth } from "../middleware/auth";
import { Meeting, meetingStatuses } from "../models/Meeting";
import { MentorProfile } from "../models/MentorProfile";
import { User } from "../models/User";

const router = Router();

router.use(requireAuth, isAdmin);

router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    return res.json({ users });
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
        $group: {
          _id: null,
          totalMentees: {
            $sum: {
              $cond: [{ $eq: [{ $size: "$mentorProfile" }, 0] }, 1, 0],
            },
          },
          totalDualRole: {
            $sum: {
              $cond: [{ $gt: [{ $size: "$mentorProfile" }, 0] }, 1, 0],
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
    // All MentorProfiles joined with User to count how many mentors
    // have actually mentored (mentoringSessionsCount > 0).
    const mentorStatsResult = await MentorProfile.aggregate<{
      totalMentors: number;
      activeMentors: number;
    }>([
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
    // Top topics from MentorProfile; top tech stacks & languages from linked User docs.
    const demandResult = await MentorProfile.aggregate<{
      topics: Array<{ name: string; count: number }>;
      techStacks: Array<{ name: string; count: number }>;
      programmingLanguages: Array<{ name: string; count: number }>;
    }>([
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
    // Mentor ratio = % of all users who have a MentorProfile.
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
