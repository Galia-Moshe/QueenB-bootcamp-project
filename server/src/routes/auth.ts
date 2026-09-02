import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { normalizeStringList, sanitizeUser } from "../utils/users";

const router = Router();

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

function createToken(userId: unknown) {
  return jwt.sign({ userId: String(userId) }, getJwtSecret(), { expiresIn: "7d" });
}

router.post("/register", async (req, res, next) => {
  try {
    const {
      email,
      password,
      username,
      programmingLanguages,
      techStack,
      jobTitle,
      company,
      yearsOfExperience,
      profilePicture,
      githubLink,
      linkedinLink,
    } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: "יש למלא שם משתמשת, מייל וסיסמה" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "קיימת כבר משתמשת עם המייל הזה" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      passwordHash,
      username,
      programmingLanguages: normalizeStringList(programmingLanguages),
      techStack: normalizeStringList(techStack),
      jobTitle,
      company,
      yearsOfExperience,
      profilePicture,
      githubLink,
      linkedinLink,
    });

    return res.status(201).json({
      token: createToken(user._id),
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: "קיימת כבר משתמשת עם המייל הזה" });
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "יש למלא מייל וסיסמה" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "פרטי ההתחברות אינם נכונים" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "פרטי ההתחברות אינם נכונים" });
    }

    return res.json({
      token: createToken(user._id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  return res.json({ user: sanitizeUser(req.user!) });
});

export default router;
