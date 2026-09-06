import React from "react";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import SurfaceCard from "../ui/SurfaceCard";
import type { AvailabilityWindow, Meeting } from "../../types";
import { meetingEventStart } from "../../utils/calendarUtils";

type MeetingRole = "mentee" | "mentor";

type HomeMeetingsSidebarProps = {
  role: MeetingRole;
  selectedDate: string | null;
  filteredEvents: Meeting[];
  pendingSection: React.ReactNode;
  allScheduledSection?: React.ReactNode;
  onClearSelectedDate: () => void;
  onEventClick: (meeting: Meeting) => void;
};

function formatWindowDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function getAvailabilityWindow(meeting: Meeting): AvailabilityWindow | null {
  return meeting.availabilityWindowId && typeof meeting.availabilityWindowId !== "string"
    ? meeting.availabilityWindowId
    : null;
}

function otherParticipantName(meeting: Meeting, role: MeetingRole) {
  return role === "mentor" ? meeting.menteeId.username : meeting.mentorId.username;
}

function formatMeetingTime(meeting: Meeting) {
  const availabilityWindow = getAvailabilityWindow(meeting);
  if (availabilityWindow) {
    return `${availabilityWindow.startTime}–${availabilityWindow.endTime}`;
  }

  if (meeting.selectedTime) {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(meeting.selectedTime));
  }

  const start = meetingEventStart(meeting);
  if (start) {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(start));
  }

  return "שעה לא נקבעה";
}

export function HomeMeetingsSidebar({
  role,
  selectedDate,
  filteredEvents,
  pendingSection,
  allScheduledSection,
  onClearSelectedDate,
  onEventClick,
}: HomeMeetingsSidebarProps) {
  return (
    <SurfaceCard>
      <Stack spacing={2}>
        {pendingSection}

        {selectedDate && (
          <>
            <Divider />
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
                  הפגישות ב־{formatWindowDate(selectedDate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {role === "mentee" ? "לחצי לפתיחת פרטי הפגישה" : "פגישות שאושרו וממתינות להתקיים"}
                </Typography>
              </Box>
              <Button size="small" onClick={onClearSelectedDate}>
                הצג את כל הפגישות
              </Button>
            </Stack>

            {filteredEvents.length === 0 ? (
              <Typography color="text.secondary">אין פגישות מתוזמנות ביום זה.</Typography>
            ) : (
              <Stack spacing={1.25}>
                {filteredEvents.map((meeting) => (
                  <Box
                    key={meeting._id}
                    component="button"
                    type="button"
                    onClick={() => onEventClick(meeting)}
                    sx={{
                      display: "block",
                      width: "100%",
                      textAlign: "start",
                      border: "1px solid #f8bbd0",
                      borderRadius: 2,
                      bgcolor: "#fff7fa",
                      px: 1.75,
                      py: 1.5,
                      cursor: "pointer",
                      transition: "background-color 0.15s ease, box-shadow 0.15s ease",
                      font: "inherit",
                      color: "inherit",
                      "&:hover": {
                        backgroundColor: "rgba(236, 64, 122, 0.1)",
                        boxShadow: "0 8px 20px rgba(136, 14, 79, 0.08)",
                      },
                    }}
                  >
                    <Typography sx={{ color: "primary.dark", fontWeight: 800 }}>
                      {otherParticipantName(meeting, role)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {formatMeetingTime(meeting)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </>
        )}

        {!selectedDate && allScheduledSection}
      </Stack>
    </SurfaceCard>
  );
}
