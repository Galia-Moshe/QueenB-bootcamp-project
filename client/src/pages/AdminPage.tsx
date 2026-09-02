import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../api";
import type { Meeting, MeetingStatus, User } from "../types";
import { statusLabels } from "../types";

const statusOptions: Array<MeetingStatus | ""> = [
  "",
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "attendance_confirmed",
  "completed",
  "canceled",
  "feedback_submitted",
];

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [status, setStatus] = useState<MeetingStatus | "">("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (status) {
        params.set("status", status);
      }
      if (userId) {
        params.set("userId", userId);
      }

      const [usersResponse, meetingsResponse] = await Promise.all([
        api.get<{ users: User[] }>("/admin/users"),
        api.get<{ meetings: Meeting[] }>(`/admin/meetings?${params.toString()}`),
      ]);

      setUsers(usersResponse.data.users);
      setMeetings(meetingsResponse.data.meetings);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, userId]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          ניהול קהילה
        </Typography>
        <Typography color="text.secondary">מעקב אחרי משתמשות ופגישות.</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel id="status-filter-label">סטטוס</InputLabel>
            <Select
              labelId="status-filter-label"
              label="סטטוס"
              value={status}
              onChange={(event) => setStatus(event.target.value as MeetingStatus | "")}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option || "all"} value={option}>
                  {option ? statusLabels[option] : "כל הסטטוסים"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 260 }}>
            <InputLabel id="user-filter-label">משתתפת</InputLabel>
            <Select
              labelId="user-filter-label"
              label="משתתפת"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              <MenuItem value="">כל המשתתפות</MenuItem>
              {users.map((appUser) => (
                <MenuItem key={appUser._id} value={appUser._id}>
                  {appUser.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          <Paper sx={{ p: 2, borderRadius: 2, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
              פגישות
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>מנטורית</TableCell>
                  <TableCell>מנטית</TableCell>
                  <TableCell>סטטוס</TableCell>
                  <TableCell>זמן</TableCell>
                  <TableCell>נוצרה</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {meetings.map((meeting) => (
                  <TableRow key={meeting._id}>
                    <TableCell>{meeting.mentorId.username}</TableCell>
                    <TableCell>{meeting.menteeId.username}</TableCell>
                    <TableCell>
                      <Chip label={statusLabels[meeting.status]} size="small" />
                    </TableCell>
                    <TableCell>{formatDate(meeting.selectedTime)}</TableCell>
                    <TableCell>{formatDate(meeting.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {meetings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>אין פגישות להצגה.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ p: 2, borderRadius: 2, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
              משתמשות
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>שם</TableCell>
                  <TableCell>מייל</TableCell>
                  <TableCell>תפקיד</TableCell>
                  <TableCell>פגישות כמנטורית</TableCell>
                  <TableCell>פגישות כמנטית</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((appUser) => (
                  <TableRow key={appUser._id}>
                    <TableCell>{appUser.username}</TableCell>
                    <TableCell>{appUser.email}</TableCell>
                    <TableCell>{appUser.role === "admin" ? "אדמין" : "משתמשת"}</TableCell>
                    <TableCell>{appUser.mentoringSessionsCount}</TableCell>
                    <TableCell>{appUser.menteeSessionsCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
