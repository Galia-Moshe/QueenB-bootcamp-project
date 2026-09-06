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
          color: "#ffffff",
          background: "linear-gradient(135deg, #ec407a 0%, #ea95b7 100%)",
          boxShadow: "0 18px 48px rgba(236, 64, 122, 0.18)",
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
            color: "#ffffff",
          },
          "& .MuiTypography-root + .MuiTypography-root": {
            color: "rgba(255, 255, 255, 0.92)",
          },
        },
        ...toSxArray(sx),
      ]}
    >
      <Box>
        <Typography variant="h4" sx={{ color: "#ffffff", fontWeight: 900 }}>
          {title}
        </Typography>
        {description && <Typography color="text.secondary">{description}</Typography>}
      </Box>

      {action}
    </Box>
  );
}
