import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import type { EventClickArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import SendIcon from "@mui/icons-material/Send";
import { api, getApiErrorMessage } from "../api";
import { MeetingDetailsModal } from "../components/meetings/MeetingDetailsModal";
import PageHero from "../components/ui/PageHero";
import SurfaceCard from "../components/ui/SurfaceCard";
import type { AvailabilityWindow, Meeting, MentorProfile } from "../types";
import { statusLabels } from "../types";
import {
  formatMeetingToEvent,
  sharedCalendarContainerSx,
  sharedCalendarProps,
} from "../utils/calendarUtils";

type MeetingRole = "mentee" | "mentor";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatWindowDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getAvailabilityWindow(meeting: Meeting): AvailabilityWindow | null {
  return meeting.availabilityWindowId && typeof meeting.availabilityWindowId !== "string"
    ? meeting.availabilityWindowId
    : null;
}

function otherParticipantName(meeting: Meeting, role: MeetingRole) {
  return role === "mentor" ? meeting.menteeId.username : meeting.mentorId.username;
}

function PendingMeetingCard({
  meeting,
  role,
  onChanged,
}: {
  meeting: Meeting;
  role: MeetingRole;
  onChanged: (message?: string, severity?: "success" | "error") => void;
}) {
  const [times, setTimes] = useState(["", "", ""]);
  const [selectedTime, setSelectedTime] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const availabilityWindow = getAvailabilityWindow(meeting);
  const isNewFlowMentorView = role === "mentor" && Boolean(availabilityWindow);

  const canPropose =
    role === "mentor" && meeting.status === "pending_mentor_times" && !availabilityWindow;
  const canSelect = role === "mentee" && meeting.status === "pending_mentee_selection";

  const approveMeeting = async () => {
    if (approving || rejecting) return;

    setError("");
    setApproving(true);

    try {
      await api.patch(`/meetings/${meeting._id}/approve`);
      onChanged("הפגישה אושרה ונקבעה בהצלחה", "success");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        onChanged("הבקשה הזו כבר טופלה. הרשימה עודכנה.", "error");
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setApproving(false);
    }
  };

  const rejectMeeting = async () => {
    if (approving || rejecting) return;

    setError("");
    setRejecting(true);

    try {
      await api.patch(`/meetings/${meeting._id}/reject`);
      onChanged("הבקשה נדחתה והמועד פתוח שוב לקביעה", "success");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        onChanged("הבקשה הזו כבר טופלה. הרשימה עודכנה.", "error");
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setRejecting(false);
    }
  };

  const proposeTimes = async () => {
    setError("");
    setSubmitting(true);

    try {
      await api.patch(`/meetings/${meeting._id}/propose-times`, {
        proposedTimes: times.filter(Boolean).map((time) => new Date(time).toISOString()),
      });
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const selectTime = async () => {
    setError("");
    setSubmitting(true);

    try {
      await api.patch(`/meetings/${meeting._id}/select-time`, { selectedTime });
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SurfaceCard variant="outlined" muted shadow={false}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography sx={{ color: "primary.dark", fontWeight: 800 }}>
            {otherParticipantName(meeting, role)}
          </Typography>
          <Chip
            label={isNewFlowMentorView ? "ממתינה לאישור" : statusLabels[meeting.status]}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {isNewFlowMentorView && availabilityWindow && (
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {formatWindowDate(availabilityWindow.date)}
              </Typography>
              <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 800 }}>
                {availabilityWindow.startTime}–{availabilityWindow.endTime}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<EventAvailableIcon />}
                disabled={approving || rejecting}
                onClick={approveMeeting}
              >
                {approving ? "מאשרת..." : "אישור פגישה"}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<EventBusyIcon />}
                disabled={approving || rejecting}
                onClick={rejectMeeting}
              >
                {rejecting ? "דוחה..." : "דחיית בקשה"}
              </Button>
            </Stack>
          </Stack>
        )}

        {canPropose && (
          <Stack spacing={1.5}>
            {times.map((time, index) => (
              <TextField
                key={index}
                type="datetime-local"
                label={`זמן ${index + 1}`}
                value={time}
                onChange={(event) => {
                  const nextTimes = [...times];
                  nextTimes[index] = event.target.value;
                  setTimes(nextTimes);
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            ))}
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={proposeTimes}
              disabled={submitting}
            >
              שליחת זמנים
            </Button>
          </Stack>
        )}

        {canSelect && (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {meeting.proposedTimes.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? "contained" : "outlined"}
                  onClick={() => setSelectedTime(time)}
                >
                  {formatDateTime(time)}
                </Button>
              ))}
            </Stack>
            <Button
              variant="contained"
              startIcon={<EventAvailableIcon />}
              disabled={!selectedTime || submitting}
              onClick={selectTime}
            >
              בחירת זמן
            </Button>
          </Stack>
        )}

        {!canPropose && !canSelect && !isNewFlowMentorView && (
          <Typography variant="body2" color="text.secondary">
            הפגישה עדיין לא נקבעה ביומן.
          </Typography>
        )}
      </Stack>
    </SurfaceCard>
  );
}

