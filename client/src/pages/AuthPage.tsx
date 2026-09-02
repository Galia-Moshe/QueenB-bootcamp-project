import React, { FormEvent, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { getApiErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";

type Mode = "login" | "register";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (event: FormEvent) => {
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
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "grid", placeItems: "center" }}>
      <Container maxWidth="sm">
        <Paper elevation={2} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: "primary.main" }}>
                QueenB Match
              </Typography>
              <Typography variant="body1" color="text.secondary">
                התחברות למערכת המנטורינג של הקהילה
              </Typography>
            </Box>

            <Tabs value={mode} onChange={(_event, value: Mode) => setMode(value)}>
              <Tab value="login" label="כניסה" icon={<LoginIcon />} iconPosition="start" />
              <Tab value="register" label="הרשמה" icon={<PersonAddIcon />} iconPosition="start" />
            </Tabs>

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                {error && <Alert severity="error">{error}</Alert>}

                {isRegister && (
                  <TextField
                    label="שם משתמשת"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    fullWidth
                  />
                )}

                <TextField
                  label="מייל"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  fullWidth
                />

                <TextField
                  label="סיסמה"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                >
                  {isRegister ? "הרשמה" : "כניסה"}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
