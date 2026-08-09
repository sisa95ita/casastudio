import { createTheme } from "@mui/material/styles";

/**
 * Central MUI theme for the CasaStudio frontend.
 *
 * The theme is light, compact, and neutral so technical workspaces stay
 * dominant while panels and controls recede into a CAD-like application frame.
 * It avoids runtime font downloads and exposes a single stable theme instance.
 */
export const casaStudioTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#146b63",
      dark: "#0b4f49",
      light: "#7ed9ce"
    },
    warning: {
      main: "#b45309"
    },
    background: {
      default: "#eef2f1",
      paper: "#fbfcfb"
    },
    divider: "#cbd7d4",
    text: {
      primary: "#162329",
      secondary: "#53636a"
    }
  },
  shape: {
    borderRadius: 6
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: "1.35rem",
      fontWeight: 700,
      lineHeight: 1.2
    },
    h2: {
      fontSize: "1rem",
      fontWeight: 700,
      lineHeight: 1.25
    },
    button: {
      fontWeight: 700,
      textTransform: "none"
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        size: "small"
      }
    },
    MuiCheckbox: {
      defaultProps: {
        size: "small"
      }
    },
    MuiChip: {
      defaultProps: {
        size: "small"
      },
      styleOverrides: {
        root: {
          fontWeight: 700
        }
      }
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "#cbd7d4"
        }
      }
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          fontSize: "0.86rem"
        }
      }
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "0 1px 2px rgba(20, 39, 46, 0.06)"
        }
      }
    },
    MuiToolbar: {
      defaultProps: {
        disableGutters: true
      }
    }
  }
});
