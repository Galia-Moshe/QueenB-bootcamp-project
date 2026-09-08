import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../../api";
import type { Meeting, NotificationItem, NotificationsListResponse } from "../../types";
import type { NotificationItemActions } from "./NotificationItemCard";

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

type AvailabilityPrompt = {
  meetingId: string;
  hasSlots: boolean;
  followUpMessage?: string;
};

type Options = {
  pageSize: number;
  autoFetch?: boolean;
};

export function useNotificationInbox({ pageSize, autoFetch = true }: Options) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [feedbackMeetingId, setFeedbackMeetingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [availabilityPrompt, setAvailabilityPrompt] = useState<AvailabilityPrompt | null>(null);
  const [remindingAvailability, setRemindingAvailability] = useState(false);

  const fetchNotifications = useCallback(
    async (nextPage = 1, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setLoadError("");

      try {
        const response = await api.get<NotificationsListResponse>("/notifications", {
          params: { page: nextPage, limit: pageSize },
        });
        const { notifications: incoming, unreadCount: nextUnread, pagination } = response.data;

        setNotifications((current) => {
          if (!append) return incoming;
          const existingIds = new Set(current.map((item) => item._id));
          return [...current, ...incoming.filter((item) => !existingIds.has(item._id))];
        });
        setUnreadCount(nextUnread);
        setPage(pagination.page);
        setTotalPages(pagination.totalPages);
        setTotal(pagination.total);
      } catch (err) {
        setLoadError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    if (autoFetch) {
      fetchNotifications(1, false);
    }
  }, [autoFetch, fetchNotifications]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    fetchNotifications(page + 1, true);
  }, [fetchNotifications, loading, loadingMore, page, totalPages]);

  const hasMore = totalPages > 0 && page < totalPages;

  const markAsRead = async (notification: NotificationItem) => {
    if (notification.read) return;

    setNotifications((current) =>
      current.map((item) => (item._id === notification._id ? { ...item, read: true } : item))
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await api.patch(`/notifications/${notification._id}/read`);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
      fetchNotifications(1, false);
    }
  };

  const markAllAsRead = async () => {
    if (markingAll || unreadCount === 0) return;

    setMarkingAll(true);
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      await api.patch("/notifications/read-all");
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
      fetchNotifications(1, false);
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
    if (!notification.read) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
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
        await fetchNotifications(1, false);
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
        if (!notification.read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
      } else {
        updateNotificationStatus(notification, "answered");
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications(1, false);
    } finally {
      setActingId(null);
    }
  };

  const handleFillFeedbackNow = (notification: NotificationItem, onBeforeNavigate?: () => void) => {
    if (!notification.meetingId) return;
    onBeforeNavigate?.();
    setFeedbackMeetingId(notification.meetingId);
  };

  const handleRemindLater = async (notification: NotificationItem) => {
    if (!notification.meetingId || actingId) return;

    setActingId(notification._id);
    setActionError("");

    try {
      await api.patch<{ meeting: Meeting }>(`/meetings/${notification.meetingId}/remind-feedback`);
      updateNotificationStatus(notification, "answered");
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications(1, false);
    } finally {
      setActingId(null);
    }
  };

  const handleRescheduleInterest = async (
    notification: NotificationItem,
    interested: boolean,
    onBeforeNavigate?: () => void
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
        onBeforeNavigate?.();
        setAvailabilityPrompt({
          meetingId: notification.meetingId!,
          hasSlots: hasAvailableWindows === true,
          followUpMessage: message,
        });
        return;
      }

      if (bothInterested && schedulePath) {
        onBeforeNavigate?.();
        navigate(schedulePath);
        return;
      }

      if (message) {
        setToast(message);
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications(1, false);
    } finally {
      setActingId(null);
    }
  };

  const handleRescheduleReady = (notification: NotificationItem, onBeforeNavigate?: () => void) => {
    if (!notification.actionUrl) return;

    updateNotificationStatus(notification, "answered");
    markAsRead(notification);
    onBeforeNavigate?.();
    navigate(notification.actionUrl);
  };

  const handleAvailabilityReminderClick = (
    notification: NotificationItem,
    onBeforeNavigate?: () => void
  ) => {
    updateNotificationStatus(notification, "answered");
    markAsRead(notification);
    onBeforeNavigate?.();
    navigate(notification.actionUrl || "/profile?availability=1");
  };

  const handleMentorThankYouNotificationClick = (
    notification: NotificationItem,
    onBeforeNavigate?: () => void
  ) => {
    markAsRead(notification);
    onBeforeNavigate?.();
    navigate(notification.actionUrl || "/profile?role=mentor");
  };

  const handleGoToAvailabilityManagement = (
    notification: NotificationItem,
    onBeforeNavigate?: () => void
  ) => {
    markAsRead(notification);
    onBeforeNavigate?.();
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
      fetchNotifications(1, false);
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

  const handleDeleteNotification = async (event: MouseEvent, notification: NotificationItem) => {
    event.stopPropagation();

    setNotifications((current) => current.filter((item) => item._id !== notification._id));
    setTotal((count) => Math.max(0, count - 1));
    if (!notification.read) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }

    try {
      await api.delete(`/notifications/${notification._id}`);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications(1, false);
    }
  };

  const handleDeleteAll = async () => {
    if (clearingAll || total === 0) return;

    setClearingAll(true);
    setActionError("");

    try {
      await api.delete("/notifications");
      setNotifications([]);
      setUnreadCount(0);
      setPage(1);
      setTotalPages(0);
      setTotal(0);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      fetchNotifications(1, false);
    } finally {
      setClearingAll(false);
    }
  };

  const buildItemActions = (onBeforeNavigate?: () => void): NotificationItemActions => ({
    actingId,
    onDelete: handleDeleteNotification,
    onMarkAsRead: markAsRead,
    onAttendance: handleAttendance,
    onFillFeedbackNow: (notification) => handleFillFeedbackNow(notification, onBeforeNavigate),
    onRemindLater: handleRemindLater,
    onRescheduleInterest: (notification, interested) =>
      handleRescheduleInterest(notification, interested, onBeforeNavigate),
    onRescheduleReady: (notification) => handleRescheduleReady(notification, onBeforeNavigate),
    onAvailabilityReminderClick: (notification) =>
      handleAvailabilityReminderClick(notification, onBeforeNavigate),
    onMentorThankYouClick: (notification) =>
      handleMentorThankYouNotificationClick(notification, onBeforeNavigate),
    onGoToAvailabilityManagement: (notification) =>
      handleGoToAvailabilityManagement(notification, onBeforeNavigate),
    onAdditionalAvailabilityResponse: handleAdditionalAvailabilityResponse,
  });

  return {
    notifications,
    unreadCount,
    total,
    loading,
    loadingMore,
    loadError,
    actionError,
    markingAll,
    clearingAll,
    actingId,
    hasMore,
    fetchNotifications,
    loadMore,
    markAllAsRead,
    handleDeleteAll,
    buildItemActions,
    feedbackMeetingId,
    setFeedbackMeetingId,
    handleFeedbackSubmitted,
    availabilityPrompt,
    setAvailabilityPrompt,
    closeAvailabilityPrompt,
    handleRemindAvailabilityLater,
    remindingAvailability,
    toast,
    setToast,
    navigate,
  };
}
