import React from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { Box, CircularProgress, CssBaseline, ThemeProvider } from "@mui/material";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import AdminPage from "./pages/AdminPage";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import MentorProfilePage from "./pages/MentorProfilePage";
import MentorsPage from "./pages/MentorsPage";
import theme from "./theme";

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/mentors" element={<MentorsPage />} />
        <Route path="/mentor-profile" element={<MentorProfilePage />} />
        <Route
          path="/admin"
          element={user.role === "admin" ? <AdminPage /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <ProtectedApp />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
