import React, { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../../api";
import type { Meeting } from "../../types";

type MeetingFeedbackModalProps = {
  meetingId: string | null;
  open: boolean;
  onClose: () => void;
  onSubmitted?: (meeting: Meeting) => void;
};

export function MeetingFeedbackModal({
  meetingId,
  open,
  onClose,
  onSubmitted,
}: MeetingFeedbackModalProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (submitting) return;
    setContent("");
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!meetingId || submitting) return;

    const trimmed = content.trim();
    if (!trimmed) {
      setError("יש להזין תוכן משוב");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await api.post<{ meeting: Meeting }>(`/meetings/${meetingId}/feedback`, {
        content: trimmed,
      });
      onSubmitted?.(response.data.meeting);
      setContent("");
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" dir="rtl">
      <DialogTitle sx={{ fontWeight: 800 }}>משוב על הפגישה</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            נשמח לשמוע איך הייתה הפגישה — מה עבד טוב ומה אפשר לשפר.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="המשוב שלך"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            multiline
            minRows={4}
            fullWidth
            autoFocus
            disabled={submitting}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          ביטול
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting || !content.trim()}>
          שליחת משוב
        </Button>
      </DialogActions>
    </Dialog>
  );
}
