import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
import MentorCard from "../components/mentors/MentorCard";
import CenteredContent from "../components/ui/CenteredContent";
import PageHero from "../components/ui/PageHero";
import SurfaceCard from "../components/ui/SurfaceCard";
import type { MentorProfile, User } from "../types";

function getMentorUser(profile: MentorProfile) {
  return typeof profile.userId === "string" ? null : profile.userId;
}

export default function MentorsPage() {
  const { user } = useAuth();
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requestingId, setRequestingId] = useState("");

  const loadMentors = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<{ mentors: MentorProfile[] }>("/mentors");
      setMentors(response.data.mentors);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentors();
  }, []);

  const requestMeeting = async (mentor: User) => {
    setError("");
    setSuccess("");
    setRequestingId(mentor._id);

    try {
      await api.post("/meetings", { mentorId: mentor._id });
      setSuccess(`הבקשה נשלחה אל ${mentor.username}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRequestingId("");
    }
  };

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <PageHero title="מנטוריות" description="בחרי מנטורית ושלחי בקשה לפגישה." />

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 280 }}>
          <CircularProgress />
        </Box>
      ) : mentors.length === 0 ? (
        <SurfaceCard centered sx={{ p: 3 }}>
          <Typography color="text.secondary">עדיין אין מנטוריות פעילות.</Typography>
        </SurfaceCard>
      ) : (
        <CenteredContent
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
            },
            gap: 2.5,
          }}
        >
          {mentors.map((profile) => {
            const mentor = getMentorUser(profile);
            const isCurrentUser = mentor?._id === user?._id;

            return (
              <MentorCard
                key={profile._id}
                profile={profile}
                mentor={mentor}
                isCurrentUser={isCurrentUser}
                requesting={requestingId === mentor?._id}
                onRequestMeeting={requestMeeting}
              />
            );
          })}
        </CenteredContent>
      )}
    </Stack>
  );
}
