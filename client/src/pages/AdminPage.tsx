import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../api";
import type { User } from "../types";

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get<{ users: User[] }>("/admin/users");
        if (!cancelled) {
          setUsers(response.data.users);
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

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          ניהול קהילה
        </Typography>
        <Typography color="text.secondary">מעקב אחרי משתמשות.</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
          <CircularProgress />
        </Box>
      ) : (
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
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>אין משתמשות להצגה.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
