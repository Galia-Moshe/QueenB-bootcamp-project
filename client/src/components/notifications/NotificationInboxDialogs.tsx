import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
} from "@mui/material";
import { MeetingFeedbackModal } from "../meetings/MeetingFeedbackModal";

type AvailabilityPrompt = {
  meetingId: string;
  hasSlots: boolean;
  followUpMessage?: string;
};

type Props = {
  feedbackMeetingId: string | null;
  onCloseFeedback: () => void;
  onFeedbackSubmitted: () => void;
  availabilityPrompt: AvailabilityPrompt | null;
  onCloseAvailabilityPrompt: (showFollowUp?: boolean) => void;
  onRemindAvailabilityLater: () => void;
  remindingAvailability: boolean;
  onGoToAvailability: () => void;
  toast: string;
  onCloseToast: () => void;
};

export default function NotificationInboxDialogs({
  feedbackMeetingId,
  onCloseFeedback,
  onFeedbackSubmitted,
  availabilityPrompt,
  onCloseAvailabilityPrompt,
  onRemindAvailabilityLater,
  remindingAvailability,
  onGoToAvailability,
  toast,
  onCloseToast,
}: Props) {
  return (
    <>
      <MeetingFeedbackModal
        meetingId={feedbackMeetingId}
        open={Boolean(feedbackMeetingId)}
        onClose={onCloseFeedback}
        onSubmitted={onFeedbackSubmitted}
      />

      <Dialog open={Boolean(availabilityPrompt)} onClose={() => onCloseAvailabilityPrompt(true)}>
        <DialogTitle sx={{ fontWeight: 900, color: "primary.dark" }}>
          {availabilityPrompt?.hasSlots ? "זמנים פנויים ביומן" : "הוספת זמינות"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {availabilityPrompt?.hasSlots
              ? "יש לך סלוטים פנויים ביומן! תרצי להוסיף זמנים נוספים לבחירת המנטית?"
              : "אין לך זמנים פנויים ביומן כרגע. כדי שהמנטית תוכל לקבוע, יש להוסיף זמנים."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
          {availabilityPrompt?.hasSlots ? (
            <>
              <Button onClick={() => onCloseAvailabilityPrompt(true)}>המשיכי ללא הוספה</Button>
              <Button variant="contained" onClick={onGoToAvailability}>
                הוסיפי זמנים נוספים
              </Button>
            </>
          ) : (
            <>
              <Button disabled={remindingAvailability} onClick={onRemindAvailabilityLater}>
                הזכירי לי מחר (בעוד 24 שעות)
              </Button>
              <Button variant="contained" onClick={onGoToAvailability}>
                הוסיפי זמנים עכשיו
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={onCloseToast}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
