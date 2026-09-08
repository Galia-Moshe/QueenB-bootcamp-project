import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { MentorProfile } from "../models/MentorProfile";

const DEFAULT_MEETING_DURATION_MINUTES = 60;

function refId(value: unknown) {
  if (value && typeof value === "object" && "_id" in value) {
    return (value as { _id: unknown })._id;
  }

  return value;
}

export async function getMeetingEndTime(meeting: {
  selectedTime?: Date;
  mentorId: unknown;
  availabilityWindowId?: unknown;
}): Promise<Date | null> {
  if (!meeting.selectedTime) {
    return null;
  }

  if (meeting.availabilityWindowId) {
    const window = await AvailabilityWindow.findById(refId(meeting.availabilityWindowId));
    if (window) {
      return new Date(`${window.date}T${window.endTime}:00`);
    }
  }

  const mentorProfile = await MentorProfile.findOne({ userId: refId(meeting.mentorId) });
  const durationMinutes =
    mentorProfile?.meetingLength && mentorProfile.meetingLength > 0
      ? mentorProfile.meetingLength
      : DEFAULT_MEETING_DURATION_MINUTES;

  return new Date(meeting.selectedTime.getTime() + durationMinutes * 60 * 1000);
}

export async function hasMeetingEnded(
  meeting: {
    selectedTime?: Date;
    mentorId: unknown;
    availabilityWindowId?: unknown;
  },
  now = new Date()
) {
  const endTime = await getMeetingEndTime(meeting);
  return Boolean(endTime && endTime.getTime() <= now.getTime());
}
