import { Router } from "express";
import { Notification } from "../models/Notification";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

router.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const recipient = req.user!._id;
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = { recipient };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return res.json({
      notifications,
      unreadCount,
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
});

router.patch("/:id/read", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: "ההתראה לא נמצאה" });
    }

    if (String(notification.recipient) !== String(req.user!._id)) {
      return res.status(403).json({ error: "אין לך הרשאה לעדכן את ההתראה הזו" });
    }

    notification.read = true;
    await notification.save();

    return res.json({ notification });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id/additional-availability-response",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const notification = await Notification.findById(req.params.id);

      if (!notification) {
        return res.status(404).json({ error: "ההתראה לא נמצאה" });
      }

      if (String(notification.recipient) !== String(req.user!._id)) {
        return res.status(403).json({ error: "אין לך הרשאה לעדכן את ההתראה הזו" });
      }

      if (notification.type !== "additional_availability_request") {
        return res.status(400).json({ error: "לא ניתן להגיב להתראה מסוג זה" });
      }

      if (notification.actionStatus !== "pending") {
        return res.status(409).json({ error: "כבר הגבת לבקשה הזו" });
      }

      const response = req.body.response;
      if (response !== "added" && response !== "cannot_add") {
        return res.status(400).json({ error: "יש לציין תגובה תקינה" });
      }

      if (!notification.fromUserId) {
        return res.status(400).json({ error: "לא ניתן לזהות את המנטית ששלחה את הבקשה" });
      }

      notification.actionStatus = "answered";
      notification.read = true;
      await notification.save();

      await Notification.create({
        recipient: notification.fromUserId,
        type: response === "added" ? "additional_availability_added" : "additional_availability_unavailable",
        message:
          response === "added"
            ? `${req.user!.username} הוסיפה זמנים נוספים ליומן שלה. אפשר לבדוק את הזמינות המעודכנת שלה.`
            : `${req.user!.username} הודיעה שהיא לא יכולה להוסיף זמנים נוספים כרגע.`,
      });

      return res.json({ notification });
    } catch (error) {
      next(error);
    }
  }
);

router.patch("/read-all", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user!._id, read: false },
      { $set: { read: true } }
    );

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await Notification.deleteMany({ recipient: req.user!._id });
    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: "ההתראה לא נמצאה" });
    }

    if (String(notification.recipient) !== String(req.user!._id)) {
      return res.status(403).json({ error: "אין לך הרשאה למחוק את ההתראה הזו" });
    }

    await notification.deleteOne();

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
