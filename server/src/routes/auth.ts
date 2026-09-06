import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import jwt from "jsonwebtoken";
import path from "path";
import { User } from "../models/User";
import { MentorProfile } from "../models/MentorProfile";
import { MenteeProfile } from "../models/MenteeProfile";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { normalizeStringList, sanitizeUser } from "../utils/users";

const router = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PROFILE_IMAGE_PUBLIC_PATH = "/uploads/profile-pictures";
const PROFILE_IMAGE_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "profile-pictures");
const PROFILE_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type ProfileImageDecodeResult =
  | {
      buffer: Buffer;
      extension: string;
    }
  | {
      error: string;
    };

type ProfileImageSaveResult =
  | {
      profilePicture: string;
    }
  | {
      error: string;
    };

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

function createToken(userId: unknown) {
  return jwt.sign({ userId: String(userId) }, getJwtSecret(), { expiresIn: "7d" });
}

function getOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function hasRequestField(body: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function isValidProfileUrl(value: string, allowedDomain: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      ["http:", "https:"].includes(url.protocol) &&
      (hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`))
    );
  } catch (_error) {
    return false;
  }
}

function parseOptionalPositiveInteger(value: unknown, fieldName: string, allowZero = false) {
  if (value === undefined || value === null || value === "") {
    return { value: undefined };
  }

  const numberValue = Number(value);
  const minValue = allowZero ? 0 : 1;

  if (!Number.isInteger(numberValue) || numberValue < minValue) {
    return { error: `${fieldName} חייב להיות מספר חיובי` };
  }

  return { value: numberValue };
}

function decodeProfileImage(value: unknown): ProfileImageDecodeResult {
  if (typeof value !== "string" || !value) {
    return { error: "יש לבחור תמונת פרופיל תקינה" };
  }

  const match = value.match(/^data:(image\/(?:gif|jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    return { error: "אפשר להעלות רק תמונות PNG, JPG, WEBP או GIF" };
  }

  const [, mimeType, base64Data] = match;
  const buffer = Buffer.from(base64Data, "base64");

  if (!buffer.length || buffer.length > PROFILE_IMAGE_MAX_BYTES) {
    return { error: "תמונת הפרופיל חייבת להיות עד 2MB" };
  }

  return {
    buffer,
    extension: PROFILE_IMAGE_EXTENSIONS[mimeType],
  };
}

async function saveProfileImage(value: unknown, userId: unknown): Promise<ProfileImageSaveResult> {
  const decoded = decodeProfileImage(value);

  if ("error" in decoded) {
    return { error: decoded.error };
  }

  await fs.mkdir(PROFILE_IMAGE_UPLOAD_DIR, { recursive: true });

  const fileName = `${String(userId)}-${randomUUID()}.${decoded.extension}`;
  const filePath = path.join(PROFILE_IMAGE_UPLOAD_DIR, fileName);

  await fs.writeFile(filePath, decoded.buffer);

  return {
    profilePicture: `${PROFILE_IMAGE_PUBLIC_PATH}/${fileName}`,
  };
}

async function deleteLocalProfileImage(profilePicture?: string) {
  if (!profilePicture?.startsWith(`${PROFILE_IMAGE_PUBLIC_PATH}/`)) {
    return;
  }

  const filePath = path.resolve(PROFILE_IMAGE_UPLOAD_DIR, path.basename(profilePicture));
  const relativePath = path.relative(PROFILE_IMAGE_UPLOAD_DIR, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return;
  }

  await fs.unlink(filePath).catch(() => undefined);
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

router.get("/me/profile", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const [mentorProfile, menteeProfile] = await Promise.all([
      MentorProfile.findOne({ userId: req.user!._id }),
      MenteeProfile.findOne({ userId: req.user!._id }),
    ]);

    return res.json({ user: sanitizeUser(req.user!), mentorProfile, menteeProfile });
  } catch (error) {
    next(error);
  }
});

router.patch("/me/profile", requireAuth, async (req: AuthRequest, res, next) => {
  let uploadedProfilePicture: string | undefined;

  try {
    const requestBody = req.body as Record<string, unknown>;
    const hasAccountPayload =
      hasRequestField(requestBody, "username") ||
      hasRequestField(requestBody, "email") ||
      hasRequestField(requestBody, "githubLink") ||
      hasRequestField(requestBody, "linkedinLink");
    const currentPassword =
      typeof requestBody.currentPassword === "string" ? requestBody.currentPassword : "";
    const newPassword = typeof requestBody.newPassword === "string" ? requestBody.newPassword : "";
    const username = hasRequestField(requestBody, "username")
      ? getOptionalString(requestBody.username)
      : req.user!.username;
    const email = (
      hasRequestField(requestBody, "email") ? getOptionalString(requestBody.email) : req.user!.email
    )?.toLowerCase();
    const githubLink = hasRequestField(requestBody, "githubLink")
      ? getOptionalString(requestBody.githubLink)
      : req.user!.githubLink;
    const linkedinLink = hasRequestField(requestBody, "linkedinLink")
      ? getOptionalString(requestBody.linkedinLink)
      : req.user!.linkedinLink;

    if (hasAccountPayload) {
    if (!username) {
      return res.status(400).json({ error: "יש למלא שם משתמשת" });
    }

    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "יש להזין כתובת מייל תקינה" });
    }

    if (githubLink && !isValidProfileUrl(githubLink, "github.com")) {
      return res.status(400).json({ error: "יש להזין קישור GitHub תקין" });
    }

    if (linkedinLink && !isValidProfileUrl(linkedinLink, "linkedin.com")) {
      return res.status(400).json({ error: "יש להזין קישור LinkedIn תקין" });
    }

    const existingUserWithEmail = await User.findOne({
      email,
      _id: { $ne: req.user!._id },
    });

    if (existingUserWithEmail) {
      return res.status(409).json({ error: "קיימת כבר משתמשת עם המייל הזה" });
    }

    }

    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "כדי לעדכן סיסמה יש למלא סיסמה נוכחית וסיסמה חדשה" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "הסיסמה החדשה חייבת להכיל לפחות 6 תווים" });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, req.user!.passwordHash);

      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: "הסיסמה הנוכחית אינה נכונה" });
      }

      req.user!.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const [mentorProfile, existingMenteeProfile] = await Promise.all([
      MentorProfile.findOne({ userId: req.user!._id }),
      MenteeProfile.findOne({ userId: req.user!._id }),
    ]);
    let menteeProfile = existingMenteeProfile;
    const mentorProfilePayload =
      requestBody.mentorProfile && typeof requestBody.mentorProfile === "object"
        ? (requestBody.mentorProfile as Record<string, unknown>)
        : null;
    const menteeProfilePayload =
      requestBody.menteeProfile && typeof requestBody.menteeProfile === "object"
        ? (requestBody.menteeProfile as Record<string, unknown>)
        : null;

    if (mentorProfile && mentorProfilePayload) {
      const maxMeetings = parseOptionalPositiveInteger(
        mentorProfilePayload.maxMeetings,
        "מספר הפגישות"
      );
      const meetingLength = parseOptionalPositiveInteger(
        mentorProfilePayload.meetingLength,
        "אורך הפגישה"
      );
      const yearsOfExperience = parseOptionalPositiveInteger(
        mentorProfilePayload.yearsOfExperience,
        "שנות הניסיון",
        true
      );

      if (maxMeetings.error) {
        return res.status(400).json({ error: maxMeetings.error });
      }

      if (meetingLength.error) {
        return res.status(400).json({ error: meetingLength.error });
      }

      if (yearsOfExperience.error) {
        return res.status(400).json({ error: yearsOfExperience.error });
      }

      mentorProfile.background = getOptionalString(mentorProfilePayload.background);
      mentorProfile.topics = normalizeStringList(mentorProfilePayload.topics);
      mentorProfile.maxMeetings = maxMeetings.value;
      mentorProfile.meetingLength = meetingLength.value;

      req.user!.jobTitle = getOptionalString(mentorProfilePayload.jobTitle);
      req.user!.company = getOptionalString(mentorProfilePayload.company);
      req.user!.yearsOfExperience = yearsOfExperience.value;
      req.user!.programmingLanguages = normalizeStringList(mentorProfilePayload.programmingLanguages);
      req.user!.techStack = normalizeStringList(mentorProfilePayload.techStack);

      await mentorProfile.save();
    }

    if (menteeProfilePayload) {
      const nextMenteeProfile = {
        userId: req.user!._id,
        about: getOptionalString(menteeProfilePayload.about),
        skills: normalizeStringList(menteeProfilePayload.skills),
        techStack: normalizeStringList(menteeProfilePayload.techStack),
        helpTopics: normalizeStringList(menteeProfilePayload.helpTopics),
        goals: getOptionalString(menteeProfilePayload.goals),
        experienceLevel: getOptionalString(menteeProfilePayload.experienceLevel),
      };

      if (menteeProfile) {
        menteeProfile.about = nextMenteeProfile.about;
        menteeProfile.skills = nextMenteeProfile.skills;
        menteeProfile.techStack = nextMenteeProfile.techStack;
        menteeProfile.helpTopics = nextMenteeProfile.helpTopics;
        menteeProfile.goals = nextMenteeProfile.goals;
        menteeProfile.experienceLevel = nextMenteeProfile.experienceLevel;

        await menteeProfile.save();
      } else {
        menteeProfile = await MenteeProfile.create(nextMenteeProfile);
      }
    }

    const previousProfilePicture = req.user!.profilePicture;

    if (requestBody.removeProfilePicture === true) {
      req.user!.profilePicture = undefined;
    }

    if (requestBody.profilePictureUpload !== undefined) {
      const savedImage = await saveProfileImage(requestBody.profilePictureUpload, req.user!._id);

      if ("error" in savedImage) {
        return res.status(400).json({ error: savedImage.error });
      }

      uploadedProfilePicture = savedImage.profilePicture;
      req.user!.profilePicture = savedImage.profilePicture;
    }

    if (hasAccountPayload) {
      req.user!.username = username!;
      req.user!.email = email!;
      req.user!.githubLink = githubLink;
      req.user!.linkedinLink = linkedinLink;
    }

    await req.user!.save();

    if (previousProfilePicture !== req.user!.profilePicture) {
      await deleteLocalProfileImage(previousProfilePicture);
    }

    return res.json({ user: sanitizeUser(req.user!), mentorProfile, menteeProfile });
  } catch (error: any) {
    if (uploadedProfilePicture) {
      await deleteLocalProfileImage(uploadedProfilePicture);
    }

    if (error?.code === 11000) {
      return res.status(409).json({ error: "קיימת כבר משתמשת עם המייל הזה" });
    }

    next(error);
  }
});

export default router;
