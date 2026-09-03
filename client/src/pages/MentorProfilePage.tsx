import React, { FormEvent, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { api, getApiErrorMessage } from "../api";
import type { AppLayoutContext } from "../components/AppLayout";
import type { MentorProfile } from "../types";

function listToText(items: string[] | undefined) {
  return (items || []).join(", ");
}

function textToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function MentorProfilePage() {
  const { refreshMentorProfile } = useOutletContext<AppLayoutContext>();
  const [background, setBackground] = useState("");
  const [topics, setTopics] = useState("");
  const [maxMeetings, setMaxMeetings] = useState("");
  const [meetingLength, setMeetingLength] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .get<{ mentorProfile: MentorProfile | null }>("/mentors/me")
      .then((response) => {
        const profile = response.data.mentorProfile;

        if (profile) {
          setBackground(profile.background || "");
          setTopics(listToText(profile.topics));
          setMaxMeetings(profile.maxMeetings ? String(profile.maxMeetings) : "");
          setMeetingLength(profile.meetingLength ? String(profile.meetingLength) : "");
        }
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/mentors/me", {
        background,
        topics: textToList(topics),
        maxMeetings: maxMeetings ? Number(maxMeetings) : undefined,
        meetingLength: meetingLength ? Number(meetingLength) : undefined,
      });
      setSuccess("פרופיל המנטורית נשמר");
      refreshMentorProfile();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: 280 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          הפרופיל שלי כמנטורית
        </Typography>
        <Typography color="text.secondary">כאן את מגדירה במה תוכלי לעזור ובאיזה פורמט.</Typography>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, maxWidth: 760 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            <TextField
              label="רקע מקצועי"
              value={background}
              onChange={(event) => setBackground(event.target.value)}
              multiline
              minRows={4}
              fullWidth
            />

            <TextField
              label="נושאים למנטורינג"
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
              helperText="הפרידי נושאים בפסיקים, למשל: ראיון מוק, קריירה, React"
              fullWidth
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="מספר פגישות מקסימלי"
                type="number"
                value={maxMeetings}
                onChange={(event) => setMaxMeetings(event.target.value)}
                fullWidth
              />
              <TextField
                label="אורך פגישה בדקות"
                type="number"
                value={meetingLength}
                onChange={(event) => setMeetingLength(event.target.value)}
                fullWidth
              />
            </Stack>

            <Button type="submit" variant="contained" startIcon={<SaveIcon />} disabled={saving}>
              שמירה
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}
