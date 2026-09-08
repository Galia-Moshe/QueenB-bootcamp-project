import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { api, getApiErrorMessage } from "../../api";
import {
  meetingStatusOptions,
  statusColors,
  statusLabels,
  type AdminStatistics,
} from "../../types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: "secondary.main",
        backgroundColor: "background.default",
        minWidth: 140,
        flex: "1 1 140px",
      }}
    >
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "secondary.main" }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function DemandList({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
}) {
  return (
    <Card variant="outlined" sx={{ borderColor: "secondary.main", flex: "1 1 220px", minWidth: 220 }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 800 }}>
          {title}
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            אין נתונים
          </Typography>
        ) : (
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
            {items.map((item) => (
              <Chip
                key={item.name}
                label={`${item.name} (${item.count})`}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminStatisticsView() {
  const [stats, setStats] = useState<AdminStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStatistics() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get<AdminStatistics>("/admin/statistics");
        if (!cancelled) {
          setStats(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStatistics();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      {stats && (
        <>
          <SectionCard title="מנטיות">
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
              <StatCard label="מנטיות שקבעו פגישה" value={stats.mentees.totalMentees} />
              <StatCard label="תפקיד כפול (מנטורית + מנטית)" value={stats.mentees.totalDualRole} />
            </Stack>
          </SectionCard>

          <SectionCard title="מנטוריות">
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
              <StatCard
                label="מנטוריות פעילות / סה״כ"
                value={`${stats.mentors.activeMentors} / ${stats.mentors.totalMentors}`}
              />
            </Stack>
          </SectionCard>

          <SectionCard title="פגישות לפי סטטוס">
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
              {meetingStatusOptions.map((status) => (
                <Card
                  key={status}
                  variant="outlined"
                  sx={{
                    borderColor: statusColors[status],
                    borderWidth: 2,
                    minWidth: 140,
                    flex: "1 1 140px",
                  }}
                >
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {statusLabels[status]}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: statusColors[status] }}>
                      {stats.meetings.byStatus[status]}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </SectionCard>

          <SectionCard title="פגישות לפי זמן">
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
              <StatCard label="השבוע (נוצרו או נקבעו)" value={stats.meetings.thisWeek} />
              <StatCard label="החודש (נוצרו או נקבעו)" value={stats.meetings.thisMonth} />
            </Stack>
          </SectionCard>

          <SectionCard title="משוב ואיכות">
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
              <StatCard label="אחוז מענה למשוב" value={`${stats.feedback.responseRate}%`} />
              <StatCard
                label="דירוג ממוצע"
                value={stats.feedback.averageRating ?? "לא זמין"}
              />
            </Stack>
          </SectionCard>

          <SectionCard title="מגמות וביקוש">
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
              <DemandList title="נושאים מבוקשים" items={stats.demand.topTopics} />
              <DemandList title="סטאקים פופולריים" items={stats.demand.topTechStacks} />
              <DemandList title="שפות תכנות" items={stats.demand.topProgrammingLanguages} />
            </Stack>
          </SectionCard>

          <SectionCard title="צווארי בקבוק ואזהרות">
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
              <StatCard label="אחוז ביטולים" value={`${stats.bottlenecks.cancellationRate}%`} />
              <StatCard label="מנטוריות במלוא הקיבולת" value={stats.bottlenecks.mentorsAtCapacity} />
            </Stack>
          </SectionCard>

          <SectionCard title="צמיחת קהילה">
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
              <StatCard label="משתמשות חדשות החודש" value={stats.growth.newUsersThisMonth} />
              <StatCard
                label="יחס מנטוריות מתוך כלל המשתמשות"
                value={`${stats.growth.mentorToMenteeRatio}%`}
              />
            </Stack>
          </SectionCard>
        </>
      )}
    </Stack>
  );
}
