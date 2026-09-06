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
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { api, getApiErrorMessage } from "../../api";
import SurfaceCard from "../ui/SurfaceCard";
import type { AvailabilityWindow, User } from "../../types";

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

type Props = {
  open: boolean;
  mentor: User | null;
  onClose: () => void;
};

export default function MentorAvailabilityModal({ open, mentor, onClose }: Props) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !mentor) {
      return;
    }

    setLoading(true);
    setLoadError("");
    setSelectedDate(null);
    setSelectedWindowId(null);

    api
      .get<{ availabilityWindows: AvailabilityWindow[] }>(`/mentors/${mentor._id}/availability`)
      .then((response) => setWindows(response.data.availabilityWindows))
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [open, mentor]);

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
        title: list.length === 1 ? "מועד זמין אחד" : `${list.length} מועדים זמינים`,
        backgroundColor: "#d81b60",
        borderColor: "transparent",
      })),
    [windowsByDate]
  );

  const initialDate = useMemo(() => {
    const sortedDates = Array.from(windowsByDate.keys()).sort();
    return sortedDates[0];
  }, [windowsByDate]);

  const dayWindows = selectedDate ? windowsByDate.get(selectedDate) || [] : [];

  const openDay = (dateKey: string) => {
    if (!windowsByDate.has(dateKey)) return;

    setSelectedDate(dateKey);
    setSelectedWindowId(null);
  };

  const handleClose = () => {
    setSelectedDate(null);
    setSelectedWindowId(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          border: "1px solid #f8bbd0",
          borderRadius: 2,
          boxShadow: "0 18px 48px rgba(136, 14, 79, 0.16)",
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
          זמינות של {mentor?.username}
        </Typography>
        <IconButton onClick={handleClose} size="small" aria-label="סגירה">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {loading ? (
            <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
              <CircularProgress />
            </Box>
          ) : loadError ? (
            <Alert severity="error">{loadError}</Alert>
          ) : windows.length === 0 ? (
            <Alert severity="info">אין כרגע מועדים זמינים אצל המנטורית הזו.</Alert>
          ) : (
            <>
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
                  "& .fc-day-unavailable .fc-daygrid-day-frame": {
                    cursor: "default",
                  },
                  "& .fc-day-unavailable .fc-daygrid-day-frame:hover": {
                    backgroundColor: "transparent",
                  },
                }}
              >
                <FullCalendar
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  initialDate={initialDate}
                  headerToolbar={{ start: "prev,next today", center: "title", end: "" }}
                  buttonText={{ today: "היום" }}
                  locale={heLocale}
                  direction="rtl"
                  height="auto"
                  events={calendarEvents}
                  dayCellClassNames={(arg) =>
                    windowsByDate.has(
                      `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, "0")}-${String(
                        arg.date.getDate()
                      ).padStart(2, "0")}`
                    )
                      ? []
                      : ["fc-day-unavailable"]
                  }
                  dateClick={(arg: DateClickArg) => openDay(arg.dateStr)}
                  eventClick={(arg: EventClickArg) => openDay(arg.event.startStr)}
                />
              </SurfaceCard>

              {selectedDate && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle1" sx={{ color: "primary.dark", fontWeight: 800, mb: 1.5 }}>
                      {formatDayLabel(selectedDate)}
                    </Typography>

                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {dayWindows.map((window) => (
                        <Button
                          key={window._id}
                          variant={selectedWindowId === window._id ? "contained" : "outlined"}
                          onClick={() => setSelectedWindowId(window._id)}
                        >
                          {window.startTime}–{window.endTime}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                </>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
