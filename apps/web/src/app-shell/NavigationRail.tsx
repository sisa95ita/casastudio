import ArchitectureRoundedIcon from "@mui/icons-material/ArchitectureRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { Box, List, ListItem, ListItemButton, Typography } from "@mui/material";
import { NavLink } from "react-router-dom";

import { demoProjectEntry } from "../development/demo-project-entry";
import { useCasaTranslation } from "../i18n";

/** Product-backed destinations exposed in primary navigation. */
const navigationItems = [
  {
    labelKey: "items.projects",
    path: "/app",
    icon: <FolderRoundedIcon />,
    end: true
  },
  {
    labelKey: "items.projectViewer",
    path: `/app/projects/${demoProjectEntry.id}`,
    icon: <ArchitectureRoundedIcon />,
    end: false
  }
] as const;

/** Renders compact primary navigation to product-backed destinations. */
export function NavigationRail() {
  const { t } = useCasaTranslation("navigation");

  return (
    <Box component="nav" aria-label={t("landmarks.primary")} className="project-navigation">
      <List className="project-navigation__list">
        {navigationItems.map((item) => {
          const label = t(item.labelKey);

          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={NavLink}
                to={item.path}
                end={item.end}
                aria-label={label}
                className="project-navigation__item"
              >
                {item.icon}
                <Typography component="span" variant="caption">
                  {label}
                </Typography>
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
