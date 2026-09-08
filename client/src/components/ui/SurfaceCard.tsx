import React from "react";
import Paper, { PaperProps } from "@mui/material/Paper";
import type { SxProps, Theme } from "@mui/material/styles";

type SurfaceCardProps = PaperProps & {
  centered?: boolean;
  maxWidth?: number | string;
  muted?: boolean;
  shadow?: boolean;
};

function toSxArray(sx?: SxProps<Theme>) {
  if (!sx) return [];
  return Array.isArray(sx) ? sx : [sx];
}

export default function SurfaceCard({
  centered = false,
  maxWidth = 1120,
  muted = false,
  shadow = true,
  sx,
  ...paperProps
}: SurfaceCardProps) {
  return (
    <Paper
      {...paperProps}
      sx={[
        {
          p: 2,
          border: "1px solid",
          borderColor: "secondary.main",
          borderRadius: 2,
          backgroundColor: muted ? "background.default" : "#ffffff",
          boxShadow: shadow ? "0 18px 48px rgba(255, 126, 165, 0.12)" : "none",
        },
        centered
          ? {
              width: "100%",
              maxWidth,
              mx: "auto",
            }
          : {},
        ...toSxArray(sx),
      ]}
    />
  );
}
