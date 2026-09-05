import React, { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import SchoolIcon from "@mui/icons-material/School";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import type { MentorProfile } from "../types";

export type AppLayoutContext = {
  refreshMentorProfile: () => void;
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null);

  const refreshMentorProfile = useCallback(() => {
    api
      .get<{ mentorProfile: MentorProfile | null }>("/mentors/me")
      .then((response) => setMentorProfile(response.data.mentorProfile))
      .catch(() => setMentorProfile(null));
  }, []);

  useEffect(() => {
    refreshMentorProfile();
  }, [refreshMentorProfile]);

  const isMentor = Boolean(mentorProfile);

  const navItems = [
    { label: "יומן", path: "/", icon: <CalendarMonthIcon /> },
    { label: "מנטוריות", path: "/mentors", icon: <SchoolIcon /> },
    ...(isMentor
      ? []
      : [{ label: "הירשמי כמנטורית", path: "/mentor-profile", icon: <PersonAddAlt1Icon /> }]),
  ];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" component="div" sx={{ color: "primary.main", fontWeight: 800 }}>
            QueenB Match
          </Typography>

          <Stack direction="row" spacing={1} sx={{ flexGrow: 1, flexWrap: "wrap" }}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                startIcon={item.icon}
                variant={location.pathname === item.path ? "contained" : "text"}
              >
                {item.label}
              </Button>
            ))}

            {user?.role === "admin" && (
              <Button
                component={RouterLink}
                to="/admin"
                startIcon={<AdminPanelSettingsIcon />}
                variant={location.pathname === "/admin" ? "contained" : "text"}
              >
                אדמין
              </Button>
            )}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">{user?.username}</Typography>
            <Button color="inherit" startIcon={<LogoutIcon />} onClick={logout}>
              יציאה
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Outlet context={{ refreshMentorProfile } satisfies AppLayoutContext} />
      </Container>
    </Box>
  );
}
