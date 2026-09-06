import { Router } from "express";
import mongoose from "mongoose";
import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { Meeting } from "../models/Meeting";
import { MentorProfile } from "../models/MentorProfile";
import { Notification } from "../models/Notification";
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

function formatWindowDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
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

    let populatedMeeting;

    try {
      const meeting = await Meeting.create({
        mentorId: claimedWindow.mentorId,
        menteeId: req.user!._id,
        status: "pending_mentor_times",
        availabilityWindowId: claimedWindow._id,
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

    const scheduledMeeting = await Meeting.findOneAndUpdate(
      { _id: meeting._id, status: "pending_mentor_times" },
      { $set: { status: "scheduled", selectedTime } },
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

    if (!isSameId(meeting.menteeId, req.user!._id)) {
      return res.status(403).json({ error: "רק המנטית של הפגישה יכולה לבטל אותה" });
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

    // Atomically release the slot: only the cancellation that finds it still "booked" may proceed.
    const releasedWindow = await AvailabilityWindow.findOneAndUpdate(
      { _id: availabilityWindow._id, status: "booked" },
      { $set: { status: "available" } },
      { new: true }
    );

    if (!releasedWindow) {
      return res.status(409).json({ error: "הפגישה כבר טופלה" });
    }

    const canceledMeeting = await Meeting.findOneAndUpdate(
      { _id: meeting._id, status: "scheduled" },
      { $set: { status: "canceled" } },
      { new: true }
    );

    if (!canceledMeeting) {
      // The meeting moved out of the scheduled state concurrently: undo the window release
      // rather than leaving an "available" window whose meeting was never actually canceled.
      // Guarded on "available" so it never clobbers a slot another mentee has since re-booked.
      await AvailabilityWindow.findOneAndUpdate(
        { _id: releasedWindow._id, status: "available" },
        { $set: { status: "booked" } }
      );
      return res.status(409).json({ error: "הפגישה כבר טופלה" });
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
