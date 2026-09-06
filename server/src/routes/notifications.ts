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

export default router;
