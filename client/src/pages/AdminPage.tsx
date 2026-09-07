import React, { useCallback, useEffect, useState } from "react";
import { Badge, Stack, Tab, Tabs } from "@mui/material";
import { AdminPendingMentorsView } from "../components/admin/AdminPendingMentorsView";
import { AdminStatisticsView } from "../components/admin/AdminStatisticsView";
import { AdminSystemCalendar } from "../components/admin/AdminSystemCalendar";
import { AdminUsersView } from "../components/admin/AdminUsersView";
import PageHero from "../components/ui/PageHero";
import { api } from "../api";

type AdminTab = "calendar" | "users" | "statistics" | "pendingMentors";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("calendar");
  const [hasUnviewedRequests, setHasUnviewedRequests] = useState(false);

  const refreshUnviewedBadge = useCallback(async () => {
    try {
      const response = await api.get<{ hasUnviewed: boolean }>("/admin/mentors/requests");
      setHasUnviewedRequests(response.data.hasUnviewed);
    } catch {
      // Ignore badge errors; the tab content handles its own failures.
    }
  }, []);

  useEffect(() => {
    refreshUnviewedBadge();
  }, [refreshUnviewedBadge]);

  return (
    <Stack spacing={3}>
      <PageHero title="ניהול קהילה" description="מעקב אחרי פגישות המערכת והמשתמשות." />

      <Tabs
        value={activeTab}
        onChange={(_event, value: AdminTab) => setActiveTab(value)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="יומן מערכת" value="calendar" />
        <Tab label="משתמשות" value="users" />
        <Tab label="סטטיסטיקות" value="statistics" />
        <Tab
          value="pendingMentors"
          label={
            <Badge
              color="error"
              variant="dot"
              invisible={!hasUnviewedRequests}
              overlap="circular"
              sx={{
                "& .MuiBadge-badge": {
                  right: -6,
                  top: 4,
                },
              }}
            >
              מנטוריות ממתינות
            </Badge>
          }
        />
      </Tabs>

      {activeTab === "calendar" && <AdminSystemCalendar />}
      {activeTab === "users" && <AdminUsersView />}
      {activeTab === "statistics" && <AdminStatisticsView />}
      {activeTab === "pendingMentors" && (
        <AdminPendingMentorsView onUnviewedChange={setHasUnviewedRequests} />
      )}
    </Stack>
  );
}
