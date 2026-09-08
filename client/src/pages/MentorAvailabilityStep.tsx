import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventClickArg } from "@fullcalendar/core";
import heLocale from "@fullcalendar/core/locales/he";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { api, getApiErrorMessage } from "../api";
import SurfaceCard from "../components/ui/SurfaceCard";
import type { AvailabilityWindow } from "../types";

const TIME_OPTIONS = Array.from({ length: 36 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
});

const PAST_TIME_ERROR = "לא ניתן לבחור שעה שכבר עברה";

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

type Props = {
  variant?: "setup" | "profile";
  onBack?: () => void;
  onFinish?: () => Promise<void>;
  finishing?: boolean;
  finishError?: string;
};

export default function MentorAvailabilityStep({
  variant = "setup",
  onBack,
  onFinish,
  finishing = false,
  finishError = "",
}: Props) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ availabilityWindows: AvailabilityWindow[] }>("/mentors/me/availability")
      .then((response) => setWindows(response.data.availabilityWindows))
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const windowsByDate = useMemo(() => {
    const map = new Map<string, AvailabilityWindow[]>();
    windows.forEach((window) => {
      const list = map.get(window.date) || [];
      list.push(window);
      map.set(window.date, list);
    });
    return map;
  }, [windows]);

  const calendarEvents = useMemo(
    () =>
      Array.from(windowsByDate.entries()).map(([date, list]) => ({
        start: date,
        allDay: true,
        display: "block" as const,
        title: list.length === 1 ? "חלון זמין אחד" : `${list.length} חלונות זמינים`,
        backgroundColor: "#FF7EA5",
        borderColor: "transparent",
        textColor: "#3D2C2E",
      })),
    [windowsByDate]
  );

  const dayWindows = selectedDate ? windowsByDate.get(selectedDate) || [] : [];

  const [now, setNow] = useState(() => new Date());

  // Keep the past-time cutoff fresh while the day dialog is open, so options
  // that pass during the session become unselectable without a reload.
  useEffect(() => {
    if (!selectedDate) return;

    const intervalId = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(intervalId);
  }, [selectedDate]);

  const todayKey = formatDateKey(now);
  const isToday = selectedDate === todayKey;
  const nowMinutes = minutesSinceMidnight(now);

  const isPastTime = (time: string) => isToday && timeToMinutes(time) <= nowMinutes;
  // The last option can only serve as an end time, so it never seeds a new window.
  const firstFutureTime = TIME_OPTIONS.slice(0, -1).find((time) => !isPastTime(time));

  const openDay = (dateKey: string) => {
    if (dateKey < todayKey) return;

    setSelectedDate(dateKey);
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
  };

  const closeDialog = () => {
    setSelectedDate(null);
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
  };

  const openAddForm = () => {
    const defaultStart = !firstFutureTime || firstFutureTime < "10:00" ? "10:00" : firstFutureTime;
    const startIndex = TIME_OPTIONS.indexOf(defaultStart);
    const defaultEnd = TIME_OPTIONS[Math.min(startIndex + 4, TIME_OPTIONS.length - 1)];

    setEditingId(null);
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (window: AvailabilityWindow) => {
    setEditingId(window._id);
    setStartTime(window.startTime);
    setEndTime(window.endTime);
    setFormError("");
    setFormOpen(true);
  };

  const handleSubmitWindow = async () => {
    if (!selectedDate) return;

    const submittedAt = new Date();
    if (
      selectedDate === formatDateKey(submittedAt) &&
      timeToMinutes(startTime) <= minutesSinceMidnight(submittedAt)
    ) {
      setFormError(PAST_TIME_ERROR);
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = { date: selectedDate, startTime, endTime };

      if (editingId) {
        const response = await api.put<{ availabilityWindow: AvailabilityWindow }>(
          `/mentors/me/availability/${editingId}`,
          payload
        );
        setWindows((prev) =>
          prev.map((window) => (window._id === editingId ? response.data.availabilityWindow : window))
        );
      } else {
        const response = await api.post<{ availabilityWindow: AvailabilityWindow }>(
          "/mentors/me/availability",
          payload
        );
        setWindows((prev) => [...prev, response.data.availabilityWindow]);
      }

      setFormOpen(false);
      setEditingId(null);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setFormError("");

    try {
      await api.delete(`/mentors/me/availability/${id}`);
      setWindows((prev) => prev.filter((window) => window._id !== id));
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const isSetup = variant === "setup";

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        {isSetup
          ? "אם לא תגדירי זמינות כרגע, תירשמי כמנטורית אך לא תהיי זמינה לקביעת פגישות. ניתן לעדכן את הזמינות שלך בהמשך באזור האישי."
          : "כאן תוכלי לראות, להוסיף ולעדכן את השעות שבהן את זמינה לפגישות."}
      </Alert>

      {loadError && <Alert severity="error">{loadError}</Alert>}
      {finishError && <Alert severity="error">{finishError}</Alert>}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 280 }}>
          <CircularProgress />
        </Box>
      ) : (
        <SurfaceCard
          sx={{
            overflow: "hidden",
            "& .fc-daygrid-day-frame": {
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            },
            "& .fc-daygrid-day-frame:hover": {
              backgroundColor: "rgba(255, 126, 165, 0.08)",
            },
            "& .fc-event": {
              cursor: "pointer",
            },
            "& .fc-day-disabled .fc-daygrid-day-frame": {
              cursor: "default",
            },
            "& .fc-day-disabled .fc-daygrid-day-frame:hover": {
              backgroundColor: "transparent",
            },
          }}
        >
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ start: "prev,next today", center: "title", end: "" }}
            buttonText={{ today: "היום" }}
            locale={heLocale}
            direction="rtl"
            height="auto"
            validRange={{ start: todayKey }}
            events={calendarEvents}
            dateClick={(arg: DateClickArg) => openDay(arg.dateStr)}
            eventClick={(arg: EventClickArg) => openDay(arg.event.startStr)}
          />
        </SurfaceCard>
      )}

      {isSetup && (
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button onClick={onBack} disabled={finishing}>
            חזרה
          </Button>
          <Button variant="contained" onClick={onFinish} disabled={finishing}>
            {finishing ? "שומרת..." : "סיום הרשמה"}
          </Button>
        </Stack>
      )}

      <Dialog
        open={Boolean(selectedDate)}
        onClose={closeDialog}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            border: "1px solid",
            borderColor: "secondary.main",
            borderRadius: 2,
            boxShadow: "0 18px 48px rgba(255, 126, 165, 0.16)",
          },
        }}
      >
        <DialogTitle>{selectedDate && formatDayLabel(selectedDate)}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}

            {dayWindows.length > 0 && (
              <Stack spacing={1}>
                {dayWindows.map((window) => (
                  <SurfaceCard
                    key={window._id}
                    variant="outlined"
                    muted
                    shadow={false}
                    sx={{
                      p: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="body2">
                      {window.startTime}–{window.endTime}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => openEditForm(window)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(window._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </SurfaceCard>
                ))}
              </Stack>
            )}

            {formOpen ? (
              <Stack spacing={2}>
                <TextField
                  select
                  label="משעה"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  error={isPastTime(startTime)}
                  helperText={isPastTime(startTime) ? PAST_TIME_ERROR : ""}
                  fullWidth
                >
                  {TIME_OPTIONS.map((time) => (
                    <MenuItem key={time} value={time} disabled={isPastTime(time)}>
                      {time}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="עד שעה"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  fullWidth
                >
                  {TIME_OPTIONS.map((time) => (
                    <MenuItem key={time} value={time} disabled={isPastTime(time)}>
                      {time}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    onClick={handleSubmitWindow}
                    disabled={saving || isPastTime(startTime)}
                  >
                    {editingId ? "שמירת שינויים" : "הוסף זמינות"}
                  </Button>
                  <Button onClick={() => setFormOpen(false)} disabled={saving}>
                    ביטול
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={1}>
                {isToday && !firstFutureTime && (
                  <Alert severity="info">לא נותרו שעות פנויות להיום</Alert>
                )}
                <Button
                  startIcon={<AddIcon />}
                  onClick={openAddForm}
                  disabled={isToday && !firstFutureTime}
                >
                  הוסף חלון זמינות
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>סגירה</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
