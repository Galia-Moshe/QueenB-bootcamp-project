import React, { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { api, getApiErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
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
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          מנטוריות
        </Typography>
        <Typography color="text.secondary">בחרי מנטורית ושלחי בקשה לפגישה.</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 280 }}>
          <CircularProgress />
        </Box>
      ) : mentors.length === 0 ? (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography color="text.secondary">עדיין אין מנטוריות פעילות.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
          {mentors.map((profile) => {
            const mentor = getMentorUser(profile);
            const isCurrentUser = mentor?._id === user?._id;

            return (
              <Paper key={profile._id} sx={{ p: 2.5, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar src={mentor?.profilePicture} sx={{ width: 56, height: 56 }}>
                      {mentor?.username?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {mentor?.username}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[mentor?.jobTitle, mentor?.company].filter(Boolean).join(" · ") || "מנטורית בקהילה"}
                      </Typography>
                    </Box>
                  </Stack>

                  <Typography>{profile.background || "לא נוסף רקע עדיין."}</Typography>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {profile.topics.map((topic) => (
                      <Chip key={topic} label={topic} size="small" />
                    ))}
                    {profile.meetingLength && <Chip label={`${profile.meetingLength} דקות`} size="small" />}
                    {profile.maxMeetings && <Chip label={`עד ${profile.maxMeetings} פגישות`} size="small" />}
                  </Stack>

                  <Button
                    variant="contained"
                    startIcon={<CalendarMonthIcon />}
                    disabled={!mentor || isCurrentUser || requestingId === mentor?._id}
                    onClick={() => mentor && requestMeeting(mentor)}
                  >
                    {isCurrentUser ? "זו את" : "בקשת פגישה"}
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
