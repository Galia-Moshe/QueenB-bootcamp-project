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
import MentorAvailabilityModal from "../components/mentors/MentorAvailabilityModal";
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
  const [selectedMentor, setSelectedMentor] = useState<User | null>(null);

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

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <PageHero title="מנטוריות" description="בחרי מנטורית וצפי בזמנים הפנויים שלה." />

      {error && <Alert severity="error">{error}</Alert>}

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
                onOpenAvailability={setSelectedMentor}
              />
            );
          })}
        </CenteredContent>
      )}

      <MentorAvailabilityModal
        open={Boolean(selectedMentor)}
        mentor={selectedMentor}
        onClose={() => setSelectedMentor(null)}
      />
    </Stack>
  );
}
