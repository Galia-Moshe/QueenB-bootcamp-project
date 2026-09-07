import { Schema, model, type Types } from "mongoose";

export const meetingStatuses = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "attendance_confirmed",
  "completed",
  "canceled",
  "feedback_submitted",
  "disputed",
] as const;

export const attendanceResponseValues = ["yes", "no"] as const;

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

export type AttendanceResponses = {
  mentor: (typeof attendanceResponseValues)[number] | null;
  mentee: (typeof attendanceResponseValues)[number] | null;
};

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
  attendancePromptedAt?: Date;
  feedbackReminderAt?: Date;
  attendanceResponses: AttendanceResponses;
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

const attendanceResponsesSchema = new Schema<AttendanceResponses>(
  {
    mentor: {
      type: String,
      enum: attendanceResponseValues,
      default: null,
    },
    mentee: {
      type: String,
      enum: attendanceResponseValues,
      default: null,
    },
  },
  { _id: false }
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
    attendancePromptedAt: Date,
    feedbackReminderAt: Date,
    attendanceResponses: {
      type: attendanceResponsesSchema,
      default: () => ({ mentor: null, mentee: null }),
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

/** Convert legacy array-shaped attendanceResponses to { mentor, mentee }. */
export async function normalizeAttendanceResponsesShape() {
  const result = await Meeting.collection.updateMany(
    {
      $or: [
        { attendanceResponses: { $type: "array" } },
        { attendanceResponses: { $exists: false } },
        { attendanceResponses: null },
      ],
    },
    { $set: { attendanceResponses: { mentor: null, mentee: null } } }
  );

  if (result.modifiedCount > 0) {
    console.log(
      `Normalized attendanceResponses on ${result.modifiedCount} meeting(s)`
    );
  }
}
