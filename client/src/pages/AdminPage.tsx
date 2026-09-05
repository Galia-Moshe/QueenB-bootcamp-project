import React, { useState } from "react";
import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";
import { AdminSystemCalendar } from "../components/admin/AdminSystemCalendar";
import { AdminUsersView } from "../components/admin/AdminUsersView";

type AdminTab = "calendar" | "users";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("calendar");

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          ניהול קהילה
        </Typography>
        <Typography color="text.secondary">מעקב אחרי פגישות המערכת והמשתמשות.</Typography>
      </Box>

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
