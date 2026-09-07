import React from "react";
import { Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import SurfaceCard from "../ui/SurfaceCard";
import { UserProfileLink } from "../UserProfileLink";
import type { AvailabilityWindow, Meeting, User } from "../../types";
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

function otherParticipant(meeting: Meeting, role: MeetingRole): User {
  return role === "mentor" ? meeting.menteeId : meeting.mentorId;
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
                {filteredEvents.map((meeting) => {
                  const participant = otherParticipant(meeting, role);

                  return (
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
                        <UserProfileLink
                          userId={participant._id}
                          userName={participant.username}
                        />
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {formatMeetingTime(meeting)}
                      </Typography>
                      {meeting.topics && meeting.topics.length > 0 && (
                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                          {meeting.topics.map((topic) => (
                            <Chip
                              key={topic}
                              label={topic}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </>
        )}

        {!selectedDate && allScheduledSection}
      </Stack>
    </SurfaceCard>
  );
}
