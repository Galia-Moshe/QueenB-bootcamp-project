import { AvailabilityWindow } from "../models/AvailabilityWindow";
import { MentorProfile } from "../models/MentorProfile";

const DEFAULT_MEETING_DURATION_MINUTES = 60;

function refId(value: unknown) {
  if (value && typeof value === "object" && "_id" in value) {
    return (value as { _id: unknown })._id;
  }

  return value;
}

function parseTimeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

/** Duration in minutes from an availability window's start/end clock times. */
function durationMinutesFromWindow(startTime: string, endTime: string): number | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return null;
  }

  return end - start;
}

async function resolveMeetingDurationMinutes(meeting: {
  mentorId: unknown;
  availabilityWindowId?: unknown;
}): Promise<number> {
  if (meeting.availabilityWindowId) {
    const populated =
      meeting.availabilityWindowId &&
      typeof meeting.availabilityWindowId === "object" &&
      "startTime" in meeting.availabilityWindowId &&
      "endTime" in meeting.availabilityWindowId
        ? (meeting.availabilityWindowId as { startTime: string; endTime: string })
        : null;

    const window =
      populated ??
      (await AvailabilityWindow.findById(refId(meeting.availabilityWindowId)).select(
        "startTime endTime"
      ));

    const fromWindow =
      window &&
      durationMinutesFromWindow(String(window.startTime), String(window.endTime));

    if (fromWindow && fromWindow > 0) {
      return fromWindow;
    }
  }

  const mentorProfile = await MentorProfile.findOne({ userId: refId(meeting.mentorId) });
  if (mentorProfile?.meetingLength && mentorProfile.meetingLength > 0) {
    return mentorProfile.meetingLength;
  }

  return DEFAULT_MEETING_DURATION_MINUTES;
}

/**
 * Meeting end = selectedTime + duration.
 * Duration prefers the linked availability window length, then mentor
 * meetingLength, then a 60-minute default. Never use the window's calendar
 * date as the absolute end — selectedTime may be updated independently
 * (e.g. moved into the past), and the job must follow selectedTime.
 */
export async function getMeetingEndTime(meeting: {
  selectedTime?: Date;
  mentorId: unknown;
  availabilityWindowId?: unknown;
}): Promise<Date | null> {
  if (!meeting.selectedTime) {
    return null;
  }

  const durationMinutes = await resolveMeetingDurationMinutes(meeting);
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
