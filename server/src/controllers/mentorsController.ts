import type { Request, Response, NextFunction } from "express";
import type { PipelineStage } from "mongoose";
import { MentorProfile } from "../models/MentorProfile";

const ACTIVE_MEETING_STATUSES = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "attendance_confirmed",
] as const;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

type MentorsQuery = {
  search?: string;
  jobTitle?: string;
  topics?: string | string[];
  minYears?: string;
  maxYears?: string;
  availability?: string;
  page?: string;
  limit?: string;
};

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTopics(topics: string | string[] | undefined) {
  if (!topics) {
    return [];
  }

  const raw = Array.isArray(topics) ? topics : topics.split(",");
  return raw.map((topic) => topic.trim()).filter(Boolean);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Lists mentors via aggregation: MentorProfile → User lookup → filters → pagination.
 * Designed so recommendation scoring stages can be inserted before $facet later.
 */
export async function listMentors(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      search,
      jobTitle,
      topics,
      minYears,
      maxYears,
      availability,
      page: pageParam,
      limit: limitParam,
    } = req.query as MentorsQuery;

    const page = parsePositiveInt(pageParam, DEFAULT_PAGE);
    const limit = Math.min(parsePositiveInt(limitParam, DEFAULT_LIMIT), MAX_LIMIT);
    const skip = (page - 1) * limit;

    const selectedTopics = parseTopics(topics);
    const minExperience = parseOptionalNumber(minYears);
    const maxExperience = parseOptionalNumber(maxYears);
    const availabilityOnly = availability === "true" || availability === "1";

    const matchStage: Record<string, unknown> = {};

    if (typeof search === "string" && search.trim()) {
      matchStage["user.username"] = {
        $regex: escapeRegex(search.trim()),
        $options: "i",
      };
    }

    if (typeof jobTitle === "string" && jobTitle.trim()) {
      matchStage["user.jobTitle"] = {
        $regex: `^${escapeRegex(jobTitle.trim())}$`,
        $options: "i",
      };
    }

    if (selectedTopics.length > 0) {
      matchStage.topics = { $in: selectedTopics };
    }

    if (minExperience !== undefined || maxExperience !== undefined) {
      const yearsFilter: Record<string, number> = {};
      if (minExperience !== undefined) {
        yearsFilter.$gte = minExperience;
      }
      if (maxExperience !== undefined) {
        yearsFilter.$lte = maxExperience;
      }
      matchStage["user.yearsOfExperience"] = yearsFilter;
    }

    if (availabilityOnly) {
      matchStage.hasAvailability = true;
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          approvalStatus: "approved",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: "availabilitywindows",
          localField: "userId",
          foreignField: "mentorId",
          as: "availabilityWindows",
        },
      },
      {
        $lookup: {
          from: "meetings",
          let: { mentorUserId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$mentorId", "$$mentorUserId"] },
                    { $in: ["$status", [...ACTIVE_MEETING_STATUSES]] },
                  ],
                },
              },
            },
          ],
          as: "activeMeetings",
        },
      },
      {
        $addFields: {
          activeMeetingCount: { $size: "$activeMeetings" },
          futureAvailabilityCount: {
            $size: {
              $filter: {
                input: "$availabilityWindows",
                as: "window",
                cond: { $gte: ["$$window.date", todayIsoDate()] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          // Available when future slots exist and capacity (maxMeetings) is not exhausted.
          hasAvailability: {
            $and: [
              { $gt: ["$futureAvailabilityCount", 0] },
              {
                $or: [
                  { $eq: [{ $type: "$maxMeetings" }, "missing"] },
                  { $eq: ["$maxMeetings", null] },
                  { $lt: ["$activeMeetingCount", "$maxMeetings"] },
                ],
              },
            ],
          },
        },
      },
    ];

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      { $sort: { updatedAt: -1 as const } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                background: 1,
                topics: 1,
                maxMeetings: 1,
                meetingLength: 1,
                createdAt: 1,
                updatedAt: 1,
                hasAvailability: 1,
                // Keep populate-compatible shape for the client MentorCard.
                userId: {
                  _id: "$user._id",
                  email: "$user.email",
                  username: "$user.username",
                  role: "$user.role",
                  programmingLanguages: "$user.programmingLanguages",
                  techStack: "$user.techStack",
                  jobTitle: "$user.jobTitle",
                  company: "$user.company",
                  yearsOfExperience: "$user.yearsOfExperience",
                  profilePicture: "$user.profilePicture",
                  githubLink: "$user.githubLink",
                  linkedinLink: "$user.linkedinLink",
                  mentoringSessionsCount: "$user.mentoringSessionsCount",
                  menteeSessionsCount: "$user.menteeSessionsCount",
                  createdAt: "$user.createdAt",
                  updatedAt: "$user.updatedAt",
                },
              },
            },
          ],
          meta: [{ $count: "total" }],
        },
      }
    );

    const [result] = await MentorProfile.aggregate(pipeline);
    const mentors = result?.data ?? [];
    const total = result?.meta?.[0]?.total ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return res.json({
      mentors,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}
