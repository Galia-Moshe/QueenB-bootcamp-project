import React, { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

type AuthFeatureItemProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export default function AuthFeatureItem({ icon, title, description }: AuthFeatureItemProps) {
  return (
    <Box className="auth-feature">
      <Box className="auth-feature-icon">{icon}</Box>
      <Box>
        <Typography className="auth-feature-title">{title}</Typography>
        <Typography variant="body2" color="text.secondary" className="auth-feature-description">
          {description}
        </Typography>
      </Box>
    </Box>
  );
}
