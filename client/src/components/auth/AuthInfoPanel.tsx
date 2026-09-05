import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AuthFeatureItem from "./AuthFeatureItem";

const systemFeatures = [
  {
    icon: <Diversity3Icon />,
    title: "חיבור בין מנטוריות למנטיות",
    description: "מציאת מנטורית מתאימה לפי תחומי עניין, רקע מקצועי ונושאים שבהם תרצי להתפתח.",
  },
  {
    icon: <EventAvailableIcon />,
    title: "תיאום פגישות במקום אחד",
    description: "שליחת בקשה, הצעת זמנים ובחירת מועד שמתאים לשני הצדדים בלי הודעות מפוזרות.",
  },
  {
    icon: <ManageAccountsIcon />,
    title: "ניהול קהילתי מסודר",
    description: "מעקב אחרי פרופילים, בקשות ופגישות כדי שכל תהליך המנטורינג יהיה ברור ונגיש.",
  },
];

export default function AuthInfoPanel() {
  return (
    <Stack className="auth-info">
      <Box className="auth-intro">
        <Typography variant="h3" className="auth-title">
          כל תהליך המנטורינג במקום אחד
        </Typography>
        <Typography variant="h6" className="auth-description">
          המקום שבו מנטיות ומנטוריות נפגשות לתהליך אישי, מסודר ונגיש. המערכת עוזרת למצוא
          מנטורית מתאימה, לשלוח בקשות לפגישה, לבחור זמנים ולעקוב אחרי כל המפגשים ביומן אחד.
        </Typography>
      </Box>

      <Stack className="auth-feature-list">
        {systemFeatures.map((feature) => (
          <AuthFeatureItem
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </Stack>
    </Stack>
  );
}
