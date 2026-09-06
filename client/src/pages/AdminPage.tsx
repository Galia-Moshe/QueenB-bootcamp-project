import React, { useState } from "react";
import { Stack, Tab, Tabs } from "@mui/material";
import { AdminSystemCalendar } from "../components/admin/AdminSystemCalendar";
import { AdminUsersView } from "../components/admin/AdminUsersView";
import PageHero from "../components/ui/PageHero";

type AdminTab = "calendar" | "users";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("calendar");

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
      </Tabs>

      {activeTab === "calendar" ? <AdminSystemCalendar /> : <AdminUsersView />}
    </Stack>
  );
}
