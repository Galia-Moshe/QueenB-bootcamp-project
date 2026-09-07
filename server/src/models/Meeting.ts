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

export type MeetingParticipantRole = "mentor" | "mentee";

export type AttendanceConfirmationState = {
  confirmedAt?: Date;
  reminder24hSentAt?: Date;
  reminder24hSendingAt?: Date;
  reminder24hFailedAt?: Date;
  reminder3hSentAt?: Date;
  reminder3hSendingAt?: Date;
  reminder3hFailedAt?: Date;
  reminderError?: string;
};

export type AttendanceConfirmation = Record<MeetingParticipantRole, AttendanceConfirmationState>;

export type MeetingDocument = {
  _id: Types.ObjectId;
  mentorId: Types.ObjectId;
  menteeId: Types.ObjectId;
  availabilityWindowId?: Types.ObjectId;
  status: MeetingStatus;
  proposedTimes: Date[];
  selectedTime?: Date;
  scheduledAt?: Date;
  attendanceConfirmation: AttendanceConfirmation;
  rescheduleAttempts: number;
  feedbacks: Feedback[];
  createdAt?: Date;
  updatedAt?: Date;
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

const attendanceConfirmationStateSchema = new Schema<AttendanceConfirmationState>(
  {
    confirmedAt: Date,
    reminder24hSentAt: Date,
    reminder24hSendingAt: Date,
    reminder24hFailedAt: Date,
    reminder3hSentAt: Date,
    reminder3hSendingAt: Date,
    reminder3hFailedAt: Date,
    reminderError: String,
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
    availabilityWindowId: {
      type: Schema.Types.ObjectId,
      ref: "AvailabilityWindow",
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
    scheduledAt: Date,
    attendanceConfirmation: {
      mentor: {
        type: attendanceConfirmationStateSchema,
        default: () => ({}),
      },
      mentee: {
        type: attendanceConfirmationStateSchema,
        default: () => ({}),
      },
    },
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

meetingSchema.index({ status: 1, selectedTime: 1 });

export type MeetingStatus = (typeof meetingStatuses)[number];

export const Meeting = model("Meeting", meetingSchema);
