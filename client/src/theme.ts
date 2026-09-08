import { createTheme } from "@mui/material/styles";

/** Peach & Flamingo palette */
const flamingo = "#FF7EA5";
const flamingoLight = "#FFA8C4";
const flamingoDark = "#E5688F";
const softPeach = "#FFD8C8";
const icePeach = "#FFF8F6";
const darkAccent = "#3D2C2E";

const theme = createTheme({
  direction: "rtl",
  palette: {
    primary: {
      light: flamingoLight,
      main: flamingo,
      dark: flamingoDark,
      contrastText: darkAccent,
    },
    secondary: {
      light: icePeach,
      main: softPeach,
      dark: "#E8B5A3",
      contrastText: darkAccent,
    },
    background: {
      default: icePeach,
      paper: "#FFFFFF",
    },
    text: {
      primary: darkAccent,
      secondary: "rgba(61, 44, 46, 0.72)",
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
          borderColor: softPeach,
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
          backgroundColor: flamingo,
          color: darkAccent,
          boxShadow: "0 10px 24px rgba(255, 126, 165, 0.28)",
          "&:hover": {
            backgroundColor: flamingoDark,
            color: darkAccent,
            boxShadow: "0 12px 28px rgba(229, 104, 143, 0.32)",
          },
        },
        outlinedPrimary: {
          borderColor: softPeach,
          color: darkAccent,
          "&:hover": {
            borderColor: flamingo,
            backgroundColor: icePeach,
          },
        },
        textPrimary: {
          color: darkAccent,
          "&:hover": {
            backgroundColor: icePeach,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: icePeach,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: softPeach,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: flamingo,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: flamingo,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: darkAccent,
          "&.Mui-focused": {
            color: flamingoDark,
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: darkAccent,
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
          backgroundColor: softPeach,
          color: darkAccent,
        },
        filledPrimary: {
          backgroundColor: flamingo,
          color: darkAccent,
          boxShadow: "0 8px 18px rgba(255, 126, 165, 0.28)",
          "&:hover": {
            backgroundColor: flamingoDark,
            color: darkAccent,
          },
          "&:focus-visible": {
            backgroundColor: flamingoDark,
            color: darkAccent,
          },
        },
        outlined: {
          borderColor: softPeach,
          color: darkAccent,
          backgroundColor: "#ffffff",
          "&:hover": {
            borderColor: flamingo,
            backgroundColor: icePeach,
            color: darkAccent,
          },
        },
        colorPrimary: {
          backgroundColor: flamingo,
          color: darkAccent,
        },
        clickableColorPrimary: {
          "&:hover": {
            backgroundColor: flamingoDark,
            color: darkAccent,
          },
          "&:focus-visible": {
            backgroundColor: flamingoDark,
            color: darkAccent,
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          "&.Mui-checked": {
            color: flamingo,
          },
          "&.Mui-checked + .MuiSwitch-track": {
            backgroundColor: flamingo,
          },
        },
        track: {
          backgroundColor: softPeach,
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: flamingoDark,
          "&.Mui-checked": {
            color: flamingo,
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
          backgroundColor: softPeach,
          color: darkAccent,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: darkAccent,
          fontWeight: 800,
        },
        root: {
          borderColor: softPeach,
        },
      },
    },
  },
});

export default theme;
