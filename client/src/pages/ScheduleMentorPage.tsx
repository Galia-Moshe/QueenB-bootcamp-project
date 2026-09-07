import React, { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../api";
import MentorAvailabilityModal from "../components/mentors/MentorAvailabilityModal";
import PageHero from "../components/ui/PageHero";
import type { User } from "../types";

export default function ScheduleMentorPage() {
  const { mentorId } = useParams<{ mentorId: string }>();
  const navigate = useNavigate();
  const [mentor, setMentor] = useState<User | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!mentorId) {
      setError("מזהה מנטורית חסר");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadMentor = async () => {
      setLoading(true);
      setError("");

      try {
        const [userResponse, availabilityResponse] = await Promise.all([
          api.get<{ user: User }>(`/users/${mentorId}`),
          api.get<{ topics: string[] }>(`/mentors/${mentorId}/availability`),
        ]);
        if (!cancelled) {
          setMentor(userResponse.data.user);
          setTopics(availabilityResponse.data.topics);
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
    };

    loadMentor();
    return () => {
      cancelled = true;
    };
  }, [mentorId]);

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <PageHero title="קביעת פגישה" description="בחרי מועד פנוי אצל המנטורית." />

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : success ? (
        <Alert severity="success">{success}</Alert>
      ) : mentor ? (
        <Typography color="text.secondary">טוען את הזמינות של {mentor.username}...</Typography>
      ) : null}

      <MentorAvailabilityModal
        open={Boolean(mentor) && !success}
        mentor={mentor}
        topics={topics}
        onClose={() => navigate("/mentors")}
        onBooked={() => {
          setSuccess(`הבקשה נשלחה אל ${mentor?.username}`);
          setMentor(null);
        }}
      />
    </Stack>
  );
}
