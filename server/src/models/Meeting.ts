import { Schema, model, type Types } from "mongoose";

export const meetingStatuses = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "attendance_confirmed",
  "completed",
  "canceled",
  "feedback_submitted",
] as const;

type Feedback = {
  fromUserId: Types.ObjectId;
  role: "mentor" | "mentee";
  content: string;
};

export type MeetingDocument = {
  _id: Types.ObjectId;
  mentorId: Types.ObjectId;
  menteeId: Types.ObjectId;
  status: MeetingStatus;
  proposedTimes: Date[];
  selectedTime?: Date;
  rescheduleAttempts: number;
  feedbacks: Feedback[];
};

const feedbackSchema = new Schema<Feedback>(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["mentor", "mentee"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const meetingSchema = new Schema<MeetingDocument>(
  {
    mentorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    menteeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: meetingStatuses,
      required: true,
    },
    proposedTimes: {
      type: [Date],
      default: [],
    },
    selectedTime: Date,
    rescheduleAttempts: {
      type: Number,
      default: 0,
    },
    feedbacks: {
      type: [feedbackSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type MeetingStatus = (typeof meetingStatuses)[number];

export const Meeting = model("Meeting", meetingSchema);
