import { alpha, createTheme } from "@mui/material/styles";

/** Durable color primitives used to build semantic MUI theme roles. */
const colors = {
  canvas: "#f4f0e9",
  paper: "#fffdf9",
  paperMuted: "#f8f4ee",
  terracotta: "#c75532",
  terracottaDark: "#9e3f25",
  terracottaLight: "#e89b7e",
  sage: "#48665a",
  sageDark: "#2f4a40",
  sageLight: "#9eafa5",
  ink: "#20272b",
  inkMuted: "#646b6c",
  border: "#ddd7ce"
} as const;

/**
 * Central CasaStudio theme shared by the public site and product workspace.
 */
export const casaStudioTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.terracotta,
      dark: colors.terracottaDark,
      light: colors.terracottaLight,
      contrastText: "#ffffff"
    },
    secondary: {
      main: colors.sage,
      dark: colors.sageDark,
      light: colors.sageLight,
      contrastText: "#ffffff"
    },
    success: {
      main: "#3f7868",
      dark: "#28594d",
      light: "#dceae4"
    },
    warning: {
      main: "#a65b2b",
      dark: "#7a3f1d",
      light: "#f4dfce"
    },
    background: {
      default: colors.canvas,
      paper: colors.paper
    },
    divider: colors.border,
    text: {
      primary: colors.ink,
      secondary: colors.inkMuted
    }
  },
  shape: {
    borderRadius: 10
  },
  spacing: 8,
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: "clamp(2.1rem, 4.8vw, 4.9rem)",
      fontWeight: 500,
      letterSpacing: "-0.045em",
      lineHeight: 0.98
    },
    h2: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: "clamp(1.65rem, 3vw, 3rem)",
      fontWeight: 500,
      letterSpacing: "-0.035em",
      lineHeight: 1.08
    },
    h3: {
      fontSize: "1.1rem",
      fontWeight: 700,
      lineHeight: 1.3
    },
    subtitle1: {
      fontSize: "1rem",
      fontWeight: 700
    },
    subtitle2: {
      fontSize: "0.82rem",
      fontWeight: 750,
      letterSpacing: "0.01em"
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.65
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.55
    },
    overline: {
      fontSize: "0.72rem",
      fontWeight: 800,
      letterSpacing: "0.2em",
      lineHeight: 1.6
    },
    button: {
      fontWeight: 750,
      letterSpacing: "-0.01em",
      textTransform: "none"
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 42,
          paddingInline: 18
        },
        outlined: {
          backgroundColor: alpha(colors.paper, 0.72),
          borderColor: colors.border,
          color: colors.ink,
          "&:hover": {
            backgroundColor: colors.paperMuted,
            borderColor: colors.inkMuted
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          fontWeight: 700
        }
      }
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.border
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8
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
        },
        outlined: {
          borderColor: colors.border
        }
      }
    },
    MuiSelect: {
      defaultProps: {
        size: "small"
      }
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true
      }
    },
    MuiToolbar: {
      defaultProps: {
        disableGutters: true
      }
    }
  }
});
