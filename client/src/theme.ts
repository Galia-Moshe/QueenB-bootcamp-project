import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  direction: "rtl",
  palette: {
    primary: {
      light: "#ec407a",
      main: "#d81b60",
      dark: "#ad1457",
      contrastText: "#ffffff",
    },
    secondary: {
      light: "#f8bbd0",
      main: "#ea95b7",
      dark: "#c2185b",
    },
    background: {
      default: "#fff5f8",
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
      "Assistant",
      "Rubik",
      "Arial",
      "sans-serif",
    ].join(","),
    h4: {
      fontWeight: 900,
      letterSpacing: 0,
    },
    h6: {
      fontWeight: 800,
      letterSpacing: 0,
    },
    button: {
      fontWeight: 800,
      letterSpacing: 0,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderColor: "#f8bbd0",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "none",
          fontWeight: 800,
          letterSpacing: 0,
          textTransform: "none",
        },
        containedPrimary: {
          backgroundColor: "#d81b60",
          boxShadow: "0 10px 24px rgba(216, 27, 96, 0.2)",
          "&:hover": {
            backgroundColor: "#ad1457",
            boxShadow: "0 12px 28px rgba(173, 20, 87, 0.24)",
          },
        },
        outlinedPrimary: {
          borderColor: "#f8bbd0",
          color: "#ad1457",
          "&:hover": {
            borderColor: "#ec407a",
            backgroundColor: "#fff7fa",
          },
        },
        textPrimary: {
          color: "#ad1457",
          "&:hover": {
            backgroundColor: "#fff7fa",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#fff7fa",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#f8bbd0",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#ec407a",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#d81b60",
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#ad1457",
          "&.Mui-focused": {
            color: "#d81b60",
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: "#ad1457",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 700,
          transition: "background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
        },
        filled: {
          backgroundColor: "#fff0f5",
          color: "#ad1457",
        },
        filledPrimary: {
          backgroundColor: "#d81b60",
          color: "#ffffff",
          boxShadow: "0 8px 18px rgba(216, 27, 96, 0.24)",
          "&:hover": {
            backgroundColor: "#ad1457",
            color: "#ffffff",
          },
          "&:focus-visible": {
            backgroundColor: "#ad1457",
            color: "#ffffff",
          },
        },
        outlined: {
          borderColor: "#f8bbd0",
          color: "#ad1457",
          backgroundColor: "#ffffff",
          "&:hover": {
            borderColor: "#ec407a",
            backgroundColor: "#fff0f5",
            color: "#ad1457",
          },
        },
        colorPrimary: {
          backgroundColor: "#d81b60",
          color: "#ffffff",
        },
        clickableColorPrimary: {
          "&:hover": {
            backgroundColor: "#ad1457",
            color: "#ffffff",
          },
          "&:focus-visible": {
            backgroundColor: "#ad1457",
            color: "#ffffff",
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          "&.Mui-checked": {
            color: "#d81b60",
          },
          "&.Mui-checked + .MuiSwitch-track": {
            backgroundColor: "#d81b60",
          },
        },
        track: {
          backgroundColor: "#f8bbd0",
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#c2185b",
          "&.Mui-checked": {
            color: "#d81b60",
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
        },
        standardInfo: {
          backgroundColor: "#fff0f5",
          color: "#8f164f",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#ad1457",
          fontWeight: 800,
        },
        root: {
          borderColor: "#f8bbd0",
        },
      },
    },
  },
});

export default theme;
