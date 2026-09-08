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
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import SchoolIcon from "@mui/icons-material/School";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import NotificationBell from "./notifications/NotificationBell";
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

  const isMentor = mentorProfile?.approvalStatus === "approved";
  const hasPendingMentorApplication = mentorProfile?.approvalStatus === "pending";

  const navItems = [
    { label: "יומן", path: "/", icon: <CalendarMonthIcon /> },
    { label: "מנטוריות", path: "/mentors", icon: <SchoolIcon /> },
    ...(isMentor || hasPendingMentorApplication
      ? []
      : [{ label: "הירשמי כמנטורית", path: "/mentor-profile", icon: <PersonAddAlt1Icon /> }]),
  ];

  const navButtonSx = (active: boolean) => ({
    minHeight: 38,
    px: 1.5,
    color: active ? "primary.main" : "text.primary",
    backgroundColor: active ? "#ffffff" : "rgba(61, 44, 46, 0.08)",
    border: "1px solid rgba(61, 44, 46, 0.16)",
    boxShadow: active ? "0 8px 18px rgba(255, 126, 165, 0.18)" : "none",
    "&:hover": {
      color: active ? "primary.dark" : "text.primary",
      backgroundColor: active ? "background.default" : "rgba(61, 44, 46, 0.14)",
      boxShadow: active ? "0 8px 18px rgba(255, 126, 165, 0.18)" : "none",
    },
    "& .MuiButton-startIcon": {
      color: "inherit",
    },
  });

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          color: "text.primary",
          background: "linear-gradient(135deg, #FF7EA5 0%, #FFD8C8 100%)",
          boxShadow: "0 10px 26px rgba(255, 126, 165, 0.22)",
        }}
      >
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: { xs: 1.5, sm: 1 }, minHeight: { xs: "auto", sm: 72 } }}>
          <Typography variant="h6" component="div" sx={{ color: "text.primary", fontWeight: 900 }}>
            QueenB Match
          </Typography>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexGrow: 1, flexWrap: "wrap" }}>
            {navItems.map((item) => {
              const active = location.pathname === item.path;

              return (
                <Button
                  key={item.path}
                  component={RouterLink}
                  to={item.path}
                  startIcon={item.icon}
                  variant={active ? "contained" : "text"}
                  sx={navButtonSx(active)}
                >
                  {item.label}
                </Button>
              );
            })}

            {user?.role === "admin" && (
              <Button
                component={RouterLink}
                to="/admin"
                startIcon={<AdminPanelSettingsIcon />}
                variant={location.pathname === "/admin" ? "contained" : "text"}
                sx={navButtonSx(location.pathname === "/admin")}
              >
                אדמין
              </Button>
            )}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" useFlexGap sx={{ flexWrap: "wrap" }}>
            <NotificationBell />

            <Button
              component={RouterLink}
              to="/profile"
              startIcon={<AccountCircleIcon />}
              variant={location.pathname === "/profile" ? "contained" : "text"}
              sx={navButtonSx(location.pathname === "/profile")}
            >
              {user?.username ? `${user.username} - אזור אישי` : "אזור אישי"}
            </Button>

            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={logout}
              sx={{
                minHeight: 38,
                color: "text.primary",
                border: "1px solid rgba(61, 44, 46, 0.16)",
                backgroundColor: "rgba(61, 44, 46, 0.08)",
                "&:hover": {
                  backgroundColor: "rgba(61, 44, 46, 0.14)",
                },
              }}
            >
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
