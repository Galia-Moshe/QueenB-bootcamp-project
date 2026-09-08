import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Popover,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../../api";
import type { Meeting, NotificationItem } from "../../types";
import { MeetingFeedbackModal } from "../meetings/MeetingFeedbackModal";

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

type RescheduleInterestResponse = {
  meeting: Meeting;
  role: "mentor" | "mentee";
  interested: boolean;
  bothInterested: boolean;
  hasAvailableWindows?: boolean;
  menteeNotified?: boolean;
  schedulePath?: string;
  mentorId: string;
  message?: string;
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [feedbackMeetingId, setFeedbackMeetingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [availabilityPrompt, setAvailabilityPrompt] = useState<{
    meetingId: string;
    hasSlots: boolean;
    followUpMessage?: string;
  } | null>(null);
  const [remindingAvailability, setRemindingAvailability] = useState(false);

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

  const handleRescheduleInterest = async (
    notification: NotificationItem,
    interested: boolean
  ) => {
    if (!notification.meetingId || actingId) return;

    setActingId(notification._id);
    setActionError("");

    try {
      const response = await api.patch<RescheduleInterestResponse>(
        `/meetings/${notification.meetingId}/reschedule-interest`,
        { interested }
      );

      updateNotificationStatus(notification, "answered");

      const { role, interested: wantsReschedule, bothInterested, hasAvailableWindows, schedulePath, message } =
        response.data;

      if (!wantsReschedule) {
        if (message) setToast(message);
        return;
      }

      if (role === "mentor") {
        handleClose();
        setAvailabilityPrompt({
          meetingId: notification.meetingId!,
          hasSlots: hasAvailableWindows === true,
          followUpMessage: message,
        });
        return;
      }

      if (bothInterested && schedulePath) {
        handleClose();
        navigate(schedulePath);
        return;
      }

      if (message) {
        setToast(message);
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications();
    } finally {
      setActingId(null);
    }
  };

  const handleRescheduleReady = (notification: NotificationItem) => {
    if (!notification.actionUrl) return;

    updateNotificationStatus(notification, "answered");
    markAsRead(notification);
    handleClose();
    navigate(notification.actionUrl);
  };

  const handleAvailabilityReminderClick = (notification: NotificationItem) => {
    updateNotificationStatus(notification, "answered");
    markAsRead(notification);
    handleClose();
    navigate(notification.actionUrl || "/profile?availability=1");
  };

  const handleMentorThankYouNotificationClick = (notification: NotificationItem) => {
    markAsRead(notification);
    handleClose();
    navigate(notification.actionUrl || "/profile?role=mentor");
  };

  const handleGoToAvailabilityManagement = (notification: NotificationItem) => {
    markAsRead(notification);
    handleClose();
    navigate("/profile?availability=1");
  };

  const handleAdditionalAvailabilityResponse = async (
    notification: NotificationItem,
    response: "added" | "cannot_add"
  ) => {
    if (actingId) return;

    setActingId(notification._id);
    setActionError("");

    try {
      await api.patch(`/notifications/${notification._id}/additional-availability-response`, {
        response,
      });
      updateNotificationStatus(notification, "answered");
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications();
    } finally {
      setActingId(null);
    }
  };

  const closeAvailabilityPrompt = (showFollowUp = true) => {
    if (showFollowUp && availabilityPrompt?.followUpMessage) {
      setToast(availabilityPrompt.followUpMessage);
    }
    setAvailabilityPrompt(null);
  };

  const handleRemindAvailabilityLater = async () => {
    if (!availabilityPrompt?.meetingId || remindingAvailability) return;

    setRemindingAvailability(true);
    setActionError("");

    try {
      const response = await api.patch<{ message?: string }>(
        `/meetings/${availabilityPrompt.meetingId}/remind-availability`
      );
      setAvailabilityPrompt(null);
      setToast(response.data.message || "תזכורת נקבעה ל־24 שעות.");
    } catch (err) {
      setToast(getApiErrorMessage(err));
    } finally {
      setRemindingAvailability(false);
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

                  const showRescheduleInquiry =
                    notification.type === "reschedule_inquiry" &&
                    notification.meetingId &&
                    notification.actionStatus === "pending";

                  const showRescheduleReady =
                    notification.type === "reschedule_ready" &&
                    Boolean(notification.actionUrl) &&
                    notification.actionStatus !== "answered";

                  const showAvailabilityReminder =
                    notification.type === "availability_reminder" &&
                    notification.actionStatus !== "answered";

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

                  return (
                    <Box
                      key={notification._id}
                      onClick={() => {
                        if (showMentorSummaryLink) {
                          handleMentorThankYouNotificationClick(notification);
                        } else if (!hasInteractiveActions) {
                          markAsRead(notification);
                        }
                      }}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        cursor:
                          showMentorSummaryLink || (!notification.read && !hasInteractiveActions)
                            ? "pointer"
                            : "default",
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
                          whiteSpace: "pre-line",
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

                      {showRescheduleInquiry && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} useFlexGap flexWrap="wrap">
                          <Button
                            size="small"
                            variant="contained"
                            disabled={actingId === notification._id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRescheduleInterest(notification, true);
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
                              handleRescheduleInterest(notification, false);
                            }}
                          >
                            לא
                          </Button>
                        </Stack>
                      )}

                      {showRescheduleReady && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} useFlexGap>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRescheduleReady(notification);
                            }}
                          >
                            לקביעת הזמן החדש
                          </Button>
                        </Stack>
                      )}

                      {showAvailabilityReminder && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} useFlexGap>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAvailabilityReminderClick(notification);
                            }}
                          >
                            להוספת זמנים
                          </Button>
                        </Stack>
                      )}

                      {showAdditionalAvailabilityRequest && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} useFlexGap flexWrap="wrap">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleGoToAvailabilityManagement(notification);
                            }}
                          >
                            מעבר לניהול זמינות
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={actingId === notification._id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAdditionalAvailabilityResponse(notification, "added");
                            }}
                          >
                            הוספתי זמנים נוספים
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            disabled={actingId === notification._id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAdditionalAvailabilityResponse(notification, "cannot_add");
                            }}
                          >
                            לא אוכל להוסיף זמנים
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

      <Dialog
        open={Boolean(availabilityPrompt)}
        onClose={() => closeAvailabilityPrompt(true)}
      >
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
              <Button
                onClick={() => {
                  closeAvailabilityPrompt(true);
                }}
              >
                המשיכי ללא הוספה
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setAvailabilityPrompt(null);
                  navigate("/profile?availability=1");
                }}
              >
                הוסיפי זמנים נוספים
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={remindingAvailability}
                onClick={handleRemindAvailabilityLater}
              >
                הזכירי לי מחר (בעוד 24 שעות)
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setAvailabilityPrompt(null);
                  navigate("/profile?availability=1");
                }}
              >
                הוסיפי זמנים עכשיו
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
