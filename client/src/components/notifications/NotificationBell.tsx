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
import { api, getApiErrorMessage } from "../../api";
import type { NotificationItem } from "../../types";

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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

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
            width: 340,
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
                {notifications.map((notification) => (
                  <Box
                    key={notification._id}
                    onClick={() => markAsRead(notification)}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      cursor: notification.read ? "default" : "pointer",
                      backgroundColor: notification.read ? "transparent" : "#fce4ec",
                      border: "1px solid",
                      borderColor: notification.read ? "transparent" : "#f8bbd0",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: "primary.dark", fontWeight: notification.read ? 500 : 800 }}
                    >
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatNotificationDate(notification.createdAt)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </Popover>
    </>
  );
}
