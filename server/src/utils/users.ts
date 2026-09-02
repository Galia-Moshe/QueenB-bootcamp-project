import type { HydratedDocument } from "mongoose";
import type { UserDocument } from "../models/User";

export function sanitizeUser(user: HydratedDocument<UserDocument>) {
  const plainUser = user.toObject();
  const { passwordHash, ...safeUser } = plainUser;
  return safeUser;
}

export function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
