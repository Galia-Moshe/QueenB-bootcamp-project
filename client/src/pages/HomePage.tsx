import React, { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import heLocale from "@fullcalendar/core/locales/he";
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
import SendIcon from "@mui/icons-material/Send";
import { api, getApiErrorMessage } from "../api";
import PageHero from "../components/ui/PageHero";
import SurfaceCard from "../components/ui/SurfaceCard";
import type { Meeting, MentorProfile } from "../types";
import { statusLabels } from "../types";

type MeetingRole = "mentee" | "mentor";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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
  onChanged: () => void;
}) {
  const [times, setTimes] = useState(["", "", ""]);
  const [selectedTime, setSelectedTime] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canPropose = role === "mentor" && meeting.status === "pending_mentor_times";
  const canSelect = role === "mentee" && meeting.status === "pending_mentee_selection";

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
          <Chip label={statusLabels[meeting.status]} size="small" color="primary" variant="outlined" />
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

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

        {!canPropose && !canSelect && (
          <Typography variant="body2" color="text.secondary">
            הפגישה עדיין לא נקבעה ביומן.
          </Typography>
        )}
      </Stack>
    </SurfaceCard>
  );
}

export default function HomePage() {
  const [role, setRole] = useState<MeetingRole>("mentee");
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    loadMeetings(role);
  }, [role, loadMeetings]);

  const scheduledEvents = useMemo(
    () =>
      meetings
        .filter((meeting) => Boolean(meeting.selectedTime))
        .map((meeting) => ({
          id: meeting._id,
          title: `${otherParticipantName(meeting, role)} - ${statusLabels[meeting.status]}`,
          start: meeting.selectedTime,
          backgroundColor: meeting.status === "scheduled" ? "#d81b60" : "#ad1457",
          borderColor: "transparent",
        })),
    [meetings, role]
  );

  const pendingMeetings = meetings.filter((meeting) => !meeting.selectedTime);
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

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 320 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 3 }}>
          <SurfaceCard sx={{ overflow: "hidden" }}>
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
              events={scheduledEvents}
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
                    onChanged={() => loadMeetings(role)}
                  />
                ))
              )}
            </Stack>
          </SurfaceCard>
        </Box>
      )}
    </Stack>
  );
}
