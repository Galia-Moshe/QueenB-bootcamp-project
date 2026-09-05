import { Schema, model, type Types } from "mongoose";

export type AvailabilityWindowDocument = {
  _id: Types.ObjectId;
  mentorId: Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  meetingLength: number;
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
    meetingLength: {
      type: Number,
      required: true,
      min: 5,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

availabilityWindowSchema.index({ mentorId: 1, date: 1 });

export const AvailabilityWindow = model("AvailabilityWindow", availabilityWindowSchema);
