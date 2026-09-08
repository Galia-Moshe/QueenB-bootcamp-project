import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import CenteredContent from "../components/ui/CenteredContent";
import PageHero from "../components/ui/PageHero";
import SurfaceCard from "../components/ui/SurfaceCard";
import NotificationInboxDialogs from "../components/notifications/NotificationInboxDialogs";
import NotificationItemCard from "../components/notifications/NotificationItemCard";
import { useNotificationInbox } from "../components/notifications/useNotificationInbox";

const PAGE_SIZE = 15;

export default function NotificationsPage() {
  const inbox = useNotificationInbox({ pageSize: PAGE_SIZE, autoFetch: true });
  const [confirmClear, setConfirmClear] = useState(false);

  const handleConfirmClear = async () => {
    await inbox.handleDeleteAll();
    setConfirmClear(false);
  };

  return (
    <CenteredContent>
      <Stack spacing={3}>
        <PageHero
          title="כל ההודעות"
          description="כאן אפשר לראות את כל ההתראות, למחוק אותן ולטפל בבקשות שממתינות לפעולה."
          action={
            <Button
              variant="contained"
              color="inherit"
              startIcon={<DeleteSweepIcon />}
              disabled={inbox.clearingAll || inbox.total === 0}
              onClick={() => setConfirmClear(true)}
              sx={{ color: "primary.dark", fontWeight: 800, alignSelf: { md: "center" } }}
            >
              מחקי הכל
            </Button>
          }
        />

        <SurfaceCard>
          {inbox.loading && inbox.notifications.length === 0 ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : inbox.loadError ? (
            <Alert severity="error">{inbox.loadError}</Alert>
          ) : inbox.notifications.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              אין הודעות להצגה
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {inbox.actionError && <Alert severity="error">{inbox.actionError}</Alert>}
              <Typography variant="body2" color="text.secondary">
                {inbox.unreadCount > 0
                  ? `${inbox.unreadCount} הודעות שלא נקראו מתוך ${inbox.total}`
                  : `${inbox.total} הודעות`}
              </Typography>
              {inbox.notifications.map((notification) => (
                <NotificationItemCard
                  key={notification._id}
                  notification={notification}
                  actions={inbox.buildItemActions()}
                />
              ))}
              {inbox.hasMore && (
                <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
                  <Button variant="outlined" onClick={inbox.loadMore} disabled={inbox.loadingMore}>
                    {inbox.loadingMore ? "טוענת..." : "טעני עוד"}
                  </Button>
                </Box>
              )}
            </Stack>
          )}
        </SurfaceCard>
      </Stack>

      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)}>
        <DialogTitle>מחיקת כל ההודעות</DialogTitle>
        <DialogContent>
          <DialogContentText>פעולה זו תמחק את כל ההתראות שלך ולא ניתן לבטל אותה.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClear(false)}>ביטול</Button>
          <Button color="error" variant="contained" onClick={handleConfirmClear} disabled={inbox.clearingAll}>
            {inbox.clearingAll ? "מוחקת..." : "מחקי הכל"}
          </Button>
        </DialogActions>
      </Dialog>

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
          inbox.navigate("/profile?availability=1");
        }}
        toast={inbox.toast}
        onCloseToast={() => inbox.setToast("")}
      />
    </CenteredContent>
  );
}
