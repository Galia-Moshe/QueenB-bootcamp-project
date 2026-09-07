import { Schema, model, type Types } from "mongoose";

export const mentorApprovalStatuses = ["pending", "approved", "rejected"] as const;

export type MentorApprovalStatus = (typeof mentorApprovalStatuses)[number];

export type MentorProfileDocument = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  background?: string;
  topics: string[];
  maxMeetings?: number;
  meetingLength?: number;
  approvalStatus: MentorApprovalStatus;
  rejectionReason?: string | null;
  isViewedByAdmin: boolean;
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
    approvalStatus: {
      type: String,
      enum: mentorApprovalStatuses,
      default: "pending",
      required: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    isViewedByAdmin: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MentorProfile = model("MentorProfile", mentorProfileSchema);

/** Existing mentors created before approval flow should remain publicly listed. */
export async function normalizeMentorApprovalStatuses() {
  await MentorProfile.updateMany(
    { approvalStatus: { $exists: false } },
    {
      $set: {
        approvalStatus: "approved",
        isViewedByAdmin: true,
        rejectionReason: null,
      },
    }
  );
}
