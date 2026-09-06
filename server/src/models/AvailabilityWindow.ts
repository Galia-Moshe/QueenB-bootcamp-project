import { Schema, model, type Types } from "mongoose";

export const availabilityWindowStatuses = ["available", "pending", "booked"] as const;

export type AvailabilityWindowStatus = (typeof availabilityWindowStatuses)[number];

export type AvailabilityWindowDocument = {
  _id: Types.ObjectId;
  mentorId: Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  status: AvailabilityWindowStatus;
};

const availabilityWindowSchema = new Schema<AvailabilityWindowDocument>(
  {
    mentorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    status: {
      type: String,
      enum: availabilityWindowStatuses,
      default: "available",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

availabilityWindowSchema.index({ mentorId: 1, date: 1 });

export const AvailabilityWindow = model("AvailabilityWindow", availabilityWindowSchema);
