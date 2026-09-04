import { Router } from "express";
import { isAdmin, requireAuth } from "../middleware/auth";
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

export default router;
