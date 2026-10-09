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

## AI-B5 zero-cost milestone workflow

Run `pnpm test:e2e:ai-b5` for the complete Interior Designer lifecycle. Its separate
configuration starts an isolated API at port 3105 and web at the existing allowed
Keycloak origin `http://localhost:8081`, with server reuse and retries disabled.
It uses real Keycloak authentication, API services, PostgreSQL and filesystem
artifacts, replacing only the provider with a deterministic local fake. Provider
credentials are removed; the default E2E configuration excludes this test.

Create the dedicated `casastudio_ai_b5` database once, apply normal migrations via
`node tools/ai-b5-validation.mjs db:migrate:deploy`, and run the database-backed
API suite with `node tools/ai-b5-validation.mjs --filter @casastudio/api test`
before the browser journey. The harness always uses a temporary artifact root;
it never uses the configured production/development artifact directory. Keep the
database suite and milestone browser run sequential.

The generic browser Project is disposable and cleaned after the test. It covers
Active Level Room targeting, reference inspection, explicit generation/pending
states, stable persisted/session identity, comparison, Review, reload/history,
historical revisions, Room/Level switching and deletion. It does not bypass
application persistence through browser route interception and does not perform
visual image-quality acceptance. See the [AI-B5 closure report](ai/ai-b5-validation-report.md)
for setup, invariants, results, known limits and the owner manual checklist.

## Smoke coverage and failure artifacts

The Project editor smoke tests authenticate through Keycloak and cover Project creation/deletion, viewport input, responsive layouts, Room shapes, elevated Rooms, Stairs, Openings, and architectural presentation. Unexpected console errors and uncaught page errors fail the instrumented workflows, including the native wheel check.

The complete-house workflow authors a generic multi-Level plan through the editor, subdivides Rooms with Walls and detection, edits topology and Openings, adds an elevated study and same-Level/cross-Level Stairs, furnishes Rooms, and exercises atomic alignment/distribution/history. It compares authoritative Project data across saves and reloads, visits the current 3D representation, returns to the selected Level in 2D, discards edits, and tests real revision conflicts. Expected conflict responses are checked separately from unexpected browser/network errors.

The Furniture workflow covers preview-first placement, collision rejection, explicit overlapping-Room ownership, exact instance properties, dragging, rotation, duplication, Layers, persistence, and discard. The 3D smoke checks current Wall/Floor/Opening geometry, selection, camera controls, and Level visibility. The vertical-architecture workflow saves generic Straight/L/U canonical Stairs and elevated Rooms, checks closed floor dimensions and Stair bounds, clicks steps/slabs/Landings/floor edges, switches Levels, and returns to 2D with unchanged persisted state. Furniture geometry remains outside current 3D support.

Successful broad scenarios also write a small set of screenshots under `test-results/` for visual review. These are disposable test artifacts, not product assets. Run browser workflows after production edits have settled: Vite reloads during a test can interrupt an unsaved draft.

On failure, Playwright writes screenshots and retained traces under `test-results/` and an HTML report under `playwright-report/`. Open a trace directly with:

```bash
pnpm exec playwright show-trace test-results/<test-output-directory>/trace.zip
```
