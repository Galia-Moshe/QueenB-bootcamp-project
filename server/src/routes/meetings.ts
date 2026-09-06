import { Router } from "express";
import mongoose from "mongoose";
import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { Meeting } from "../models/Meeting";
import { MentorProfile } from "../models/MentorProfile";
import { User } from "../models/User";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

function isSameId(first: unknown, second: unknown) {
  return String(first) === String(second);
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

router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { mentorId } = req.body;

    if (!mentorId || !mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).json({ error: "יש לבחור מנטורית תקינה" });
    }

    if (isSameId(mentorId, req.user!._id)) {
      return res.status(400).json({ error: "אי אפשר לבקש פגישה עם עצמך" });
    }

    const mentorProfile = await MentorProfile.findOne({ userId: mentorId });
    if (!mentorProfile) {
      return res.status(404).json({ error: "המנטורית לא נמצאה" });
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
    const { availabilityWindowId } = req.body;

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

    const mentorProfile = await MentorProfile.findOne({ userId: availabilityWindow.mentorId });
    if (!mentorProfile) {
      return res.status(404).json({ error: "המנטורית לא נמצאה" });
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

    try {
      const meeting = await Meeting.create({
        mentorId: claimedWindow.mentorId,
        menteeId: req.user!._id,
        status: "pending_mentor_times",
        availabilityWindowId: claimedWindow._id,
      });

      const populatedMeeting = await Meeting.findById(meeting._id)
        .populate("mentorId", "-passwordHash")
        .populate("menteeId", "-passwordHash")
        .populate("availabilityWindowId");

      return res.status(201).json({ meeting: populatedMeeting });
    } catch (creationError) {
      await AvailabilityWindow.findOneAndUpdate(
        { _id: availabilityWindowId, status: "pending" },
        { $set: { status: "available" } }
      );
      throw creationError;
    }
  } catch (error) {
    next(error);
  }
});

router.get("/my", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const role = req.query.role;
    const filter =
      role === "mentor"
        ? { mentorId: req.user!._id }
        : { menteeId: req.user!._id };

    const meetings = await populateMeeting(Meeting.find(filter));
    return res.json({ meetings });
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
    await meeting.save();

    await User.findByIdAndUpdate(meeting.mentorId, { $inc: { mentoringSessionsCount: 1 } });
    await User.findByIdAndUpdate(meeting.menteeId, { $inc: { menteeSessionsCount: 1 } });

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash");

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

    if (!isSameId(meeting.mentorId, req.user!._id) && !isSameId(meeting.menteeId, req.user!._id)) {
      return res.status(403).json({ error: "אין לך הרשאה לעדכן את הפגישה הזו" });
    }

    meeting.status = "canceled";
    await meeting.save();

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("mentorId", "-passwordHash")
      .populate("menteeId", "-passwordHash");

    return res.json({ meeting: populatedMeeting });
  } catch (error) {
    next(error);
  }
});

export default router;
