import { Router } from "express";
import mongoose from "mongoose";
import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { Meeting } from "../models/Meeting";
import { MentorProfile } from "../models/MentorProfile";
import { Notification } from "../models/Notification";
import { listMentors } from "../controllers/mentorsController";
import { User } from "../models/User";
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

/**
 * A mentee may request additional availability from a mentor once per "scheduling attempt".
 * There's no dedicated attempt entity — a new attempt is recognized whenever a Meeting between
 * this mentee and mentor was created after her last request (regardless of that meeting's
 * outcome). If no Meeting exists yet, or the latest one predates her last request, she's still
 * mid-attempt and may not ask again.
 */
async function canRequestAdditionalAvailability(mentorId: unknown, menteeId: unknown) {
  const lastRequest = await Notification.findOne({
    recipient: mentorId,
    fromUserId: menteeId,
    type: "additional_availability_request",
  }).sort({ createdAt: -1 });

  if (!lastRequest) {
    return true;
  }

  const lastMeeting = await Meeting.findOne({ mentorId, menteeId }).sort({ createdAt: -1 });

  return Boolean(lastMeeting && lastMeeting.createdAt! > lastRequest.createdAt!);
}

/**
 * Whether the mentee's most recent additional-availability request to this mentor is still
 * awaiting the mentor's response. Reuses the same actionStatus the mentor's notification actions
 * already set (PATCH /notifications/:id/additional-availability-response) rather than adding any
 * new field — "pending" means still waiting, "answered" means she already said added/cannot_add.
 */
async function hasPendingAdditionalAvailabilityRequest(mentorId: unknown, menteeId: unknown) {
  const lastRequest = await Notification.findOne({
    recipient: mentorId,
    fromUserId: menteeId,
    type: "additional_availability_request",
  }).sort({ createdAt: -1 });

  return lastRequest?.actionStatus === "pending";
}

/**
 * Mirrors the qualifying-cancellation rule enforced in POST /meetings/from-availability
 * (server/src/routes/meetings.ts): a mentee who canceled 2 of her own approved meetings with a
 * mentor may never book her again. Reused here so a mentee who's already blocked from scheduling
 * with a mentor can't still ask that mentor for additional availability.
 */
async function hasReachedMenteeCancellationLimit(mentorId: unknown, menteeId: unknown) {
  const qualifyingCancellations = await Meeting.countDocuments({
    mentorId,
    menteeId,
    status: "canceled",
    canceledBy: "mentee",
  });

  return qualifyingCancellations >= 2;
}

router.get("/", requireAuth, listMentors);

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const mentorProfile = await MentorProfile.findOne({ userId: req.user!._id });
    return res.json({
      mentorProfile,
      programmingLanguages: req.user!.programmingLanguages || [],
    });
  } catch (error) {
    next(error);
  }
});

router.post("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const {
      background,
      topics,
      maxMeetings,
      meetingLength,
      jobTitle,
      company,
      programmingLanguages,
    } = req.body;

    const existingProfile = await MentorProfile.findOne({ userId: req.user!._id });
    const wasApproved = existingProfile?.approvalStatus === "approved";

    const mentorProfile = await MentorProfile.findOneAndUpdate(
      { userId: req.user!._id },
      {
        userId: req.user!._id,
        background,
        topics: normalizeStringList(topics),
        maxMeetings,
        meetingLength,
        ...(wasApproved
          ? {}
          : {
              approvalStatus: "pending",
              rejectionReason: null,
              isViewedByAdmin: false,
            }),
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).populate("userId", "-passwordHash");

    if (
      jobTitle !== undefined ||
      company !== undefined ||
      programmingLanguages !== undefined
    ) {
      if (jobTitle !== undefined) {
        req.user!.jobTitle = jobTitle || undefined;
      }
      if (company !== undefined) {
        req.user!.company = company || undefined;
      }
      if (programmingLanguages !== undefined) {
        req.user!.programmingLanguages = normalizeStringList(programmingLanguages);
      }
      await req.user!.save();
    }

    // Notify admins only for new/pending applications (not approved profile edits).
    if (!wasApproved) {
      const admins = await User.find({ role: "admin" }).select("_id");
      if (admins.length > 0) {
        const applicantName = req.user!.username;
        await Notification.insertMany(
          admins.map((admin) => ({
            recipient: admin._id,
            type: "new_mentor_request" as const,
            message: `${applicantName} הגישה בקשה להפוך למנטורית וממתינה לאישור`,
            actionUrl: "/admin",
          }))
        );
      }
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
    const { date, startTime, endTime } = req.body;

    if (!isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: "יש להזין תאריך ושעות תקינים" });
    }

    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return res.status(400).json({ error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" });
    }

    const availabilityWindow = await AvailabilityWindow.create({
      mentorId: req.user!._id,
      date,
      startTime,
      endTime,
      status: "available",
    });

    return res.status(201).json({ availabilityWindow });
  } catch (error) {
    next(error);
  }
});

