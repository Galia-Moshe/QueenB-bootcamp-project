import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import heLocale from "@fullcalendar/core/locales/he";
import type { Meeting } from "../types";
import { statusColors } from "../types";

export type MeetingCalendarRole = "mentor" | "mentee";

export type MeetingCalendarEvent = {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

/** Prefer selected time, else first proposed time, else createdAt. */
export function meetingEventStart(meeting: Meeting): string | undefined {
  return meeting.selectedTime || meeting.proposedTimes[0] || meeting.createdAt;
}

/**
 * Maps a meeting to a FullCalendar event.
 * With `contextRole`, title is the other participant's name (home calendar).
 * Without it, title is "Mentor & Mentee" (admin calendar).
 */
export function formatMeetingToEvent(
  meeting: Meeting,
  contextRole?: MeetingCalendarRole
): MeetingCalendarEvent | null {
  const start = meetingEventStart(meeting);
  if (!start) {
    return null;
  }

  const title = contextRole
    ? contextRole === "mentor"
      ? meeting.menteeId.username
      : meeting.mentorId.username
    : `${meeting.mentorId.username} & ${meeting.menteeId.username}`;

  return {
    id: meeting._id,
    title,
    start,
    backgroundColor: statusColors[meeting.status],
    borderColor: statusColors[meeting.status],
    textColor: "#ffffff",
  };
}

/** Shared FullCalendar visual/config props used by Home and Admin calendars. */
export const sharedCalendarProps = {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: "dayGridMonth",
  headerToolbar: {
    start: "prev,next today",
    center: "title",
    end: "dayGridMonth,timeGridWeek,timeGridDay",
  },
  buttonText: {
    today: "היום",
    month: "חודש",
    week: "שבוע",
    day: "יום",
  },
  locale: heLocale,
  direction: "rtl" as const,
  height: "auto" as const,
  eventDisplay: "block" as const,
  displayEventTime: false,
};

/** Shared container styles for clickable calendar events. */
export const sharedCalendarContainerSx = {
  overflow: "hidden",
  "& .fc-event, & .fc-timegrid-slot": {
    cursor: "pointer",
  },
};
