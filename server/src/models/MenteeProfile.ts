import { Schema, model, type Types } from "mongoose";

export type MenteeProfileDocument = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  about?: string;
  skills: string[];
  techStack: string[];
  helpTopics: string[];
  goals?: string;
  experienceLevel?: string;
};

const menteeProfileSchema = new Schema<MenteeProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    about: String,
    skills: {
      type: [String],
      default: [],
    },
    techStack: {
      type: [String],
      default: [],
    },
    helpTopics: {
      type: [String],
      default: [],
    },
    goals: String,
    experienceLevel: String,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MenteeProfile = model("MenteeProfile", menteeProfileSchema);
