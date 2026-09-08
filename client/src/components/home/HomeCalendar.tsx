import React from "react";
import FullCalendar from "@fullcalendar/react";
import type { DayCellContentArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { Box } from "@mui/material";
import SurfaceCard from "../ui/SurfaceCard";
import { sharedCalendarContainerSx, sharedCalendarProps } from "../../utils/calendarUtils";

type HomeCalendarProps = {
  selectedDate: string | null;
  datesWithEvents: Set<string>;
  onSelectDate: (dateKey: string) => void;
};

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function HomeCalendar({ selectedDate, datesWithEvents, onSelectDate }: HomeCalendarProps) {
  const renderDayCell = (arg: DayCellContentArg) => {
    const dateKey = toDateKey(arg.date);
    const hasEvents = datesWithEvents.has(dateKey);

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          minHeight: 64,
          width: "100%",
          pt: 0.25,
        }}
      >
        <Box component="span" className="fc-daygrid-day-number" sx={{ alignSelf: "flex-start" }}>
          {arg.dayNumberText}
        </Box>
        {hasEvents && (
          <Box
            aria-hidden
            sx={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              bgcolor: "#ec407a",
              boxShadow: "0 0 0 2px rgba(236, 64, 122, 0.25)",
              mt: "auto",
              mb: 1,
              flexShrink: 0,
            }}
          />
        )}
      </Box>
    );
  };

  return (
    <SurfaceCard
      sx={{
        ...sharedCalendarContainerSx,
        "& .fc-daygrid-day-frame": {
          cursor: "pointer",
          transition: "background-color 0.15s ease",
          minHeight: 72,
        },
        "& .fc-daygrid-day-frame:hover": {
          backgroundColor: "rgba(236, 64, 122, 0.08)",
        },
        "& .fc-daygrid-day-events": {
          display: "none",
        },
        "& .fc-day-selected .fc-daygrid-day-frame": {
          backgroundColor: "rgba(216, 27, 96, 0.16)",
          boxShadow: "inset 0 0 0 2px #d81b60",
        },
      }}
    >
      <FullCalendar
        {...sharedCalendarProps}
        events={[]}
        dateClick={(arg: DateClickArg) => onSelectDate(toDateKey(arg.date))}
        dayCellClassNames={(arg) => (toDateKey(arg.date) === selectedDate ? ["fc-day-selected"] : [])}
        dayCellContent={renderDayCell}
      />
    </SurfaceCard>
  );
}
