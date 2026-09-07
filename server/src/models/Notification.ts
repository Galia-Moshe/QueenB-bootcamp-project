import { Schema, model, type Types } from "mongoose";

export const notificationTypes = [
  "new_meeting_request",
  "meeting_approved",
  "meeting_rejected",
  "meeting_canceled",
  "attendance_check",
  "feedback_reminder",
  "attendance_discrepancy",
] as const;

export const notificationActionStatuses = ["pending", "awaiting_other", "feedback_choice", "answered"] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type NotificationActionStatus = (typeof notificationActionStatuses)[number];

export type NotificationDocument = {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  type: NotificationType;
  message: string;
  read: boolean;
  meetingId?: Types.ObjectId;
  actionStatus?: NotificationActionStatus;
};

const notificationSchema = new Schema<NotificationDocument>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: notificationTypes,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
      required: true,
    },
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
    },
    actionStatus: {
      type: String,
      enum: notificationActionStatuses,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = model("Notification", notificationSchema);
