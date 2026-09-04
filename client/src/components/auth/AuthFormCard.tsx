import React, { FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import authIllustration from "../../assets/auth-laptop-illustration.png";

export type AuthMode = "login" | "register";

type AuthFormCardProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  username: string;
  onUsernameChange: (username: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  error: string;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function AuthFormCard({
  mode,
  onModeChange,
  username,
  onUsernameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  error,
  submitting,
  onSubmit,
}: AuthFormCardProps) {
  const isRegister = mode === "register";

  return (
    <Paper elevation={3} className="auth-card">
      <Stack className="auth-card-content">
        <Box>
          <Typography variant="h4" className="auth-card-title">
            {isRegister ? "יצירת חשבון" : "כניסה למערכת"}
          </Typography>
          <Typography variant="body1" color="text.secondary" className="auth-card-description">
            {isRegister
              ? "הצטרפי ל־QueenB Match והתחילי לתאם פגישות מנטורינג."
              : "ברוכה הבאה בחזרה. התחברי כדי להמשיך לתהליך המנטורינג שלך."}
          </Typography>
        </Box>

        <Tabs className="auth-tabs" value={mode} onChange={(_event, value) => onModeChange(value)}>
          <Tab value="login" label="כניסה" icon={<LoginIcon />} iconPosition="start" />
          <Tab value="register" label="הרשמה" icon={<PersonAddIcon />} iconPosition="start" />
        </Tabs>

        <Box component="form" onSubmit={onSubmit}>
          <Stack className="auth-form-fields">
            {error && <Alert severity="error">{error}</Alert>}

            {isRegister && (
              <TextField
                label="שם משתמשת"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                required
                fullWidth
              />
            )}

            <TextField
              label="מייל"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
              fullWidth
            />

            <TextField
              label="סיסמה"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
              fullWidth
              helperText={isRegister ? "לפחות 6 תווים" : undefined}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              startIcon={isRegister ? <PersonAddIcon /> : <LoginIcon />}
              className="auth-submit-button"
            >
              {isRegister ? "הרשמה" : "כניסה"}
            </Button>
          </Stack>
        </Box>
        {/* <Box className="auth-illustration-frame">
          <Box
            component="img"
            src={authIllustration}
            alt="מנטורית עובדת על מחשב"
            className="auth-illustration"
          />
        </Box> */}
      </Stack>
    </Paper>
  );
}
