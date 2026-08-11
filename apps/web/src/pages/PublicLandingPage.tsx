import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import { Box, Button, Container, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import aiDesignVisual from "../assets/product/ai-design-assistant.webp";
import backgroundTexture from "../assets/product/architectural-texture.webp";
import heroVisual from "../assets/product/landing-hero.webp";
import workflowVisual from "../assets/product/product-workflow.webp";
import { ProductBrand } from "../components/ProductBrand";
import { useCasaTranslation } from "../i18n";

/** Ordered editorial steps connecting current geometry work to evolving capabilities. */
const workflowSteps = [
  { key: "geometry", icon: <CropFreeRoundedIcon /> },
  { key: "understanding", icon: <LayersRoundedIcon /> },
  { key: "visualization", icon: <ViewInArRoundedIcon /> },
  { key: "assistant", icon: <AutoAwesomeRoundedIcon /> }
] as const;

/** Renders the public CasaStudio product landing page without requiring authentication. */
export function PublicLandingPage() {
  const { t } = useCasaTranslation("landing");

  return (
    <Box className="landing-page">
      <Box component="header" className="landing-header">
        <Container className="landing-header__inner" maxWidth="xl">
          <Link component={RouterLink} to="/" aria-label={t("header.homeLabel")} underline="none">
            <ProductBrand />
          </Link>
          <Stack component="nav" aria-label={t("header.navigationLabel")} direction="row" spacing={3}>
            <Link href="#workflow" color="text.primary" underline="hover">
              {t("header.workflow")}
            </Link>
            <Link href="#ai-design" color="text.primary" underline="hover">
              {t("header.aiDesign")}
            </Link>
          </Stack>
          <Button
            component={RouterLink}
            to="/app"
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
          >
            {t("actions.openWorkspace")}
          </Button>
        </Container>
      </Box>

      <Box component="main">
        <Box component="section" className="landing-hero">
          <Container maxWidth="xl">
            <Stack className="landing-hero__copy" spacing={3}>
              <Typography variant="overline" color="primary.dark">
                {t("hero.eyebrow")}
              </Typography>
              <Typography component="h1" variant="h1">
                {t("hero.heading")}
              </Typography>
              <Typography className="landing-lead" color="text.secondary">
                {t("hero.description")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  component={RouterLink}
                  to="/app"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                >
                  {t("actions.openWorkspace")}
                </Button>
                <Button component="a" href="#workflow" variant="outlined">
                  {t("actions.exploreWorkflow")}
                </Button>
              </Stack>
            </Stack>

            <Box className="landing-hero__visual-frame">
              <img
                src={heroVisual}
                width="1672"
                height="941"
                alt={t("hero.imageAlt")}
                fetchPriority="high"
              />
            </Box>
          </Container>
        </Box>

        <Box component="section" id="workflow" className="landing-section landing-workflow">
          <Container maxWidth="xl">
            <Box className="landing-section__heading">
              <Typography variant="overline" color="primary.dark">
                {t("workflow.eyebrow")}
              </Typography>
              <Typography component="h2" variant="h2">
                {t("workflow.heading")}
              </Typography>
              <Typography color="text.secondary">{t("workflow.description")}</Typography>
            </Box>

            <Box
              component="figure"
              className="landing-workflow__visual landing-responsive-visual"
              data-responsive-visual="workflow"
            >
              <img
                src={workflowVisual}
                width="1448"
                height="1086"
                alt={t("workflow.imageAlt")}
                loading="lazy"
                sizes="(max-width: 599px) 340px, (max-width: 899px) 620px, (max-width: 1199px) 820px, 1120px"
              />
            </Box>

            <Box className="landing-workflow__steps">
              {workflowSteps.map((step, index) => (
                <Box className="workflow-step" key={step.key}>
                  <Box className="workflow-step__icon" aria-hidden="true">
                    {step.icon}
                  </Box>
                  <Typography variant="caption" color="primary.dark">
                    {String(index + 1).padStart(2, "0")}
                  </Typography>
                  <Typography component="h3" variant="h3">
                    {t(`workflow.steps.${step.key}.title`)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(`workflow.steps.${step.key}.description`)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        <Box component="section" id="ai-design" className="landing-section landing-ai">
          <Container maxWidth="xl" className="landing-ai__grid">
            <Box
              component="figure"
              className="landing-ai__visual landing-responsive-visual"
              data-responsive-visual="ai-design"
            >
              <img
                src={aiDesignVisual}
                width="1448"
                height="1086"
                alt={t("ai.imageAlt")}
                loading="lazy"
                sizes="(max-width: 599px) 340px, (max-width: 899px) 620px, 58vw"
              />
            </Box>
            <Stack className="landing-ai__copy" spacing={2.5}>
              <Box className="landing-ai__spark" aria-hidden="true">
                <AutoAwesomeRoundedIcon />
              </Box>
              <Typography variant="overline" color="primary.dark">
                {t("ai.eyebrow")}
              </Typography>
              <Typography component="h2" variant="h2">
                {t("ai.heading")}
              </Typography>
              <Typography color="text.secondary">{t("ai.description")}</Typography>
              <Typography className="landing-ai__note" variant="body2">
                {t("ai.roadmapNote")}
              </Typography>
            </Stack>
          </Container>
        </Box>

        <Box
          component="section"
          className="landing-final-cta"
          style={{ backgroundImage: `linear-gradient(90deg, rgba(47,74,64,.93), rgba(47,74,64,.76)), url(${backgroundTexture})` }}
        >
          <Container maxWidth="lg">
            <Typography variant="overline">{t("final.eyebrow")}</Typography>
            <Typography component="h2" variant="h2">
              {t("final.heading")}
            </Typography>
            <Typography>{t("final.description")}</Typography>
            <Button
              component={RouterLink}
              to="/app"
              variant="contained"
              color="primary"
              endIcon={<ArrowForwardRoundedIcon />}
            >
              {t("actions.openWorkspace")}
            </Button>
          </Container>
        </Box>
      </Box>

      <Box component="footer" className="landing-footer">
        <Container maxWidth="xl">
          <ProductBrand compact />
          <Typography variant="caption" color="text.secondary">
            {t("footer.tagline")}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
