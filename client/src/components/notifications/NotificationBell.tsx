import React, { useState } from "react";
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
import { useNavigate } from "react-router-dom";
import NotificationInboxDialogs from "./NotificationInboxDialogs";
import NotificationItemCard from "./NotificationItemCard";
import { useNotificationInbox } from "./useNotificationInbox";

const POPOVER_PAGE_SIZE = 20;

export default function NotificationBell() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const inbox = useNotificationInbox({ pageSize: POPOVER_PAGE_SIZE, autoFetch: true });

  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    inbox.fetchNotifications(1, false);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const itemActions = inbox.buildItemActions(handleClose);

  return (
    <>
      <IconButton
        onClick={handleOpen}
        aria-label="התראות"
        sx={{
          color: "text.primary",
          border: "1px solid rgba(61, 44, 46, 0.16)",
          backgroundColor: "rgba(61, 44, 46, 0.08)",
          "&:hover": {
            backgroundColor: "rgba(61, 44, 46, 0.14)",
          },
        }}
      >
        <Badge badgeContent={inbox.unreadCount} color="error">
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
            maxHeight: 480,
            mt: 1,
            border: "1px solid",
            borderColor: "secondary.main",
            borderRadius: 2,
            boxShadow: "0 18px 48px rgba(255, 126, 165, 0.16)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Stack sx={{ height: "100%", minHeight: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 1.5, pb: 1 }}
          >
            <Typography sx={{ color: "primary.dark", fontWeight: 900 }}>התראות</Typography>
            <Button
              size="small"
              onClick={inbox.markAllAsRead}
              disabled={inbox.markingAll || inbox.unreadCount === 0}
            >
              סימון הכל כנקרא
            </Button>
          </Stack>

          <Divider />

          <Box sx={{ overflowY: "auto", p: 1.5, flex: 1, minHeight: 0 }}>
            {inbox.loading ? (
              <Box sx={{ display: "grid", placeItems: "center", py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : inbox.loadError ? (
              <Alert severity="error">{inbox.loadError}</Alert>
            ) : inbox.notifications.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                אין עדכונים
              </Typography>
            ) : (
              <Stack spacing={1}>
                {inbox.actionError && <Alert severity="error">{inbox.actionError}</Alert>}
                {inbox.notifications.map((notification) => (
                  <NotificationItemCard
                    key={notification._id}
                    notification={notification}
                    actions={itemActions}
                    compact
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Divider />
          <Box sx={{ p: 1 }}>
            <Button
              fullWidth
              onClick={() => {
                handleClose();
                navigate("/notifications");
              }}
            >
              לכל ההודעות
            </Button>
          </Box>
        </Stack>
      </Popover>

      <NotificationInboxDialogs
        feedbackMeetingId={inbox.feedbackMeetingId}
        onCloseFeedback={() => inbox.setFeedbackMeetingId(null)}
        onFeedbackSubmitted={inbox.handleFeedbackSubmitted}
        availabilityPrompt={inbox.availabilityPrompt}
        onCloseAvailabilityPrompt={inbox.closeAvailabilityPrompt}
        onRemindAvailabilityLater={inbox.handleRemindAvailabilityLater}
        remindingAvailability={inbox.remindingAvailability}
        onGoToAvailability={() => {
          inbox.setAvailabilityPrompt(null);
          navigate("/profile?availability=1");
        }}
        toast={inbox.toast}
        onCloseToast={() => inbox.setToast("")}
      />
    </>
  );
}
