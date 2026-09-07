import React, { useCallback, useEffect, useState } from "react";
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
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../../api";
import type { MentorProfile, User } from "../../types";

type PendingMentorRequest = MentorProfile & {
  userId: User;
};

type PendingRequestsResponse = {
  requests: PendingMentorRequest[];
  unviewedCount: number;
  hasUnviewed: boolean;
};

function formatList(values?: string[]) {
  if (!values || values.length === 0) {
    return "—";
  }
  return values.join(", ");
}

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

type AdminPendingMentorsViewProps = {
  onUnviewedChange?: (hasUnviewed: boolean) => void;
};

export function AdminPendingMentorsView({ onUnviewedChange }: AdminPendingMentorsViewProps) {
  const [requests, setRequests] = useState<PendingMentorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PendingMentorRequest | null>(null);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<PendingRequestsResponse>("/admin/mentors/requests");
      setRequests(response.data.requests);
      onUnviewedChange?.(response.data.hasUnviewed);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [onUnviewedChange]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await api.put("/admin/mentors/requests/mark-viewed");
        if (!cancelled) {
          onUnviewedChange?.(false);
        }
      } catch {
        // Still load the list even if mark-viewed fails.
      }

      if (!cancelled) {
        await loadRequests();
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [loadRequests, onUnviewedChange]);

  const closeDialog = () => {
    setSelected(null);
    setShowRejectReason(false);
    setRejectionReason("");
    setActionError("");
  };

  const handleApprove = async () => {
    if (!selected) {
      return;
    }

    setActing(true);
    setActionError("");

    try {
      await api.put(`/admin/mentors/requests/${selected._id}/approve`);
      setRequests((current) => current.filter((item) => item._id !== selected._id));
      closeDialog();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) {
      return;
    }

    if (!showRejectReason) {
      setShowRejectReason(true);
      return;
    }

    setActing(true);
    setActionError("");

    try {
      await api.put(`/admin/mentors/requests/${selected._id}/reject`, {
        rejectionReason: rejectionReason.trim() || undefined,
      });
      setRequests((current) => current.filter((item) => item._id !== selected._id));
      closeDialog();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedUser = selected?.userId;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, borderRadius: 2, overflowX: "auto" }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
          מנטוריות ממתינות לאישור
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>שם</TableCell>
              <TableCell>מייל</TableCell>
              <TableCell>תפקיד</TableCell>
              <TableCell>תחומים</TableCell>
              <TableCell>תאריך הגשה</TableCell>
              <TableCell>סטטוס צפייה</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((request) => {
              const user = request.userId;
              return (
                <TableRow
                  key={request._id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelected(request);
                    setShowRejectReason(false);
                    setRejectionReason("");
                    setActionError("");
                  }}
                >
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.jobTitle || "—"}</TableCell>
                  <TableCell>{formatList(request.topics)}</TableCell>
                  <TableCell>{formatDate(request.createdAt)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={request.isViewedByAdmin ? "נצפה" : "חדש"}
                      color={request.isViewedByAdmin ? "default" : "error"}
                      variant={request.isViewedByAdmin ? "outlined" : "filled"}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>אין בקשות ממתינות כרגע.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={Boolean(selected)} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>סקירת בקשת מנטורית</DialogTitle>
        <DialogContent dividers>
          {actionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionError}
            </Alert>
          )}

          {selected && selectedUser && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  פרטי משתמשת
                </Typography>
                <Typography fontWeight={700}>{selectedUser.username}</Typography>
                <Typography variant="body2">{selectedUser.email}</Typography>
              </Box>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>תפקיד:</strong> {selectedUser.jobTitle || "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>חברה:</strong> {selectedUser.company || "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>שנות ניסיון:</strong>{" "}
                  {selectedUser.yearsOfExperience ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>שפות תכנות:</strong> {formatList(selectedUser.programmingLanguages)}
                </Typography>
                <Typography variant="body2">
                  <strong>טק סטאק:</strong> {formatList(selectedUser.techStack)}
                </Typography>
                <Typography variant="body2">
                  <strong>תחומי חונכות:</strong> {formatList(selected.topics)}
                </Typography>
                <Typography variant="body2">
                  <strong>רקע:</strong> {selected.background || "—"}
                </Typography>
                {(selectedUser.githubLink || selectedUser.linkedinLink) && (
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    {selectedUser.githubLink && (
                      <Link href={selectedUser.githubLink} target="_blank" rel="noopener noreferrer">
                        GitHub
                      </Link>
                    )}
                    {selectedUser.linkedinLink && (
                      <Link
                        href={selectedUser.linkedinLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        LinkedIn
                      </Link>
                    )}
                  </Stack>
                )}
              </Stack>

              {showRejectReason && (
                <TextField
                  label="סיבת דחייה (אופציונלי)"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                  placeholder="אפשר להשאיר ריק או לפרט למה הבקשה נדחתה"
                />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDialog} disabled={acting}>
            ביטול
          </Button>
          <Button color="error" variant="outlined" onClick={handleReject} disabled={acting}>
            {showRejectReason ? "אישור דחייה" : "דחייה"}
          </Button>
          <Button color="primary" variant="contained" onClick={handleApprove} disabled={acting}>
            {acting ? "מעבד..." : "אישור"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
