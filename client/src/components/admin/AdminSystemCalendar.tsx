import React, { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventClickArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import heLocale from "@fullcalendar/core/locales/he";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../../api";
import type { Meeting, MeetingStatus } from "../../types";
import { meetingStatusOptions, statusColors, statusLabels } from "../../types";
import { MeetingDetailsModal } from "./MeetingDetailsModal";

function meetingEventStart(meeting: Meeting): string | undefined {
  return meeting.selectedTime || meeting.proposedTimes[0] || meeting.createdAt;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateHeading(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function dateKeyFromIso(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type MeetingsByDate = Array<{
  dateKey: string;
  label: string;
  meetings: Meeting[];
}>;

function groupMeetingsByDate(meetings: Meeting[]): MeetingsByDate {
  const groups = new Map<string, Meeting[]>();

  meetings.forEach((meeting) => {
    const start = meetingEventStart(meeting);
    if (!start) {
      return;
    }

    const key = dateKeyFromIso(start);
    const existing = groups.get(key) ?? [];
    existing.push(meeting);
    groups.set(key, existing);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dateKey, dayMeetings]) => ({
      dateKey,
      label: formatDateHeading(`${dateKey}T12:00:00`),
      meetings: dayMeetings.sort((a, b) => {
        const aStart = meetingEventStart(a) ?? "";
        const bStart = meetingEventStart(b) ?? "";
        return aStart.localeCompare(bStart);
      }),
    }));
}

export function AdminSystemCalendar() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [status, setStatus] = useState<MeetingStatus | "">("");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const meetingsById = useMemo(() => {
    const map = new Map<string, Meeting>();
    meetings.forEach((meeting) => map.set(meeting._id, meeting));
    return map;
  }, [meetings]);

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const meeting = meetingsById.get(clickInfo.event.id);
      if (meeting) {
        setSelectedMeeting(meeting);
      }
    },
    [meetingsById]
  );

  const closeMeetingDetails = useCallback(() => {
    setSelectedMeeting(null);
  }, []);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (status) {
        params.set("status", status);
      }

      const query = params.toString();
      const response = await api.get<{ meetings: Meeting[] }>(
        `/admin/meetings${query ? `?${query}` : ""}`
      );
      setMeetings(response.data.meetings);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const calendarEvents = useMemo(
    () =>
      meetings
        .map((meeting) => {
          const start = meetingEventStart(meeting);
          if (!start) {
            return null;
          }

          return {
            id: meeting._id,
            title: `${meeting.mentorId.username} & ${meeting.menteeId.username}`,
            start,
            backgroundColor: statusColors[meeting.status],
            borderColor: "transparent",
            textColor: "#ffffff",
          };
        })
        .filter((event): event is NonNullable<typeof event> => event !== null),
    [meetings]
  );

  const meetingsByDate = useMemo(() => groupMeetingsByDate(meetings), [meetings]);

  return (
    <Stack spacing={2}>
      <FormControl sx={{ minWidth: 220, maxWidth: 320 }} size="small">
        <InputLabel id="admin-meeting-status-filter">סטטוס</InputLabel>
        <Select
          labelId="admin-meeting-status-filter"
          label="סטטוס"
          value={status}
          onChange={(event) => setStatus(event.target.value as MeetingStatus | "")}
        >
          <MenuItem value="">כל הסטטוסים</MenuItem>
          {meetingStatusOptions.map((option) => (
            <MenuItem key={option} value={option}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: statusColors[option],
                    flexShrink: 0,
                  }}
                />
                <span>{statusLabels[option]}</span>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 320 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              overflow: "hidden",
              "& .fc-event, & .fc-timegrid-slot": {
                cursor: "pointer",
              },
            }}
          >
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                start: "prev,next today",
                center: "title",
                end: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              buttonText={{
                today: "היום",
                month: "חודש",
                week: "שבוע",
                day: "יום",
              }}
              locale={heLocale}
              direction="rtl"
              height="auto"
              displayEventTime={false}
              events={calendarEvents}
              eventClick={handleEventClick}
            />
          </Paper>

          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              maxHeight: { lg: 720 },
              overflow: "auto",
            }}
          >
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  פגישות לפי תאריך
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  הרשימה והיומן מסוננים לפי אותו סטטוס. לחצי על פגישה לפרטים.
                </Typography>
              </Box>

              <Divider />

              {meetingsByDate.length === 0 ? (
                <Typography color="text.secondary">אין פגישות להצגה.</Typography>
              ) : (
                meetingsByDate.map((group) => (
                  <Stack key={group.dateKey} spacing={1.5}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {group.label}
                    </Typography>
                    {group.meetings.map((meeting) => (
                      <Paper
                        key={meeting._id}
                        variant="outlined"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedMeeting(meeting)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedMeeting(meeting);
                          }
                        }}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          cursor: "pointer",
                          transition: "background-color 0.15s ease",
                          "&:hover": { bgcolor: "action.hover" },
                          "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.main",
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <Stack spacing={0.75}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="space-between"
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Typography sx={{ fontWeight: 700 }}>
                              {meeting.mentorId.username} ↔ {meeting.menteeId.username}
                            </Typography>
                            <Chip
                              label={statusLabels[meeting.status]}
                              size="small"
                              sx={{
                                bgcolor: statusColors[meeting.status],
                                color: "#fff",
                              }}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {formatDateTime(meetingEventStart(meeting))}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ))
              )}
            </Stack>
          </Paper>
        </Box>
      )}

      <MeetingDetailsModal
        meeting={selectedMeeting}
        open={Boolean(selectedMeeting)}
        onClose={closeMeetingDetails}
      />
    </Stack>
  );
}
