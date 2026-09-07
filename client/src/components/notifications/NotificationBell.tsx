import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CloseIcon from "@mui/icons-material/Close";
import { api, getApiErrorMessage } from "../../api";
import type { Meeting, NotificationItem } from "../../types";
import { MeetingFeedbackModal } from "../meetings/MeetingFeedbackModal";

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [feedbackMeetingId, setFeedbackMeetingId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await api.get<{ notifications: NotificationItem[] }>("/notifications");
      setNotifications(response.data.notifications);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setActionError("");
    fetchNotifications();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const markAsRead = async (notification: NotificationItem) => {
    if (notification.read) return;

    setNotifications((current) =>
      current.map((item) => (item._id === notification._id ? { ...item, read: true } : item))
    );

    try {
      await api.patch(`/notifications/${notification._id}/read`);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (markingAll || unreadCount === 0) return;

    setMarkingAll(true);
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));

    try {
      await api.patch("/notifications/read-all");
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const updateNotificationStatus = (
    notification: NotificationItem,
    actionStatus: NotificationItem["actionStatus"]
  ) => {
    setNotifications((current) =>
      current.map((item) =>
        item._id === notification._id ? { ...item, actionStatus, read: true } : item
      )
    );
  };

  const handleAttendance = async (notification: NotificationItem, attended: boolean) => {
    if (!notification.meetingId || actingId) return;

    setActingId(notification._id);
    setActionError("");

    try {
      const response = await api.patch<{
        meeting: Meeting;
        outcome: "awaiting_other" | "confirmed" | "canceled" | "disputed";
        message?: string;
      }>(`/meetings/${notification.meetingId}/attendance`, {
        attended,
      });

      const { outcome, message } = response.data;

      if (outcome === "confirmed" || outcome === "disputed" || outcome === "canceled") {
        await fetchNotifications();
      } else if (outcome === "awaiting_other" && attended) {
        setNotifications((current) =>
          current.map((item) =>
            item._id === notification._id
              ? {
                  ...item,
                  actionStatus: "awaiting_other" as const,
                  read: true,
                  message: message || "תודה! המערכת ממתינה לאישור המשתתפת השנייה.",
                }
              : item
          )
        );
      } else {
        updateNotificationStatus(notification, "answered");
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications();
    } finally {
      setActingId(null);
    }
  };

  const handleFillFeedbackNow = (notification: NotificationItem) => {
    if (!notification.meetingId) return;
    setFeedbackMeetingId(notification.meetingId);
    handleClose();
  };

  const handleRemindLater = async (notification: NotificationItem) => {
    if (!notification.meetingId || actingId) return;

    setActingId(notification._id);
    setActionError("");

    try {
      await api.patch<{ meeting: Meeting }>(
        `/meetings/${notification.meetingId}/remind-feedback`
      );
      updateNotificationStatus(notification, "answered");
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications();
    } finally {
      setActingId(null);
    }
  };

  const handleFeedbackSubmitted = () => {
    setNotifications((current) =>
      current.filter(
        (item) =>
          !(
            item.meetingId &&
            item.meetingId === feedbackMeetingId &&
            (item.type === "attendance_check" || item.type === "feedback_reminder")
          )
      )
    );
    setFeedbackMeetingId(null);
  };

  const handleDeleteNotification = async (
    event: React.MouseEvent,
    notification: NotificationItem
  ) => {
    event.stopPropagation();

    setNotifications((current) => current.filter((item) => item._id !== notification._id));

    try {
      await api.delete(`/notifications/${notification._id}`);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications();
    }
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        aria-label="התראות"
        sx={{
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.32)",
          backgroundColor: "rgba(255, 255, 255, 0.14)",
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.24)",
          },
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon fontSize="small" />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            width: 360,
            maxWidth: "90vw",
            maxHeight: 420,
            mt: 1,
            border: "1px solid #f8bbd0",
            borderRadius: 2,
            boxShadow: "0 18px 48px rgba(136, 14, 79, 0.16)",
            overflow: "hidden",
          },
        }}
      >
        <Stack sx={{ height: "100%" }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 1.5, pb: 1 }}
          >
            <Typography sx={{ color: "primary.dark", fontWeight: 900 }}>התראות</Typography>
            <Button size="small" onClick={markAllAsRead} disabled={markingAll || unreadCount === 0}>
              סימון הכל כנקרא
            </Button>
          </Stack>

          <Divider />

          <Box sx={{ overflowY: "auto", p: 1.5 }}>
            {loading ? (
              <Box sx={{ display: "grid", placeItems: "center", py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : loadError ? (
              <Alert severity="error">{loadError}</Alert>
            ) : notifications.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                אין עדכונים
              </Typography>
            ) : (
              <Stack spacing={1}>
                {actionError && <Alert severity="error">{actionError}</Alert>}
                {notifications.map((notification) => {
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

                  const hasInteractiveActions =
                    showAttendanceActions || showFeedbackChoice || showFeedbackReminderAction;

                  return (
                    <Box
                      key={notification._id}
                      onClick={() => {
                        if (!hasInteractiveActions) {
                          markAsRead(notification);
                        }
                      }}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        cursor: notification.read || hasInteractiveActions ? "default" : "pointer",
                        backgroundColor: notification.read ? "transparent" : "#fce4ec",
                        border: "1px solid",
                        borderColor: notification.read ? "transparent" : "#f8bbd0",
                        position: "relative",
                      }}
                    >
                      <IconButton
                        size="small"
                        aria-label="מחיקת התראה"
                        onClick={(event) => handleDeleteNotification(event, notification)}
                        sx={{
                          position: "absolute",
                          top: 4,
                          left: 4,
                          color: "text.secondary",
                          p: 0.35,
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </IconButton>

                      <Typography
                        variant="body2"
                        sx={{
                          color: "primary.dark",
                          fontWeight: notification.read ? 500 : 800,
                          pl: 2.5,
                        }}
                      >
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ pl: 2.5 }}>
                        {formatNotificationDate(notification.createdAt)}
                      </Typography>

                      {showAttendanceActions && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} useFlexGap flexWrap="wrap">
                          <Button
                            size="small"
                            variant="contained"
                            disabled={actingId === notification._id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAttendance(notification, true);
                            }}
                          >
                            כן
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            disabled={actingId === notification._id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAttendance(notification, false);
                            }}
                          >
                            לא
                          </Button>
                        </Stack>
                      )}

                      {showFeedbackChoice && (
                        <Stack spacing={1} sx={{ mt: 1.25 }}>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Button
                              size="small"
                              variant="contained"
                              disabled={actingId === notification._id}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleFillFeedbackNow(notification);
                              }}
                            >
                              מלאי משוב עכשיו
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="inherit"
                              disabled={actingId === notification._id}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemindLater(notification);
                              }}
                            >
                              הזכירי לי מחר (בעוד 24 שעות)
                            </Button>
                          </Stack>
                        </Stack>
                      )}

                      {showFeedbackReminderAction && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} useFlexGap>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleFillFeedbackNow(notification);
                            }}
                          >
                            מלאי משוב עכשיו
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Stack>
      </Popover>

      <MeetingFeedbackModal
        meetingId={feedbackMeetingId}
        open={Boolean(feedbackMeetingId)}
        onClose={() => setFeedbackMeetingId(null)}
        onSubmitted={handleFeedbackSubmitted}
      />
    </>
  );
}