function ScheduledMeetingCard({
  meeting,
  role,
  onChanged,
}: {
  meeting: Meeting;
  role: MeetingRole;
  onChanged: (message?: string, severity?: "success" | "error") => void;
}) {
  const [error, setError] = useState("");
  const [canceling, setCanceling] = useState(false);

  const availabilityWindow = getAvailabilityWindow(meeting);

  const cancelMeeting = async () => {
    if (canceling) return;

    setError("");
    setCanceling(true);

    try {
      await api.patch(`/meetings/${meeting._id}/cancel`);
      onChanged("הפגישה בוטלה בהצלחה", "success");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        onChanged("הפגישה הזו כבר טופלה. הרשימה עודכנה.", "error");
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setCanceling(false);
    }
  };

  return (
    <SurfaceCard variant="outlined" muted shadow={false}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography sx={{ color: "primary.dark", fontWeight: 800 }}>
            {otherParticipantName(meeting, role)}
          </Typography>
          <Chip label={statusLabels[meeting.status]} size="small" color="primary" variant="outlined" />
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {availabilityWindow && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              {formatWindowDate(availabilityWindow.date)}
            </Typography>
            <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 800 }}>
              {availabilityWindow.startTime}–{availabilityWindow.endTime}
            </Typography>
          </Box>
        )}

        <Button
          variant="outlined"
          color="error"
          startIcon={<EventBusyIcon />}
          disabled={canceling}
          onClick={cancelMeeting}
        >
          {canceling ? "מבטלת..." : "ביטול פגישה"}
        </Button>
      </Stack>
    </SurfaceCard>
  );
}

