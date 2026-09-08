import React, { useEffect, useState } from "react";
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
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../../api";
import type { Meeting, MeetingStatus, User } from "../../types";
import { meetingStatusOptions, statusColors, statusLabels } from "../../types";
import { UserProfileLink } from "../UserProfileLink";

const feedbackRoleLabels: Record<"mentor" | "mentee", string> = {
  mentor: "מנטורית",
  mentee: "מנטית",
};

const attendanceResponseLabels: Record<"yes" | "no", string> = {
  yes: "כן, התקיימה",
  no: "לא התקיימה",
};

function feedbackAuthorName(fromUserId: User | string, fallbackRole: "mentor" | "mentee") {
  if (typeof fromUserId !== "string") {
    return fromUserId.username;
  }

  return feedbackRoleLabels[fallbackRole];
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

function ParticipantDetails({
  title,
  user,
}: {
  title: string;
  user: User;
}) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography sx={{ fontWeight: 700 }}>
        <UserProfileLink userId={user._id} userName={user.username} />
      </Typography>
      <Typography variant="body2" color="text.secondary" dir="ltr" sx={{ textAlign: "start" }}>
        {user.email}
      </Typography>
    </Box>
  );
}

type MeetingDetailsModalProps = {
  meeting: Meeting | null;
  open: boolean;
  onClose: () => void;
  adminMode?: boolean;
  /** When set, only feedbacks submitted by this user are shown. */
  viewerUserId?: string;
  onMeetingUpdated?: (meeting: Meeting) => void;
};

function feedbackFromUserId(fromUserId: User | string) {
  return typeof fromUserId === "string" ? fromUserId : fromUserId._id;
}

export function MeetingDetailsModal({
  meeting,
  open,
  onClose,
  adminMode = false,
  viewerUserId,
  onMeetingUpdated,
}: MeetingDetailsModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<MeetingStatus | "">("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    setSelectedStatus(meeting?.status ?? "");
    setStatusError("");
  }, [meeting]);

  const visibleFeedbacks =
    meeting == null
      ? []
      : viewerUserId
        ? meeting.feedbacks.filter((fb) => feedbackFromUserId(fb.fromUserId) === viewerUserId)
        : meeting.feedbacks;

  const handleSaveStatus = async () => {
    if (!meeting || !selectedStatus || selectedStatus === meeting.status || savingStatus) {
      return;
    }

    setSavingStatus(true);
    setStatusError("");

    try {
      const response = await api.patch<{ meeting: Meeting }>(`/admin/meetings/${meeting._id}/status`, {
        status: selectedStatus,
      });
      onMeetingUpdated?.(response.data.meeting);
    } catch (err) {
      setStatusError(getApiErrorMessage(err));
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      dir="rtl"
      aria-labelledby="meeting-details-title"
    >
      <DialogTitle id="meeting-details-title" sx={{ fontWeight: 800 }}>
        פרטי פגישה
      </DialogTitle>

      <DialogContent dividers>
        {meeting && (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="body2" color="text.secondary">
                סטטוס:
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

            {adminMode && (
              <Stack spacing={1.5}>
                {meeting.status === "disputed" && (
                  <Alert severity="warning">
                    הפגישה במחלוקת — ניתן לעדכן ידנית את הסטטוס לאחר בדיקה.
                  </Alert>
                )}
                <FormControl fullWidth size="small">
                  <InputLabel id="admin-meeting-status-update">עדכון סטטוס</InputLabel>
                  <Select
                    labelId="admin-meeting-status-update"
                    label="עדכון סטטוס"
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value as MeetingStatus)}
                    disabled={savingStatus}
                  >
                    {meetingStatusOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {statusLabels[option]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {statusError && <Alert severity="error">{statusError}</Alert>}
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleSaveStatus}
                    disabled={savingStatus || !selectedStatus || selectedStatus === meeting.status}
                    startIcon={savingStatus ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    שמירת סטטוס
                  </Button>
                </Box>
              </Stack>
            )}

            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                זמן שנבחר
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {meeting.selectedTime ? formatDateTime(meeting.selectedTime) : "עדיין לא נבחר זמן"}
              </Typography>
            </Box>

            {meeting.topics && meeting.topics.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75 }}>
                  נושאי הפגישה
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {meeting.topics.map((topic) => (
                    <Chip key={topic} label={topic} size="small" />
                  ))}
                </Stack>
              </Box>
            )}

            {!meeting.selectedTime && meeting.proposedTimes.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  זמנים מוצעים
                </Typography>
                <Stack spacing={0.75}>
                  {meeting.proposedTimes.map((time) => (
                    <Typography key={time} variant="body2">
                      {formatDateTime(time)}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            <Divider />

            <Stack spacing={2}>
              <ParticipantDetails title="מנטורית" user={meeting.mentorId} />
              <ParticipantDetails title="מנטית" user={meeting.menteeId} />
            </Stack>

            {adminMode &&
              meeting.attendanceResponses &&
              (meeting.attendanceResponses.mentor != null ||
                meeting.attendanceResponses.mentee != null) && (
                <Box>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                    תשובות אישור הגעה
                  </Typography>
                  <Stack spacing={1}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        מנטורית
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {meeting.attendanceResponses.mentor
                          ? attendanceResponseLabels[meeting.attendanceResponses.mentor]
                          : "טרם נענתה"}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        מנטית
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {meeting.attendanceResponses.mentee
                          ? attendanceResponseLabels[meeting.attendanceResponses.mentee]
                          : "טרם נענתה"}
                      </Typography>
                    </Paper>
                  </Stack>
                </Box>
              )}

            {(meeting.status === "feedback_submitted" || visibleFeedbacks.length > 0) && (
              <Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {viewerUserId ? "המשוב שלך" : "משובים"}
                </Typography>
                {visibleFeedbacks.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {viewerUserId ? "עדיין לא שלחת משוב לפגישה זו." : "אין משובים להצגה."}
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {visibleFeedbacks.map((feedback, index) => (
                      <Paper key={`${feedback.role}-${index}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          {feedbackAuthorName(feedback.fromUserId, feedback.role)}{" "}
                          <Typography component="span" variant="body2" color="text.secondary">
                            ({feedbackRoleLabels[feedback.role]})
                          </Typography>
                        </Typography>
                        <Typography variant="body2">{feedback.content}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">
          סגירה
        </Button>
      </DialogActions>
    </Dialog>
  );
}
