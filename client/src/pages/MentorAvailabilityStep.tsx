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
  onBack: () => void;
  onFinish: () => Promise<void>;
  finishing: boolean;
  finishError: string;
};

export default function MentorAvailabilityStep({ onBack, onFinish, finishing, finishError }: Props) {
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
        backgroundColor: "#d81b60",
        borderColor: "transparent",
      })),
    [windowsByDate]
  );

  const dayWindows = selectedDate ? windowsByDate.get(selectedDate) || [] : [];

  const tomorrowKey = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateKey(tomorrow);
  }, []);

  const openDay = (dateKey: string) => {
    if (dateKey < tomorrowKey) return;

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
    setEditingId(null);
    setStartTime("10:00");
    setEndTime("12:00");
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

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        אם לא תגדירי זמינות כרגע, תירשמי כמנטורית אך לא תהיי זמינה לקביעת פגישות. ניתן לעדכן את
        הזמינות שלך בהמשך באזור האישי.
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
              backgroundColor: "rgba(236, 64, 122, 0.08)",
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
            validRange={{ start: tomorrowKey }}
            events={calendarEvents}
            dateClick={(arg: DateClickArg) => openDay(arg.dateStr)}
            eventClick={(arg: EventClickArg) => openDay(arg.event.startStr)}
          />
        </SurfaceCard>
      )}

      <Stack direction="row" spacing={2} justifyContent="space-between">
        <Button onClick={onBack} disabled={finishing}>
          חזרה
        </Button>
        <Button variant="contained" onClick={onFinish} disabled={finishing}>
          {finishing ? "שומרת..." : "סיום הרשמה"}
        </Button>
      </Stack>

      <Dialog
        open={Boolean(selectedDate)}
        onClose={closeDialog}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            border: "1px solid #f8bbd0",
            borderRadius: 2,
            boxShadow: "0 18px 48px rgba(136, 14, 79, 0.16)",
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
                  fullWidth
                >
                  {TIME_OPTIONS.map((time) => (
                    <MenuItem key={time} value={time}>
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
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={handleSubmitWindow} disabled={saving}>
                    {editingId ? "שמירת שינויים" : "הוסף זמינות"}
                  </Button>
                  <Button onClick={() => setFormOpen(false)} disabled={saving}>
                    ביטול
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Button startIcon={<AddIcon />} onClick={openAddForm}>
                הוסף חלון זמינות
              </Button>
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
