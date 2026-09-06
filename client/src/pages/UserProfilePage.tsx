import React, { useEffect, useState } from "react";
import { Alert, Avatar, Box, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../api";
import type { User } from "../types";

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      if (!userId) {
        setError("מזהה המשתמשת חסר");
        setLoading(false);
        return;
      }

      try {
        const response = await api.get<{ user: User }>(`/users/${userId}`);
        if (!cancelled) {
          setUser(response.data.user);
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

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !user) {
    return <Alert severity="error">{error || "המשתמשת לא נמצאה"}</Alert>;
  }

  return (
    <Paper sx={{ p: 3, borderRadius: 2, maxWidth: 720, mx: "auto" }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={user.profilePicture} sx={{ width: 72, height: 72 }}>
            {user.username.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {user.username}
            </Typography>
            <Typography color="text.secondary" dir="ltr">
              {user.email}
            </Typography>
          </Box>
        </Stack>

        {(user.jobTitle || user.company) && (
          <Typography>
            {[user.jobTitle, user.company].filter(Boolean).join(" · ")}
          </Typography>
        )}

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {[...user.programmingLanguages, ...user.techStack].map((item) => (
            <Chip key={item} label={item} size="small" />
          ))}
        </Stack>

        <Typography color="text.secondary">
          פגישות כמנטורית: {user.mentoringSessionsCount} · פגישות כמנטית:{" "}
          {user.menteeSessionsCount}
        </Typography>
      </Stack>
    </Paper>
  );
}
