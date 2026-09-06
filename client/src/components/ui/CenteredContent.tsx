import React from "react";
import { Box } from "@mui/material";
import type { BoxProps } from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

type CenteredContentProps = BoxProps & {
  maxWidth?: number | string;
};

function toSxArray(sx?: SxProps<Theme>) {
  if (!sx) return [];
  return Array.isArray(sx) ? sx : [sx];
}

export default function CenteredContent({ maxWidth = 1120, sx, ...boxProps }: CenteredContentProps) {
  return (
    <Box
      {...boxProps}
      sx={[
        {
          width: "100%",
          maxWidth,
          mx: "auto",
        },
        ...toSxArray(sx),
      ]}
    />
  );
}
