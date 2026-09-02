import { Schema, model, type Types } from "mongoose";

export type MentorProfileDocument = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  background?: string;
  topics: string[];
  maxMeetings?: number;
  meetingLength?: number;
};

const mentorProfileSchema = new Schema<MentorProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    background: String,
    topics: {
      type: [String],
      default: [],
    },
    maxMeetings: Number,
    meetingLength: Number,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MentorProfile = model("MentorProfile", mentorProfileSchema);
