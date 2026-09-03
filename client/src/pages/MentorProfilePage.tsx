import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { api, getApiErrorMessage } from "../api";
import type { AppLayoutContext } from "../components/AppLayout";
import MentorAvailabilityStep from "./MentorAvailabilityStep";
import type { MentorProfile } from "../types";

type WizardStep = "details" | "availability";

const HELP_AREAS = [
  "DevOps",
  "Data",
  "Cloud / Infrastructure",
  "Backend Engineer",
  "AI / Machine Learning",
  "Product",
  "Mobile (iOS / Android)",
  "Full Stack",
  "Front End",
  "Embedded / Hardware",
  "Business Development (BizDev)",
  "Technical Writing",
  "Security / Cyber",
  "R&D / Research",
  "Partnerships",
  "Marketing",
  "Growth / Acquisition",
  "Business Operations (BizOps)",
  "Solutions Engineering / Pre-Sales",
  "Sales",
  "Revenue Operations (RevOps)",
  "Operations",
  "IT",
  "Design (UX/UI)",
  "BI / Business Intelligence",
  "Agile / Scrum Master",
  "Customer Care",
  "Community Management",
  "Technical Project Manager",
  "QA",
  "אחר",
  "Finance",
  "HR",
  "Technical Support",
  "Customer Success",
];

export default function MentorProfilePage() {
  const { refreshMentorProfile } = useOutletContext<AppLayoutContext>();
  const navigate = useNavigate();

  const [step, setStep] = useState<WizardStep>("details");
  const [background, setBackground] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");

  useEffect(() => {
    api
      .get<{ mentorProfile: MentorProfile | null }>("/mentors/me")
      .then((response) => {
        const profile = response.data.mentorProfile;

        if (profile) {
          setBackground(profile.background || "");
          setTopics(profile.topics || []);
        }
      })
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const toggleTopic = (topic: string) => {
    const next = topics.includes(topic)
      ? topics.filter((item) => item !== topic)
      : [...topics, topic];

    setTopics(next);
    if (next.length > 0) {
      setDetailsError("");
    }
  };

  const handleNext = (event: FormEvent) => {
    event.preventDefault();

    if (topics.length === 0) {
      setDetailsError("יש לבחור לפחות תחום אחד");
      return;
    }

    setStep("availability");
  };

  const handleFinish = async () => {
    setFinishing(true);
    setFinishError("");

    try {
      await api.post("/mentors/me", {
        background,
        topics,
      });
      refreshMentorProfile();
      navigate("/");
    } catch (err) {
      setFinishError(getApiErrorMessage(err));
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: 280 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          הרשמה כמנטורית
        </Typography>
        <Typography color="text.secondary">
          {step === "details"
            ? "כאן את מגדירה במה תוכלי לעזור ובאיזה פורמט."
            : "הגדירי מתי תהיי זמינה לפגישות (אפשר גם לדלג ולהגדיר בהמשך)."}
        </Typography>
      </Box>

      {step === "details" ? (
        <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, maxWidth: 760 }}>
          <Box component="form" onSubmit={handleNext}>
            <Stack spacing={2.5}>
              {loadError && <Alert severity="error">{loadError}</Alert>}
              {detailsError && <Alert severity="error">{detailsError}</Alert>}

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 700 }}>
                  רקע קצר / ביו
                </Typography>
                <TextField
                  value={background}
                  onChange={(event) => setBackground(event.target.value)}
                  placeholder="ספרי לי על עצמך..."
                  multiline
                  minRows={4}
                  fullWidth
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  תחומים לעזרה
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  בחרי תחום אחד או יותר
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {HELP_AREAS.map((area) => {
                    const selected = topics.includes(area);
                    return (
                      <Chip
                        key={area}
                        label={
                          <Box component="span" dir={area === "אחר" ? "rtl" : "ltr"}>
                            {area}
                          </Box>
                        }
                        clickable
                        onClick={() => toggleTopic(area)}
                        color={selected ? "primary" : "default"}
                        variant={selected ? "filled" : "outlined"}
                      />
                    );
                  })}
                </Stack>
              </Box>

              <Button type="submit" variant="contained" endIcon={<NavigateNextIcon />}>
                הבא
              </Button>
            </Stack>
          </Box>
        </Paper>
      ) : (
        <MentorAvailabilityStep
          onBack={() => setStep("details")}
          onFinish={handleFinish}
          finishing={finishing}
          finishError={finishError}
        />
      )}
    </Stack>
  );
}
