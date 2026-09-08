import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../../api";
import type { AdminAlertMeeting, AdminAlerts, User } from "../../types";

function formatDateTime(value?: string) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function userLabel(user: Pick<User, "username" | "email">) {
  return `${user.username} (${user.email})`;
}

function MeetingParticipants({ meeting }: { meeting: AdminAlertMeeting }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2">
        מנטורית:{" "}
        <Link href={`mailto:${meeting.mentorId.email}`} dir="ltr" underline="hover">
          {userLabel(meeting.mentorId)}
        </Link>
      </Typography>
      <Typography variant="body2">
        מנטי:{" "}
        <Link href={`mailto:${meeting.menteeId.email}`} dir="ltr" underline="hover">
          {userLabel(meeting.menteeId)}
        </Link>
      </Typography>
    </Stack>
  );
}

function AlertSection({
  title,
  subtitle,
  severity,
  emptyMessage,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  severity: "error" | "warning" | "success";
  emptyMessage: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card
      dir="rtl"
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor:
          severity === "error" ? "#ffcdd2" : severity === "warning" ? "#ffe0b2" : "#c8e6c9",
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            <Chip
              size="small"
              color={severity}
              label={count}
              sx={{ fontWeight: 700, minWidth: 36 }}
            />
          </Stack>
          <Alert severity={severity} sx={{ textAlign: "start" }}>
            {subtitle}
          </Alert>
          {count === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {emptyMessage}
            </Typography>
          ) : (
            children
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function AdminAlertsView() {
  const [alerts, setAlerts] = useState<AdminAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAlerts() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get<AdminAlerts>("/admin/alerts");
        if (!cancelled) {
          setAlerts(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAlerts();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!alerts) {
    return null;
  }

  return (
    <Stack spacing={2.5} dir="rtl">
      <Typography variant="body1" color="text.secondary">
        פריטים שדורשים תשומת לב: מחלוקות, משוב חסר, והזדמנויות להודות למנטוריות מצטיינות.
      </Typography>

      <AlertSection
        title="נדרשת פעולה"
        subtitle="פגישות במחלוקת — משתמשת אחת אישרה הגעה והשנייה הכחישה. נדרשת החלטת אדמין."
        severity="error"
        emptyMessage="אין פגישות במחלוקת כרגע."
        count={alerts.disputes.length}
      >
        <List disablePadding>
          {alerts.disputes.map((meeting, index) => (
            <React.Fragment key={meeting._id}>
              {index > 0 && <Divider component="li" />}
              <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemText
                  primary={`פגישה · ${formatDateTime(meeting.selectedTime)}`}
                  secondaryTypographyProps={{ component: "div" }}
                  secondary={
                    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                      <MeetingParticipants meeting={meeting} />
                      {meeting.attendanceResponses && (
                        <Typography variant="caption" color="text.secondary">
                          תשובות הגעה — מנטורית:{" "}
                          {meeting.attendanceResponses.mentor ?? "—"} · מנטי:{" "}
                          {meeting.attendanceResponses.mentee ?? "—"}
                        </Typography>
                      )}
                    </Stack>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </AlertSection>

      <AlertSection
        title="נדרש מעקב"
        subtitle="פגישות שאושרה בהן הגעה, אך עבר יותר משבוע בלי משוב. אפשר ליצור קשר עם המשתתפות."
        severity="warning"
        emptyMessage="אין פגישות ממתינות למשוב מעל שבוע."
        count={alerts.missingFeedback.length}
      >
        <List disablePadding>
          {alerts.missingFeedback.map((meeting, index) => (
            <React.Fragment key={meeting._id}>
              {index > 0 && <Divider component="li" />}
              <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemText
                  primary={`פגישה · ${formatDateTime(meeting.selectedTime)}`}
                  secondaryTypographyProps={{ component: "div" }}
                  secondary={
                    <Box sx={{ mt: 0.75 }}>
                      <MeetingParticipants meeting={meeting} />
                    </Box>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </AlertSection>

      <AlertSection
        title="אהבת קהילה"
        subtitle="מנטוריות עם יותר מ־10 פגישות — הזדמנות לשלוח תודה אישית."
        severity="success"
        emptyMessage="אין כרגע מנטוריות מעל הסף."
        count={alerts.outstandingMentors.length}
      >
        <List disablePadding>
          {alerts.outstandingMentors.map((mentor, index) => (
            <React.Fragment key={mentor._id}>
              {index > 0 && <Divider component="li" />}
              <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography component="span" sx={{ fontWeight: 700 }}>
                        {mentor.username}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${mentor.mentoringSessionsCount} פגישות`}
                        color="success"
                        variant="outlined"
                      />
                    </Stack>
                  }
                  secondaryTypographyProps={{ component: "div" }}
                  secondary={
                    <Link href={`mailto:${mentor.email}`} dir="ltr" underline="hover">
                      {mentor.email}
                    </Link>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </AlertSection>
    </Stack>
  );
}
