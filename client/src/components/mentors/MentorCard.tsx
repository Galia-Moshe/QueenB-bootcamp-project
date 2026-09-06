import React from "react";
import { Avatar, Box, Button, Chip, Stack, Typography } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import type { MentorProfile, User } from "../../types";
import SurfaceCard from "../ui/SurfaceCard";

type MentorCardProps = {
  profile: MentorProfile;
  mentor: User | null;
  isCurrentUser: boolean;
  onOpenAvailability: (mentor: User) => void;
};

export default function MentorCard({
  profile,
  mentor,
  isCurrentUser,
  onOpenAvailability,
}: MentorCardProps) {
  return (
    <SurfaceCard
      sx={{
        p: 2.5,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            src={mentor?.profilePicture}
            sx={{
              width: 56,
              height: 56,
              color: "#ffffff",
              background: "linear-gradient(135deg, #ec407a 0%, #ea95b7 100%)",
              border: "2px solid #f8bbd0",
              fontWeight: 900,
            }}
          >
            {mentor?.username?.[0]}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
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
      </Box>

      <Button
        variant="contained"
        startIcon={<CalendarMonthIcon />}
        disabled={!mentor || isCurrentUser}
        onClick={() => mentor && onOpenAvailability(mentor)}
        sx={{ mt: 2, alignSelf: "stretch" }}
      >
        {isCurrentUser ? "זו את" : "בקשת פגישה"}
      </Button>
    </SurfaceCard>
  );
}
