import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import EditNoteIcon from "@mui/icons-material/EditNote";
import HistoryIcon from "@mui/icons-material/History";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { api, getApiErrorMessage } from "../../api";
import type { AvailabilityWindow, Meeting, User } from "../../types";
import { UserProfileLink } from "../UserProfileLink";
import SurfaceCard from "../ui/SurfaceCard";

const PREVIEW_LIMIT = 5;

type MentorHistoryResponse = {
  meetings: Meeting[];
  total: number;
  hasMore: boolean;
};

type MentorMeetingHistoryProps = {
  targetMeetingId?: string | null;
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

function formatMeetingTime(meeting: Meeting) {
  const availabilityWindow = getAvailabilityWindow(meeting);
  if (availabilityWindow) {
    return `${availabilityWindow.startTime}-${availabilityWindow.endTime}`;
  }

  if (!meeting.selectedTime) {
    return "-";
  }

  return new Intl.DateTimeFormat("he-IL", { timeStyle: "short" }).format(
    new Date(meeting.selectedTime)
  );
}

function hasSummary(meeting: Meeting) {
  return Boolean(meeting.mentorSummary?.content?.trim());
}

function updateMeetingInList(meetings: Meeting[], updatedMeeting: Meeting) {
  return meetings.map((meeting) =>
    meeting._id === updatedMeeting._id ? updatedMeeting : meeting
  );
}

function MeetingHistoryItem({
  meeting,
  highlighted,
  showSummaryPreview = false,
  onOpenSummary,
}: {
  meeting: Meeting;
  highlighted?: boolean;
  showSummaryPreview?: boolean;
  onOpenSummary: (meeting: Meeting) => void;
}) {
  const mentee = meeting.menteeId as User;
  const summaryExists = hasSummary(meeting);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: highlighted ? "primary.main" : "#f8bbd0",
        borderRadius: 1,
        bgcolor: highlighted ? "#fce4ec" : "#fff7fa",
        p: 1.5,
        boxShadow: highlighted ? "0 0 0 2px rgba(236, 64, 122, 0.16)" : "none",
      }}
    >
      <Stack spacing={1.25}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography sx={{ color: "primary.dark", fontWeight: 800 }}>
              <UserProfileLink userId={mentee._id} userName={mentee.username} />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatMeetingDate(meeting)} | {formatMeetingTime(meeting)}
            </Typography>
          </Box>

          <Chip
            label={summaryExists ? "קיים סיכום" : "טרם נכתב סיכום"}
            size="small"
            color={summaryExists ? "success" : "default"}
            variant={summaryExists ? "filled" : "outlined"}
            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>

        {showSummaryPreview && (
          <Box>
            <Typography variant="subtitle2" sx={{ color: "primary.dark", fontWeight: 800 }}>
              סיכום פגישה
            </Typography>
            <Typography
              variant="body2"
              color={summaryExists ? "text.primary" : "text.secondary"}
              sx={{ whiteSpace: "pre-line", wordBreak: "break-word" }}
            >
              {summaryExists ? meeting.mentorSummary!.content : "טרם נכתב סיכום"}
            </Typography>
          </Box>
        )}

        <Box>
          <Button
            size="small"
            variant={summaryExists ? "outlined" : "contained"}
            startIcon={summaryExists ? <VisibilityIcon /> : <EditNoteIcon />}
            onClick={() => onOpenSummary(meeting)}
          >
            {summaryExists ? "צפייה בסיכום פגישה" : "כתיבת סיכום פגישה"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

export default function MentorMeetingHistory({ targetMeetingId }: MentorMeetingHistoryProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [previewMeetings, setPreviewMeetings] = useState<Meeting[]>([]);
  const [previewHasMore, setPreviewHasMore] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMeetings, setHistoryMeetings] = useState<Meeting[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [targetError, setTargetError] = useState("");
  const [openedTargetId, setOpenedTargetId] = useState<string | null>(null);
  const [summaryMeeting, setSummaryMeeting] = useState<Meeting | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summarySaving, setSummarySaving] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summarySuccess, setSummarySuccess] = useState("");

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError("");

    try {
      const response = await api.get<MentorHistoryResponse>(
        `/meetings/mentor-history?limit=${PREVIEW_LIMIT}`
      );
      setPreviewMeetings(response.data.meetings);
      setPreviewHasMore(response.data.hasMore);
    } catch (err) {
      setPreviewError(getApiErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (search: string) => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const query = new URLSearchParams();
      if (search.trim()) {
        query.set("search", search.trim());
      }

      const response = await api.get<MentorHistoryResponse>(
        `/meetings/mentor-history${query.toString() ? `?${query.toString()}` : ""}`
      );
      setHistoryMeetings(response.data.meetings);
    } catch (err) {
      setHistoryError(getApiErrorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openSummary = useCallback((meeting: Meeting) => {
    setSummaryMeeting(meeting);
    setSummaryDraft(meeting.mentorSummary?.content || "");
    setSummaryError("");
    setSummarySuccess("");
    setSummaryDialogOpen(true);
  }, []);

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

  useEffect(() => {
    if (!targetMeetingId || targetMeetingId === openedTargetId) {
      return;
    }

    let canceled = false;
    setTargetError("");
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    api
      .get<{ meeting: Meeting }>(`/meetings/${targetMeetingId}/summary`)
      .then((response) => {
        if (canceled) return;
        setOpenedTargetId(targetMeetingId);
        openSummary(response.data.meeting);
      })
      .catch((err) => {
        if (canceled) return;
        setOpenedTargetId(targetMeetingId);
        setTargetError(getApiErrorMessage(err));
      });

    return () => {
      canceled = true;
    };
  }, [openedTargetId, openSummary, targetMeetingId]);

  const openFullHistory = () => {
    setHistorySearch("");
    setHistoryOpen(true);
  };

  const saveSummary = async () => {
    if (!summaryMeeting || summarySaving) {
      return;
    }

    const content = summaryDraft.trim();
    if (!content) {
      setSummaryError("יש להזין סיכום פגישה");
      return;
    }

    setSummarySaving(true);
    setSummaryError("");
    setSummarySuccess("");

    try {
      const response = await api.patch<{ meeting: Meeting }>(
        `/meetings/${summaryMeeting._id}/summary`,
        { content }
      );
      const updatedMeeting = response.data.meeting;

      setSummaryMeeting(updatedMeeting);
      setSummaryDraft(updatedMeeting.mentorSummary?.content || content);
      setPreviewMeetings((current) => updateMeetingInList(current, updatedMeeting));
      setHistoryMeetings((current) => updateMeetingInList(current, updatedMeeting));
      setSummarySuccess("סיכום הפגישה נשמר");
    } catch (err) {
      setSummaryError(getApiErrorMessage(err));
    } finally {
      setSummarySaving(false);
    }
  };

  const summaryExists = summaryMeeting ? hasSummary(summaryMeeting) : false;
  const summaryUnchanged =
    summaryMeeting?.mentorSummary?.content?.trim() === summaryDraft.trim();

  return (
    <>
      <Box ref={sectionRef}>
        <SurfaceCard dir="rtl" sx={{ textAlign: "start", width: "100%" }}>
          <Stack spacing={2}>
            <Box sx={{ textAlign: "start" }}>
              <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
                היסטוריית פגישות
              </Typography>
              <Typography variant="body2" color="text.secondary">
                פגישות שהסתיימו וסיכומי פגישות
              </Typography>
            </Box>

            <Divider />

            {previewError && <Alert severity="error">{previewError}</Alert>}
            {targetError && <Alert severity="warning">{targetError}</Alert>}

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
                    highlighted={meeting._id === targetMeetingId}
                    onOpenSummary={openSummary}
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
      </Box>

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
              label="חיפוש לפי שם מנטית"
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
                    highlighted={meeting._id === targetMeetingId}
                    showSummaryPreview
                    onOpenSummary={openSummary}
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

      <Dialog
        open={summaryDialogOpen}
        onClose={() => !summarySaving && setSummaryDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ dir: "rtl", sx: { textAlign: "start" } }}
      >
        <DialogTitle sx={{ color: "primary.dark", fontWeight: 900 }}>
          {summaryExists ? "סיכום פגישה" : "כתיבת סיכום פגישה"}
        </DialogTitle>
        <DialogContent dividers>
          {summaryMeeting && (
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: "primary.dark", fontWeight: 800 }}>
                  <UserProfileLink
                    userId={summaryMeeting.menteeId._id}
                    userName={summaryMeeting.menteeId.username}
                  />
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatMeetingDate(summaryMeeting)} | {formatMeetingTime(summaryMeeting)}
                </Typography>
              </Box>

              {summaryError && <Alert severity="error">{summaryError}</Alert>}
              {summarySuccess && <Alert severity="success">{summarySuccess}</Alert>}

              <TextField
                label="סיכום פגישה"
                value={summaryDraft}
                onChange={(event) => {
                  setSummaryDraft(event.target.value);
                  setSummaryError("");
                  setSummarySuccess("");
                }}
                multiline
                minRows={6}
                inputProps={{ maxLength: 5000 }}
                helperText={`${summaryDraft.length}/5000`}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
          <Button
            startIcon={<CloseIcon />}
            onClick={() => setSummaryDialogOpen(false)}
            disabled={summarySaving}
          >
            סגירה
          </Button>
          <Button
            variant="contained"
            startIcon={summarySaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={saveSummary}
            disabled={summarySaving || !summaryDraft.trim() || summaryUnchanged}
          >
            {summaryExists ? "עדכון סיכום" : "שמירת סיכום"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
