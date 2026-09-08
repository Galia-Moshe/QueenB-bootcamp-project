import { Router } from "express";
import { Notification } from "../models/Notification";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user!._id }).sort({
      createdAt: -1,
    });

    return res.json({ notifications });
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
