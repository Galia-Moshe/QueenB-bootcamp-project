import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/User";

const router = Router();

router.use(requireAuth);

router.get("/:userId", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ error: "המשתמשת לא נמצאה" });
    }

    return res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
