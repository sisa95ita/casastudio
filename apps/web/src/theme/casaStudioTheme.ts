import { createTheme } from "@mui/material/styles";

/**
 * Central MUI theme for the CasaStudio frontend foundation.
 *
 * The first theme is intentionally light, compact, and neutral so technical
 * workspaces stay dominant while panels and controls recede into a CAD-like
 * application frame. It does not introduce font downloads or a theme switcher
 * because this phase is focused on shell architecture rather than a complete
 * design system.
 */
export const casaStudioTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f766e",
      dark: "#115e59",
      light: "#5eead4"
    },
    warning: {
      main: "#c2410c"
    },
    background: {
      default: "#f4f7f6",
      paper: "#ffffff"
    },
    divider: "#d7dfdc",
    text: {
      primary: "#172026",
      secondary: "#56676f"
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
          borderColor: "#d7dfdc"
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
          backgroundImage: "none"
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
