import React from "react";
import { Avatar, Box, Button, Chip, Stack, Typography } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import type { MentorProfile, User } from "../../types";
import SurfaceCard from "../ui/SurfaceCard";
import { UserProfileLink } from "../UserProfileLink";

type MentorCardProps = {
  profile: MentorProfile;
  mentor: User | null;
  isCurrentUser: boolean;
  hasActiveMeeting?: boolean;
  onOpenAvailability: (mentor: User) => void;
};

function matchBadgeLabel(matchScore: number) {
  if (matchScore >= 3) {
    return "התאמה גבוהה";
  }
  if (matchScore === 1) {
    return "נושא תואם אחד";
  }
  return `${matchScore} נושאים תואמים`;
}

export default function MentorCard({
  profile,
  mentor,
  isCurrentUser,
  hasActiveMeeting = false,
  onOpenAvailability,
}: MentorCardProps) {
  const matchScore = profile.matchScore ?? 0;
  const matchedTopicSet = new Set(profile.matchedTopics ?? []);
  const showMatchBadge = matchScore > 0;

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
        <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar
              src={mentor?.profilePicture}
              sx={{
                width: 56,
                height: 56,
                color: "#ffffff",
                background: "linear-gradient(135deg, #ec407a 0%, #ea95b7 100%)",
                border: "2px solid #f8bbd0",
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {mentor?.username?.[0]}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
                {mentor ? (
                  <UserProfileLink userId={mentor._id} userName={mentor.username} />
                ) : null}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {[mentor?.jobTitle, mentor?.company].filter(Boolean).join(" · ") || "מנטורית בקהילה"}
              </Typography>
            </Box>
          </Stack>

          {showMatchBadge && (
            <Chip
              label={matchBadgeLabel(matchScore)}
              size="small"
              color="primary"
              sx={{
                fontWeight: 800,
                flexShrink: 0,
                bgcolor: matchScore >= 3 ? "primary.main" : "primary.light",
                color: "#fff",
              }}
            />
          )}
        </Stack>

        <Typography>{profile.background || "לא נוסף רקע עדיין."}</Typography>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {profile.topics.map((topic) => {
            const isMatched = matchedTopicSet.has(topic);
            return (
              <Chip
                key={topic}
                label={topic}
                size="small"
                variant={isMatched ? "filled" : "outlined"}
                color={isMatched ? "secondary" : "default"}
                sx={isMatched ? { fontWeight: 700 } : undefined}
              />
            );
          })}
          {profile.meetingLength && <Chip label={`${profile.meetingLength} דקות`} size="small" />}
          {profile.maxMeetings && <Chip label={`עד ${profile.maxMeetings} פגישות`} size="small" />}
        </Stack>
      </Box>

      <Button
        variant="contained"
        startIcon={<CalendarMonthIcon />}
        disabled={!mentor || isCurrentUser || hasActiveMeeting}
        onClick={() => mentor && onOpenAvailability(mentor)}
        sx={{ mt: 2, alignSelf: "stretch" }}
      >
        {isCurrentUser ? "זו את" : hasActiveMeeting ? "יש פגישה פעילה" : "בקשת פגישה"}
      </Button>
    </SurfaceCard>
  );
}
