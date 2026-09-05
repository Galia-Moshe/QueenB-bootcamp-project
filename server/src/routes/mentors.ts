import { Router } from "express";
import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { MentorProfile } from "../models/MentorProfile";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { normalizeStringList, sanitizeUser } from "../utils/users";

const router = Router();

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

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
    const { background, topics, maxMeetings, meetingLength, jobTitle, company } = req.body;

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

    if (jobTitle !== undefined || company !== undefined) {
      req.user!.jobTitle = jobTitle || undefined;
      req.user!.company = company || undefined;
      await req.user!.save();
    }

    return res.json({ mentorProfile, user: sanitizeUser(req.user!) });
  } catch (error) {
    next(error);
  }
});

router.get("/me/availability", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const availabilityWindows = await AvailabilityWindow.find({ mentorId: req.user!._id }).sort({
      date: 1,
      startTime: 1,
    });

    return res.json({ availabilityWindows });
  } catch (error) {
    next(error);
  }
});

router.post("/me/availability", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { date, startTime, endTime, meetingLength } = req.body;

    if (!isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: "יש להזין תאריך ושעות תקינים" });
    }

    const length = Number(meetingLength);
    if (!length || length <= 0) {
      return res.status(400).json({ error: "יש לבחור אורך פגישה תקין" });
    }

    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return res.status(400).json({ error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" });
    }

    if (toMinutes(endTime) - toMinutes(startTime) < length) {
      return res.status(400).json({ error: "טווח הזמן קצר מאורך הפגישה שנבחר" });
    }

    const availabilityWindow = await AvailabilityWindow.create({
      mentorId: req.user!._id,
      date,
      startTime,
      endTime,
      meetingLength: length,
    });

    return res.status(201).json({ availabilityWindow });
  } catch (error) {
    next(error);
  }
});

router.put("/me/availability/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { date, startTime, endTime, meetingLength } = req.body;

    if (!isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: "יש להזין תאריך ושעות תקינים" });
    }

    const length = Number(meetingLength);
    if (!length || length <= 0) {
      return res.status(400).json({ error: "יש לבחור אורך פגישה תקין" });
    }

    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return res.status(400).json({ error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" });
    }

    if (toMinutes(endTime) - toMinutes(startTime) < length) {
      return res.status(400).json({ error: "טווח הזמן קצר מאורך הפגישה שנבחר" });
    }

    const availabilityWindow = await AvailabilityWindow.findOne({
      _id: req.params.id,
      mentorId: req.user!._id,
    });

    if (!availabilityWindow) {
      return res.status(404).json({ error: "חלון הזמינות לא נמצא" });
    }

    availabilityWindow.date = date;
    availabilityWindow.startTime = startTime;
    availabilityWindow.endTime = endTime;
    availabilityWindow.meetingLength = length;
    await availabilityWindow.save();

    return res.json({ availabilityWindow });
  } catch (error) {
    next(error);
  }
});

router.delete("/me/availability/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const availabilityWindow = await AvailabilityWindow.findOneAndDelete({
      _id: req.params.id,
      mentorId: req.user!._id,
    });

    if (!availabilityWindow) {
      return res.status(404).json({ error: "חלון הזמינות לא נמצא" });
    }

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
