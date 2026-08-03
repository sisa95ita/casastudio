import ArchitectureRoundedIcon from "@mui/icons-material/ArchitectureRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import { Box, List, ListItem, ListItemButton, Tooltip } from "@mui/material";
import { NavLink } from "react-router-dom";

const navigationItems = [
  {
    label: "Home",
    path: "/",
    icon: <HomeRoundedIcon fontSize="small" />
  },
  {
    label: "Geometry Playground",
    path: "/geometry-playground",
    icon: <ArchitectureRoundedIcon fontSize="small" />
  }
] as const;

/**
 * Renders the stable desktop navigation rail for working routes.
 *
 * The rail stays narrow and icon-forward because CasaStudio is desktop-first:
 * the workspace should receive most of the viewport, while route labels remain
 * accessible through link names and tooltips.
 */
export function NavigationRail() {
  return (
    <Box
      component="nav"
      aria-label="Primary"
      sx={{
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        width: { xs: 58, sm: 68 }
      }}
    >
      <List sx={{ display: "grid", gap: 0.5, p: 1 }}>
        {navigationItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ display: "block" }}>
            <Tooltip title={item.label} placement="right">
              <ListItemButton
                component={NavLink}
                to={item.path}
                end={item.path === "/"}
                aria-label={item.label}
                sx={{
                  alignItems: "center",
                  borderRadius: 1,
                  color: "text.secondary",
                  height: 42,
                  justifyContent: "center",
                  minWidth: 0,
                  px: 0,
                  "&.active": {
                    bgcolor: "rgba(15, 118, 110, 0.1)",
                    color: "primary.dark"
                  }
                }}
              >
                {item.icon}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
