import React from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

type PageHeroProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  sx?: SxProps<Theme>;
};

function toSxArray(sx?: SxProps<Theme>) {
  if (!sx) return [];
  return Array.isArray(sx) ? sx : [sx];
}

export default function PageHero({ title, description, action, sx }: PageHeroProps) {
  return (
    <Box
      sx={[
        {
          p: { xs: 2.5, md: 3 },
          borderRadius: 2,
          color: "text.primary",
          background: "linear-gradient(135deg, #FF7EA5 0%, #FFD8C8 100%)",
          boxShadow: "0 18px 48px rgba(255, 126, 165, 0.2)",
          ...(action
            ? {
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                gap: 2,
                alignItems: { xs: "stretch", md: "center" },
                justifyContent: "space-between",
              }
            : {}),
          "& .MuiTypography-root": {
            color: "text.primary",
          },
          "& .MuiTypography-root + .MuiTypography-root": {
            color: "text.secondary",
          },
        },
        ...toSxArray(sx),
      ]}
    >
      <Box>
        <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 900 }}>
          {title}
        </Typography>
        {description && <Typography color="text.secondary">{description}</Typography>}
      </Box>

      {action}
    </Box>
  );
}