export default function HomePage() {
  const [role, setRole] = useState<MeetingRole>("mentee");
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState<{ text: string; severity: "success" | "error" } | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadMeetings = useCallback(async (meetingRole: MeetingRole) => {
    setError("");
    setLoading(true);

    try {
      const [profileResponse, meetingsResponse] = await Promise.all([
        api.get<{ mentorProfile: MentorProfile | null }>("/mentors/me"),
        api.get<{ meetings: Meeting[] }>(`/meetings/my?role=${meetingRole}`),
      ]);

      setMentorProfile(profileResponse.data.mentorProfile);
      setMeetings(meetingsResponse.data.meetings);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMeetingChanged = useCallback(
    (message?: string, severity: "success" | "error" = "success") => {
      setActionMessage(message ? { text: message, severity } : null);
      loadMeetings(role);
    },
    [role, loadMeetings]
  );

  useEffect(() => {
    setActionMessage(null);
    setSelectedDate(null);
    loadMeetings(role);
  }, [role, loadMeetings]);

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const meeting = meetings.find((item) => item._id === clickInfo.event.id);
      if (meeting) {
        setSelectedMeeting(meeting);
      }
    },
    [meetings]
  );

  const closeMeetingDetails = useCallback(() => {
    setSelectedMeeting(null);
  }, []);

  const scheduledEvents = useMemo(
    () =>
      meetings
        .filter((meeting) => meeting.status === "scheduled")
        .map((meeting) => formatMeetingToEvent(meeting, role))
        .filter((event): event is NonNullable<typeof event> => event !== null),
    [meetings, role]
  );

  const pendingMeetings = meetings.filter(
    (meeting) => !meeting.selectedTime && meeting.status !== "canceled"
  );

  const scheduledMeetingsList = meetings.filter(
    (meeting) => meeting.status === "scheduled" && Boolean(getAvailabilityWindow(meeting))
  );

  const selectedDayMeetings = selectedDate
    ? scheduledMeetingsList.filter((meeting) => getAvailabilityWindow(meeting)?.date === selectedDate)
    : [];

  const canSwitchRoles = Boolean(mentorProfile);

  return (
    <Stack spacing={3}>
      <PageHero
        title="היומן שלי"
        description="פגישות שנקבעו מופיעות ביומן, ובקשות שעדיין מחכות לפעולה מופיעות בצד."
        action={
          canSwitchRoles && (
            <FormControlLabel
              sx={{
                mx: 0,
                color: "#ffffff",
                "& .MuiFormControlLabel-label": {
                  fontWeight: 800,
                },
              }}
              control={
                <Switch
                  checked={role === "mentor"}
                  onChange={(event) => setRole(event.target.checked ? "mentor" : "mentee")}
                />
              }
              label={role === "mentor" ? "הפגישות שלי כמנטורית" : "הפגישות שלי כמנטית"}
            />
          )
        }
      />

      {error && <Alert severity="error">{error}</Alert>}
      {actionMessage && <Alert severity={actionMessage.severity}>{actionMessage.text}</Alert>}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 320 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 3 }}>
          <SurfaceCard
            sx={{
              ...sharedCalendarContainerSx,
              "& .fc-daygrid-day-frame": {
                cursor: "pointer",
                transition: "background-color 0.15s ease",
              },
              "& .fc-daygrid-day-frame:hover": {
                backgroundColor: "rgba(236, 64, 122, 0.08)",
              },
              "& .fc-event": {
                cursor: "pointer",
              },
              "& .fc-day-selected .fc-daygrid-day-frame": {
                backgroundColor: "rgba(216, 27, 96, 0.16)",
                boxShadow: "inset 0 0 0 2px #d81b60",
              },
            }}
          >
            <FullCalendar
              {...sharedCalendarProps}
              events={scheduledEvents}
              dateClick={(arg: DateClickArg) => setSelectedDate(toDateKey(arg.date))}
              eventClick={(arg: EventClickArg) => {
                handleEventClick(arg);
                if (arg.event.start) {
                  setSelectedDate(toDateKey(arg.event.start));
                }
              }}
              dayCellClassNames={(arg) => (toDateKey(arg.date) === selectedDate ? ["fc-day-selected"] : [])}
            />
          </SurfaceCard>

          <SurfaceCard>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
                  בקשות שמחכות לטיפול
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {role === "mentor" ? "בקשות שבהן את המנטורית" : "בקשות שבהן את המנטית"}
                </Typography>
              </Box>

              <Divider />

              {pendingMeetings.length === 0 ? (
                <Typography color="text.secondary">אין בקשות פתוחות כרגע.</Typography>
              ) : (
                pendingMeetings.map((meeting) => (
                  <PendingMeetingCard
                    key={meeting._id}
                    meeting={meeting}
                    role={role}
                    onChanged={handleMeetingChanged}
                  />
                ))
              )}

              {(selectedDate || scheduledMeetingsList.length > 0) && (
                <>
                  <Divider />
                  {selectedDate ? (
                    <>
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
                            הפגישות ב־{formatWindowDate(selectedDate)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {role === "mentee" ? "ניתן לבטל פגישה שנקבעה" : "פגישות שאושרו וממתינות להתקיים"}
                          </Typography>
                        </Box>
                        <Button size="small" onClick={() => setSelectedDate(null)}>
                          הצג את כל הפגישות
                        </Button>
                      </Stack>

                      {selectedDayMeetings.length === 0 ? (
                        <Typography color="text.secondary">אין פגישות מתוזמנות ביום זה.</Typography>
                      ) : (
                        selectedDayMeetings.map((meeting) => (
                          <ScheduledMeetingCard
                            key={meeting._id}
                            meeting={meeting}
                            role={role}
                            onChanged={handleMeetingChanged}
                          />
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      <Box>
                        <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
                          הפגישות המתוזמנות שלי
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {role === "mentee" ? "ניתן לבטל פגישה שנקבעה" : "פגישות שאושרו וממתינות להתקיים"}
                        </Typography>
                      </Box>
                      {scheduledMeetingsList.map((meeting) => (
                        <ScheduledMeetingCard
                          key={meeting._id}
                          meeting={meeting}
                          role={role}
                          onChanged={handleMeetingChanged}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </Stack>
          </SurfaceCard>
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
