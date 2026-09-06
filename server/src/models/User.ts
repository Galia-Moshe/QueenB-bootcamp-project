import { Schema, model, type Types } from "mongoose";

export type UserRole = "user" | "admin";

export type UserDocument = {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  username: string;
  role: UserRole;
  programmingLanguages: string[];
  techStack: string[];
  jobTitle?: string;
  company?: string;
  yearsOfExperience?: number;
  profilePicture?: string;
  githubLink?: string;
  linkedinLink?: string;
  mentoringSessionsCount: number;
  menteeSessionsCount: number;
};

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"] satisfies UserRole[],
      default: "user",
    },
    programmingLanguages: {
      type: [String],
      default: [],
    },
    techStack: {
      type: [String],
      default: [],
    },
    jobTitle: String,
    company: String,
    yearsOfExperience: Number,
    profilePicture: String,
    githubLink: String,
    linkedinLink: String,
    mentoringSessionsCount: {
      type: Number,
      default: 0,
    },
    menteeSessionsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const User = model("User", userSchema);
