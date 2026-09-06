import React from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Meeting, User } from "../../types";
import { statusColors, statusLabels } from "../../types";
import { UserProfileLink } from "../UserProfileLink";

const feedbackRoleLabels: Record<"mentor" | "mentee", string> = {
  mentor: "מנטורית",
  mentee: "מנטית",
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
};

export function MeetingDetailsModal({ meeting, open, onClose }: MeetingDetailsModalProps) {
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

            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                זמן שנבחר
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {meeting.selectedTime ? formatDateTime(meeting.selectedTime) : "עדיין לא נבחר זמן"}
              </Typography>
            </Box>

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

            {meeting.status === "feedback_submitted" && (
              <Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                  משובים
                </Typography>
                {meeting.feedbacks.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    אין משובים להצגה.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {meeting.feedbacks.map((feedback, index) => (
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