router.put("/me/availability/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { date, startTime, endTime } = req.body;

    if (!isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: "יש להזין תאריך ושעות תקינים" });
    }

    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return res.status(400).json({ error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" });
    }

    const availabilityWindow = await AvailabilityWindow.findOne({
      _id: req.params.id,
      mentorId: req.user!._id,
    });

    if (!availabilityWindow) {
      return res.status(404).json({ error: "חלון הזמינות לא נמצא" });
    }

    if (availabilityWindow.status !== "available") {
      return res.status(409).json({ error: "אי אפשר לערוך חלון זמינות שיש בו בקשה ממתינה או פגישה שנקבעה" });
    }

    availabilityWindow.date = date;
    availabilityWindow.startTime = startTime;
    availabilityWindow.endTime = endTime;
    await availabilityWindow.save();

    return res.json({ availabilityWindow });
  } catch (error) {
    next(error);
  }
});

router.delete("/me/availability/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const availabilityWindow = await AvailabilityWindow.findOne({
      _id: req.params.id,
      mentorId: req.user!._id,
    });

    if (!availabilityWindow) {
      return res.status(404).json({ error: "חלון הזמינות לא נמצא" });
    }

    if (availabilityWindow.status !== "available") {
      return res.status(409).json({ error: "אי אפשר למחוק חלון זמינות שיש בו בקשה ממתינה או פגישה שנקבעה" });
    }

    await availabilityWindow.deleteOne();

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get("/:mentorId/availability", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { mentorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).json({ error: "מזהה מנטורית לא תקין" });
    }

    const mentorUser = await User.findById(mentorId);
    if (!mentorUser) {
      return res.status(404).json({ error: "המנטורית לא נמצאה" });
    }

    const mentorProfile = await MentorProfile.findOne({
      userId: mentorId,
      approvalStatus: "approved",
    });
    if (!mentorProfile) {
      return res.status(404).json({ error: "המנטורית לא נמצאה" });
    }

    const availabilityWindows = await AvailabilityWindow.find({
      mentorId,
      status: "available",
    })
      .select("mentorId date startTime endTime status")
      .sort({ date: 1, startTime: 1 });

    const [canRequestMore, blockedByCancellationLimit, additionalAvailabilityRequestPending] =
      await Promise.all([
        canRequestAdditionalAvailability(mentorId, req.user!._id),
        hasReachedMenteeCancellationLimit(mentorId, req.user!._id),
        hasPendingAdditionalAvailabilityRequest(mentorId, req.user!._id),
      ]);

    return res.json({
      availabilityWindows,
      topics: mentorProfile.topics,
      canRequestAdditionalAvailability: canRequestMore,
      additionalAvailabilityRequestPending,
      blockedByCancellationLimit,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:mentorId/request-additional-availability",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const { mentorId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(mentorId)) {
        return res.status(400).json({ error: "מזהה מנטורית לא תקין" });
      }

      if (String(mentorId) === String(req.user!._id)) {
        return res.status(400).json({ error: "אי אפשר לשלוח בקשה לעצמך" });
      }

      const mentorProfile = await MentorProfile.findOne({
        userId: mentorId,
        approvalStatus: "approved",
      });
      if (!mentorProfile) {
        return res.status(404).json({ error: "המנטורית לא נמצאה" });
      }

      if (await hasReachedMenteeCancellationLimit(mentorId, req.user!._id)) {
        return res.status(409).json({
          error: "לא ניתן לקבוע פגישה נוספת עם המנטורית הזו לאחר ביטולים קודמים מצידך",
        });
      }

      const canRequestMore = await canRequestAdditionalAvailability(mentorId, req.user!._id);
      if (!canRequestMore) {
        return res.status(409).json({
          error: "כבר שלחת בקשה לזמנים נוספים למנטורית הזו עבור ניסיון התיאום הנוכחי",
        });
      }

      const notification = await Notification.create({
        recipient: mentorId,
        type: "additional_availability_request",
        fromUserId: req.user!._id,
        message: `${req.user!.username} מנסה לתאם איתך פגישה אך אף אחד מהזמנים הפנויים שלך לא מתאים לה. תוכלי להוסיף זמנים נוספים?`,
        actionStatus: "pending",
      });

      return res.status(201).json({ notification });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
