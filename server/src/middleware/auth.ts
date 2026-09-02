import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { HydratedDocument } from "mongoose";
import { User, type UserDocument } from "../models/User";

type JwtPayload = {
  userId: string;
};

export type AuthRequest = Request & {
  user?: HydratedDocument<UserDocument>;
};

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      return res.status(401).json({ error: "נדרשת התחברות" });
    }

    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({ error: "המשתמשת לא נמצאה" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "טוקן לא תקין" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "נדרשת הרשאת אדמין" });
  }

  next();
}
