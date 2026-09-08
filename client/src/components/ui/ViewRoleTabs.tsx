import React from "react";
import { Tab, Tabs } from "@mui/material";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";

export type ViewRole = "mentee" | "mentor";

type ViewRoleTabsProps = {
  value: ViewRole;
  onChange: (role: ViewRole) => void;
  ariaLabel: string;
  menteeLabel: string;
  mentorLabel: string;
};

export default function ViewRoleTabs({
  value,
  onChange,
  ariaLabel,
  menteeLabel,
  mentorLabel,
}: ViewRoleTabsProps) {
  return (
    <Tabs
      dir="rtl"
      value={value}
      onChange={(_event, nextRole: ViewRole) => onChange(nextRole)}
      variant="fullWidth"
      aria-label={ariaLabel}
      sx={{
        width: "100%",
        maxWidth: 880,
        mx: "auto",
        minHeight: 0,
        p: 0.75,
        borderRadius: 999,
        bgcolor: "#ffffff",
        border: "1px solid",
        borderColor: "secondary.main",
        boxShadow: "0 12px 32px rgba(255, 126, 165, 0.14)",
        "& .MuiTabs-flexContainer": {
          gap: 0.75,
        },
        "& .MuiTabs-indicator": {
          height: "100%",
          borderRadius: 999,
          background: "linear-gradient(135deg, #FF7EA5 0%, #E5688F 100%)",
          boxShadow: "0 8px 20px rgba(255, 126, 165, 0.28)",
        },
        "& .MuiTab-root": {
          position: "relative",
          zIndex: 1,
          minHeight: { xs: 44, sm: 48 },
          px: { xs: 1, sm: 2 },
          borderRadius: 999,
          fontWeight: 800,
          fontSize: { xs: 13, sm: 16 },
          lineHeight: 1.2,
          whiteSpace: { xs: "normal", sm: "nowrap" },
          color: "text.primary",
          transition: "color 0.2s ease, background-color 0.2s ease",
          "& .MuiTab-iconWrapper": {
            fontSize: { xs: 18, sm: 20 },
            marginInlineEnd: { xs: 4, sm: 8 },
          },
          "&:hover": {
            bgcolor: "background.default",
          },
          "&.Mui-selected": {
            color: "primary.contrastText",
            "&:hover": {
              bgcolor: "transparent",
            },
          },
        },
      }}
    >
      <Tab
        value="mentee"
        label={menteeLabel}
        icon={<SchoolOutlinedIcon />}
        iconPosition="start"
        disableRipple
      />
      <Tab
        value="mentor"
        label={mentorLabel}
        icon={<WorkspacePremiumOutlinedIcon />}
        iconPosition="start"
        disableRipple
      />
    </Tabs>
  );
}
