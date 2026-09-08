import React from "react";
import { Box, Button, Chip, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { NotificationItem } from "../../types";

export function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export type NotificationItemActions = {
  actingId: string | null;
  onDelete: (event: React.MouseEvent, notification: NotificationItem) => void;
  onMarkAsRead: (notification: NotificationItem) => void;
  onAttendance: (notification: NotificationItem, attended: boolean) => void;
  onFillFeedbackNow: (notification: NotificationItem) => void;
  onRemindLater: (notification: NotificationItem) => void;
  onRescheduleInterest: (notification: NotificationItem, interested: boolean) => void;
  onRescheduleReady: (notification: NotificationItem) => void;
  onAvailabilityReminderClick: (notification: NotificationItem) => void;
  onMentorThankYouClick: (notification: NotificationItem) => void;
  onGoToAvailabilityManagement: (notification: NotificationItem) => void;
  onAdditionalAvailabilityResponse: (
    notification: NotificationItem,
    response: "added" | "cannot_add"
  ) => void;
};

type Props = {
  notification: NotificationItem;
  actions: NotificationItemActions;
  compact?: boolean;
};

export default function NotificationItemCard({ notification, actions, compact = false }: Props) {
  const showAttendanceActions =
    notification.type === "attendance_check" &&
    notification.meetingId &&
    notification.actionStatus === "pending";

  const showFeedbackChoice =
    notification.type === "attendance_check" &&
    notification.meetingId &&
    notification.actionStatus === "feedback_choice";

  const showFeedbackReminderAction =
    notification.type === "feedback_reminder" &&
    notification.meetingId &&
    notification.actionStatus === "pending";

  const showRescheduleInquiry =
    notification.type === "reschedule_inquiry" &&
    notification.meetingId &&
    notification.actionStatus === "pending";

  const showRescheduleReady =
    notification.type === "reschedule_ready" &&
    Boolean(notification.actionUrl) &&
    notification.actionStatus !== "answered";

  const showAvailabilityReminder =
    notification.type === "availability_reminder" && notification.actionStatus !== "answered";

  const showMentorSummaryLink =
    notification.type === "mentor_post_meeting_thank_you" &&
    Boolean(notification.actionUrl || notification.meetingId);

  const showAdditionalAvailabilityRequest =
    notification.type === "additional_availability_request" &&
    notification.actionStatus === "pending";

  const hasInteractiveActions =
    showAttendanceActions ||
    showFeedbackChoice ||
    showFeedbackReminderAction ||
    showRescheduleInquiry ||
    showRescheduleReady ||
    showAvailabilityReminder ||
    showMentorSummaryLink ||
    showAdditionalAvailabilityRequest;

  const isPending =
    notification.actionStatus === "pending" || notification.actionStatus === "feedback_choice";
  const isCompleted =
    notification.actionStatus === "answered" || notification.actionStatus === "awaiting_other";

  return (
    <Box
      onClick={() => {
        if (showMentorSummaryLink) {
          actions.onMentorThankYouClick(notification);
        } else if (!hasInteractiveActions) {
          actions.onMarkAsRead(notification);
        }
      }}
      sx={{
        p: compact ? 1.25 : 2,
        borderRadius: 1.5,
        cursor: showMentorSummaryLink || (!notification.read && !hasInteractiveActions) ? "pointer" : "default",
        backgroundColor: notification.read ? "transparent" : "#fce4ec",
        border: "1px solid",
        borderColor: isPending ? "#ec407a" : notification.read ? "#f8bbd0" : "#f48fb1",
        position: "relative",
        opacity: notification.read && isCompleted ? 0.82 : 1,
      }}
    >
      <IconButton
        size="small"
        aria-label="מחיקת התראה"
        onClick={(event) => actions.onDelete(event, notification)}
        sx={{
          position: "absolute",
          top: compact ? 4 : 8,
          left: compact ? 4 : 8,
          color: "text.secondary",
          p: 0.35,
        }}
      >
        <CloseIcon sx={{ fontSize: compact ? 16 : 18 }} />
      </IconButton>

      {!compact && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 3.5, mb: 0.5 }} flexWrap="wrap">
          {!notification.read && (
            <Chip label="לא נקראה" size="small" color="primary" sx={{ height: 22, fontWeight: 700 }} />
          )}
          {notification.read && (
            <Chip label="נקראה" size="small" variant="outlined" sx={{ height: 22 }} />
          )}
          {isPending && <Chip label="ממתינה לפעולה" size="small" color="warning" sx={{ height: 22 }} />}
          {isCompleted && <Chip label="טופלה" size="small" variant="outlined" color="success" sx={{ height: 22 }} />}
        </Stack>
      )}

      <Typography
        variant="body2"
        sx={{
          color: "primary.dark",
          fontWeight: notification.read ? 500 : 800,
          pl: compact ? 2.5 : 3.5,
          whiteSpace: "pre-line",
        }}
      >
        {notification.message}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ pl: compact ? 2.5 : 3.5 }}>
        {formatNotificationDate(notification.createdAt)}
      </Typography>

      {showAttendanceActions && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, pl: compact ? 0 : 3.5 }} useFlexGap flexWrap="wrap">
          <Button
            size="small"
            variant="contained"
            disabled={actions.actingId === notification._id}
            onClick={(event) => {
              event.stopPropagation();
              actions.onAttendance(notification, true);
            }}
          >
            כן
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={actions.actingId === notification._id}
            onClick={(event) => {
              event.stopPropagation();
              actions.onAttendance(notification, false);
            }}
          >
            לא
          </Button>
        </Stack>
      )}

      {showFeedbackChoice && (
        <Stack spacing={1} sx={{ mt: 1.25, pl: compact ? 0 : 3.5 }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              size="small"
              variant="contained"
              disabled={actions.actingId === notification._id}
              onClick={(event) => {
                event.stopPropagation();
                actions.onFillFeedbackNow(notification);
              }}
            >
              מלאי משוב עכשיו
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              disabled={actions.actingId === notification._id}
              onClick={(event) => {
                event.stopPropagation();
                actions.onRemindLater(notification);
              }}
            >
              הזכירי לי מחר (בעוד 24 שעות)
            </Button>
          </Stack>
        </Stack>
      )}

      {showFeedbackReminderAction && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, pl: compact ? 0 : 3.5 }} useFlexGap>
          <Button
            size="small"
            variant="contained"
            onClick={(event) => {
              event.stopPropagation();
              actions.onFillFeedbackNow(notification);
            }}
          >
            מלאי משוב עכשיו
          </Button>
        </Stack>
      )}

      {showRescheduleInquiry && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, pl: compact ? 0 : 3.5 }} useFlexGap flexWrap="wrap">
          <Button
            size="small"
            variant="contained"
            disabled={actions.actingId === notification._id}
            onClick={(event) => {
              event.stopPropagation();
              actions.onRescheduleInterest(notification, true);
            }}
          >
            כן
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={actions.actingId === notification._id}
            onClick={(event) => {
              event.stopPropagation();
              actions.onRescheduleInterest(notification, false);
            }}
          >
            לא
          </Button>
        </Stack>
      )}

      {showRescheduleReady && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, pl: compact ? 0 : 3.5 }} useFlexGap>
          <Button
            size="small"
            variant="contained"
            onClick={(event) => {
              event.stopPropagation();
              actions.onRescheduleReady(notification);
            }}
          >
            לקביעת הזמן החדש
          </Button>
        </Stack>
      )}

      {showAvailabilityReminder && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, pl: compact ? 0 : 3.5 }} useFlexGap>
          <Button
            size="small"
            variant="contained"
            onClick={(event) => {
              event.stopPropagation();
              actions.onAvailabilityReminderClick(notification);
            }}
          >
            להוספת זמנים
          </Button>
        </Stack>
      )}

      {showAdditionalAvailabilityRequest && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, pl: compact ? 0 : 3.5 }} useFlexGap flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              actions.onGoToAvailabilityManagement(notification);
            }}
          >
            מעבר לניהול זמינות
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={actions.actingId === notification._id}
            onClick={(event) => {
              event.stopPropagation();
              actions.onAdditionalAvailabilityResponse(notification, "added");
            }}
          >
            הוספתי זמנים נוספים
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={actions.actingId === notification._id}
            onClick={(event) => {
              event.stopPropagation();
              actions.onAdditionalAvailabilityResponse(notification, "cannot_add");
            }}
          >
            לא אוכל להוסיף זמנים
          </Button>
        </Stack>
      )}
    </Box>
  );
}
