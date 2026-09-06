import { Router } from "express";
import { isAdmin, requireAuth } from "../middleware/auth";
import { Meeting } from "../models/Meeting";
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

export default router;
