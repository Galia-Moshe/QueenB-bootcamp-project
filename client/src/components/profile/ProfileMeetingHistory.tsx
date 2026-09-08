import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import { api, getApiErrorMessage } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import type { AvailabilityWindow, Meeting, User } from "../../types";
import { MeetingDetailsModal } from "../meetings/MeetingDetailsModal";
import { UserProfileLink } from "../UserProfileLink";
import SurfaceCard from "../ui/SurfaceCard";

const PREVIEW_LIMIT = 5;

type MeetingHistoryResponse = {
  meetings: Meeting[];
  total: number;
  hasMore: boolean;
};

type ProfileMeetingHistoryProps = {
  role: "mentor" | "mentee";
};

function getAvailabilityWindow(meeting: Meeting): AvailabilityWindow | null {
  return meeting.availabilityWindowId && typeof meeting.availabilityWindowId !== "string"
    ? meeting.availabilityWindowId
    : null;
}

function formatWindowDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function formatMeetingDate(meeting: Meeting) {
  const availabilityWindow = getAvailabilityWindow(meeting);
  if (availabilityWindow) {
    return formatWindowDate(availabilityWindow.date);
  }

  if (!meeting.selectedTime) {
    return "-";
  }

  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short" }).format(
    new Date(meeting.selectedTime)
  );
}

function getOtherParticipant(meeting: Meeting, role: "mentor" | "mentee"): User {
  return (role === "mentor" ? meeting.menteeId : meeting.mentorId) as User;
}

function MeetingHistoryItem({
  meeting,
  role,
  onOpen,
}: {
  meeting: Meeting;
  role: "mentor" | "mentee";
  onOpen: (meeting: Meeting) => void;
}) {
  const otherParticipant = getOtherParticipant(meeting, role);

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onOpen(meeting)}
      sx={{
        display: "block",
        width: "100%",
        textAlign: "start",
        border: "1px solid",
        borderColor: "secondary.main",
        borderRadius: 1,
        bgcolor: "background.default",
        p: 1.5,
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: "secondary.main",
          boxShadow: "0 0 0 2px rgba(255, 126, 165, 0.16)",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography sx={{ color: "primary.dark", fontWeight: 800 }}>
            <UserProfileLink userId={otherParticipant._id} userName={otherParticipant.username} />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatMeetingDate(meeting)}
          </Typography>
        </Box>
        <Typography variant="body2" color="primary.main" sx={{ fontWeight: 700 }}>
          פרטי פגישה
        </Typography>
      </Stack>
    </Box>
  );
}

export default function ProfileMeetingHistory({ role }: ProfileMeetingHistoryProps) {
  const { user } = useAuth();
  const [previewMeetings, setPreviewMeetings] = useState<Meeting[]>([]);
  const [previewHasMore, setPreviewHasMore] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMeetings, setHistoryMeetings] = useState<Meeting[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const searchLabel = role === "mentor" ? "חיפוש לפי שם מנטית" : "חיפוש לפי שם מנטורית";

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError("");

    try {
      const response = await api.get<MeetingHistoryResponse>(
        `/meetings/history?role=${role}&limit=${PREVIEW_LIMIT}`
      );
      setPreviewMeetings(response.data.meetings);
      setPreviewHasMore(response.data.hasMore);
    } catch (err) {
      setPreviewError(getApiErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  }, [role]);

  const loadHistory = useCallback(
    async (search: string) => {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const query = new URLSearchParams({ role });
        if (search.trim()) {
          query.set("search", search.trim());
        }

        const response = await api.get<MeetingHistoryResponse>(
          `/meetings/history?${query.toString()}`
        );
        setHistoryMeetings(response.data.meetings);
      } catch (err) {
        setHistoryError(getApiErrorMessage(err));
      } finally {
        setHistoryLoading(false);
      }
    },
    [role]
  );

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (!historyOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadHistory(historySearch);
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [historyOpen, historySearch, loadHistory]);

  const openFullHistory = () => {
    setHistorySearch("");
    setHistoryOpen(true);
  };

  const openMeetingDetails = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  return (
    <>
      <SurfaceCard dir="rtl" sx={{ textAlign: "start", width: "100%" }}>
        <Stack spacing={2}>
          <Box sx={{ textAlign: "start" }}>
            <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
              היסטוריית פגישות
            </Typography>
            <Typography variant="body2" color="text.secondary">
              פגישות שהסתיימו — לחצי על שורה לצפייה בפרטים ובמשוב שלך
            </Typography>
          </Box>

          <Divider />

          {previewError && <Alert severity="error">{previewError}</Alert>}

          {previewLoading ? (
            <Box sx={{ display: "grid", placeItems: "center", minHeight: 140 }}>
              <CircularProgress size={28} />
            </Box>
          ) : previewMeetings.length === 0 ? (
            <Typography color="text.secondary">אין פגישות שהסתיימו עדיין.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {previewMeetings.map((meeting) => (
                <MeetingHistoryItem
                  key={meeting._id}
                  meeting={meeting}
                  role={role}
                  onOpen={openMeetingDetails}
                />
              ))}
            </Stack>
          )}

          {!previewLoading && previewHasMore && (
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={openFullHistory}
              sx={{ alignSelf: "stretch" }}
            >
              צפייה בהיסטוריית פגישות נוספת
            </Button>
          )}
        </Stack>
      </SurfaceCard>

      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ dir: "rtl", sx: { textAlign: "start" } }}
      >
        <DialogTitle sx={{ color: "primary.dark", fontWeight: 900 }}>
          היסטוריית פגישות מלאה
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label={searchLabel}
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {historyError && <Alert severity="error">{historyError}</Alert>}

            {historyLoading ? (
              <Box sx={{ display: "grid", placeItems: "center", minHeight: 180 }}>
                <CircularProgress size={28} />
              </Box>
            ) : historyMeetings.length === 0 ? (
              <Typography color="text.secondary">
                {historySearch.trim()
                  ? "לא נמצאו פגישות שתואמות לחיפוש."
                  : "אין פגישות שהסתיימו עדיין."}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {historyMeetings.map((meeting) => (
                  <MeetingHistoryItem
                    key={meeting._id}
                    meeting={meeting}
                    role={role}
                    onOpen={openMeetingDetails}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button startIcon={<CloseIcon />} onClick={() => setHistoryOpen(false)}>
            סגירה
          </Button>
        </DialogActions>
      </Dialog>

      <MeetingDetailsModal
        meeting={selectedMeeting}
        open={Boolean(selectedMeeting)}
        onClose={() => setSelectedMeeting(null)}
        viewerUserId={user?._id}
      />
    </>
  );
}
