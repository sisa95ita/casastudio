# Browser E2E testing

CasaStudio uses Playwright Test with real Chromium for browser-level checks. This suite is separate from the Vitest unit/component suite: Vitest uses JSDOM, while Playwright starts an actual browser and dispatches native browser input events.

## Prerequisites and topology

Install the repository dependencies and Docker. Copy `.env.example` to `.env` and replace the development placeholders. The E2E flow uses the normal development ports:

| Service    | Port | Startup owner                                  |
| ---------- | ---: | ---------------------------------------------- |
| Web (Vite) | 5173 | Playwright `webServer`, unless already running |
| API (Nest) | 3000 | Playwright `webServer`, unless already running |
| Keycloak   | 8080 | Docker Compose prerequisite                    |
| PostgreSQL | 5432 | Docker Compose prerequisite                    |

Install only the required Playwright browser binary on a fresh machine:

```bash
pnpm install
pnpm exec playwright install chromium
```

The repository pins Playwright 1.58 because its Chromium build supports the project's current macOS 13 development hardware. Newer Playwright releases require macOS 14 or later; revisit the pin when that baseline changes.

Start and prepare the normal development infrastructure before running E2E tests:

```bash
pnpm e2e:infra:up
pnpm e2e:prepare
```

`e2e:prepare` applies committed Prisma migrations and deterministically seeds the `Demo Project`. Playwright then starts the API and web development servers. If those servers are already healthy, Playwright reuses them. The E2E configuration does not use the separate Compose test topology or its alternate ports.

## Authentication

The smoke test opens `/app` and completes the real Keycloak login page using the imported development user `demo`. The password is read from `CASASTUDIO_KEYCLOAK_DEMO_PASSWORD` in the process environment or repository-root `.env`; it is not stored in test source or browser state. This exercises the public `casastudio-web` client and its Authorization Code + SHA-256 PKCE flow. Production authentication is not bypassed or weakened.

## Commands

Run commands from the repository root:

```bash
# Entire E2E suite
pnpm test:e2e

# One test file
pnpm test:e2e -- e2e/project-editor.smoke.spec.ts

# Headed Chromium
pnpm test:e2e:headed

# Playwright Inspector and step debugging
pnpm test:e2e:debug

# Open the last HTML report
pnpm test:e2e:report
```

Stop the prerequisite containers when finished with `pnpm e2e:infra:down`.

## Smoke coverage and failure artifacts

The smoke test authenticates, reaches the Projects workspace, opens the seeded `Demo Project`, verifies the real SVG editor, and sends a native mouse wheel event over its viewport. It verifies that the rendered viewport changes and records browser `console.error` messages. Unexpected console errors and uncaught page errors fail the test.

The known passive wheel-listener diagnostic is recorded separately so the existing browser bug remains reproducible without preventing the browser foundation from running. This E2E foundation does not fix that product bug.

On failure, Playwright writes screenshots and retained traces under `test-results/` and an HTML report under `playwright-report/`. Open a trace directly with:

```bash
pnpm exec playwright show-trace test-results/<test-output-directory>/trace.zip
```
