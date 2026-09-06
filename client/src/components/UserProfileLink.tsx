import React from "react";
import { Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export type UserProfileLinkProps = {
  userId: string;
  userName: string;
};

/** Reusable link to an authenticated user's public profile. */
export function UserProfileLink({ userId, userName }: UserProfileLinkProps) {
  return (
    <Link
      component={RouterLink}
      to={`/users/${userId}`}
      color="inherit"
      underline="hover"
      onClick={(event) => event.stopPropagation()}
      sx={{ cursor: "pointer", fontWeight: "inherit" }}
    >
      {userName}
    </Link>
  );
}
