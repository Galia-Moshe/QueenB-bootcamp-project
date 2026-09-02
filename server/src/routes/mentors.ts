import { Router } from "express";
import { MentorProfile } from "../models/MentorProfile";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { normalizeStringList, sanitizeUser } from "../utils/users";

const router = Router();

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const mentorProfiles = await MentorProfile.find()
      .populate("userId", "-passwordHash")
      .sort({ updatedAt: -1 });

    return res.json({ mentors: mentorProfiles });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const mentorProfile = await MentorProfile.findOne({ userId: req.user!._id });
    return res.json({ mentorProfile });
  } catch (error) {
    next(error);
  }
});

router.post("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { background, topics, maxMeetings, meetingLength } = req.body;

    const mentorProfile = await MentorProfile.findOneAndUpdate(
      { userId: req.user!._id },
      {
        userId: req.user!._id,
        background,
        topics: normalizeStringList(topics),
        maxMeetings,
        meetingLength,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).populate("userId", "-passwordHash");

    return res.json({ mentorProfile, user: sanitizeUser(req.user!) });
  } catch (error) {
    next(error);
  }
});

export default router;
