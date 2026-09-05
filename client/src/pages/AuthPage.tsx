import React, { FormEvent, useState } from "react";
import { Box, Container, Typography } from "@mui/material";
import { getApiErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
import AuthFormCard, { AuthMode } from "../components/auth/AuthFormCard";
import AuthInfoPanel from "../components/auth/AuthInfoPanel";
import "./AuthPage.css";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (isRegister) {
        await register({ username, email, password });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="auth-page">
      <Box component="header" className="auth-header">
        <Container maxWidth="lg">
          <Box className="auth-header-content">
            <Typography variant="h4" component="h1" className="auth-header-title">
              QueenB Match
            </Typography>
          </Box>
        </Container>
      </Box>

      <Box component="main" className="auth-main">
        <Container maxWidth="lg">
          <Box className="auth-layout">
            <AuthInfoPanel />
            <AuthFormCard
              mode={mode}
              onModeChange={setMode}
              username={username}
              onUsernameChange={setUsername}
              email={email}
              onEmailChange={setEmail}
              password={password}
              onPasswordChange={setPassword}
              error={error}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
