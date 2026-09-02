import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  direction: "rtl",
  palette: {
    primary: {
      main: "#146C94",
    },
    secondary: {
      main: "#C85C8E",
    },
    background: {
      default: "#F7F7F2",
      paper: "#FFFFFF",
    },
    success: {
      main: "#2E7D62",
    },
    warning: {
      main: "#B26A00",
    },
  },
  typography: {
    fontFamily: [
      "Rubik",
      "Arial",
      "sans-serif",
    ].join(","),
  },
  shape: {
    borderRadius: 8,
  },
});

export default theme;
