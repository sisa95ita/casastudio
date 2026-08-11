# 08 — Development Environment

## Purpose

This document defines the recommended development environment for CasaStudio.

## Target platforms

CasaStudio should be developed on modern systems capable of running the current Node.js LTS release and standard container tooling.

Recommended platforms: macOS latest supported version, Windows 11 with WSL2, Ubuntu LTS.

## Required tools

| Tool | Version policy | Notes |
|---|---:|---|
| Git | Latest stable | Source control |
| Node.js | 24 LTS | JavaScript/TypeScript runtime |
| Corepack | Bundled with Node.js | Package manager version management |
| pnpm | 11.x | Workspace package manager |
| VS Code | Latest stable | Recommended IDE |
| Docker Desktop or Docker Engine | Latest stable | Local container runtime |
| PostgreSQL | Latest stable | Local DB, if not containerized |

## Node.js

Use Node.js 24 LTS. Do not use the latest Current Node.js release unless explicitly required.

## pnpm

Use Corepack to manage pnpm.

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

The repository should eventually pin the package manager version in `package.json`.

```json
{
  "packageManager": "pnpm@11.10.0"
}
```

## VS Code extensions

Recommended: ESLint, Prettier, EditorConfig for VS Code, Markdown All in One, Error Lens, GitHub Pull Requests, OpenAI Codex extension.

Optional later: Docker, Prisma, Tailwind CSS IntelliSense, GitLens.

## VS Code settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.eol": "
",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true
}
```

## Containers

CasaStudio should support containerized local development through Docker / Docker Compose. The documentation assumes a standard modern container environment. Platform-specific workarounds should be documented separately as troubleshooting notes, not as the main project standard.

## Daily application workflow

Copy `.env.example` to `.env` and replace the local placeholder passwords and
API client secret. The preferred development topology runs PostgreSQL and
Keycloak in Docker while the API and web application run through pnpm:

```bash
docker compose up -d postgres keycloak
pnpm db:migrate:deploy
pnpm db:seed
pnpm api:dev
pnpm web:dev
```

Run the API and web commands in separate terminals. The resulting local
endpoints are:

| Service | URL |
|---|---|
| Web | `http://localhost:5173` |
| API | `http://localhost:3000` |
| Keycloak | `http://localhost:8080` |

The development realm import creates the public `casastudio-web` browser client
and the `demo` user. Its password comes from
`CASASTUDIO_KEYCLOAK_DEMO_PASSWORD`; it must not be copied into frontend source
or browser configuration.

## Frontend authentication configuration

Vite loads frontend environment values from the repository-level `.env` file.
Only public Keycloak coordinates are exposed to the browser:

| Variable | Local value | Purpose |
|---|---|---|
| `VITE_KEYCLOAK_BASE_URL` | `http://localhost:8080` | Browser-reachable Keycloak base URL |
| `VITE_KEYCLOAK_REALM` | `casastudio` | Development realm |
| `VITE_KEYCLOAK_CLIENT_ID` | `casastudio-web` | Public Authorization Code client |
| `VITE_KEYCLOAK_ROLE_CLIENT_ID` | `casastudio-api` | Token resource whose roles are shown in UI state |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Browser-reachable CasaStudio API base URL |

The web client uses `keycloak-js` with standard Authorization Code Flow and
SHA-256 PKCE. Startup uses `check-sso` without a session-check iframe, allowing
Keycloak to restore an existing SSO session before the application decides that
the user is anonymous. `/` remains public; visiting `/app` while genuinely
anonymous starts Keycloak login directly. Keycloak returns a successful login
to the original application URL, and logout returns to `/`.

`AuthProvider` owns initialization and exposes `useAuth()` plus the protected
route boundary. Keycloak access and refresh tokens remain inside the adapter in
memory. Future API code may call `getAccessToken()`, which asks Keycloak to
refresh an expiring token before returning the bearer token. The frontend maps
identity claims and `resource_access["casastudio-api"].roles` for presentation
only; the API remains authoritative for authorization.

## Local-network device testing

The committed configuration keeps the localhost URLs above as its defaults.
Vite and the Nest API both listen on all local interfaces during development,
so a phone or tablet on the same trusted network can reach the Mac once the
browser-facing URLs and allowed origins use the Mac's LAN address.

Create a repository-root `.env.local` for machine-specific values. The file is
ignored by Git and is loaded ahead of `.env` by both Vite and the API. Replace
`<LAN-IP>` locally; do not copy a real address into committed configuration.

```dotenv
VITE_API_BASE_URL=http://<LAN-IP>:3000
VITE_KEYCLOAK_BASE_URL=http://<LAN-IP>:8080

KEYCLOAK_BASE_URL=http://<LAN-IP>:8080
KEYCLOAK_ISSUER=http://<LAN-IP>:8080/realms/casastudio
KEYCLOAK_JWKS_URI=http://<LAN-IP>:8080/realms/casastudio/protocol/openid-connect/certs
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081,http://<LAN-IP>:5173

CASASTUDIO_KEYCLOAK_HOSTNAME=http://<LAN-IP>:8080
CASASTUDIO_WEB_LAN_ORIGIN=http://<LAN-IP>:5173
```

The standard pnpm commands remain unchanged:

```bash
pnpm api:dev
pnpm web:dev
```

Docker Compose reads `.env` by default, but intentionally does not consume the
machine-specific override implicitly. When recreating Keycloak for LAN testing,
pass both files explicitly so the imported development realm receives the LAN
redirect URI and web origin:

```bash
docker compose --env-file .env --env-file .env.local up -d --force-recreate keycloak
```

Return to localhost mode by starting Keycloak normally and running the pnpm
commands without `.env.local`. A realm is imported only when it does not already
exist in that Keycloak container, so recreating the development-only container
is required when switching its public hostname or imported client origins.

LAN access is intended only for a trusted development network. The client keeps
explicit origins, the API does not use wildcard CORS, and production hostname or
redirect policy is not changed by this local workflow.

## Frontend Project and Geometry data flow

Authenticated browser requests use a small frontend API client that obtains a
current in-memory access token through `AuthProvider.getAccessToken()`, attaches
it as a bearer token, and parses CasaStudio Problem Details failures without
exposing credentials. The API accepts the explicitly configured local web
origins from `CORS_ALLOWED_ORIGINS`; the default development list covers the
pnpm Vite server on port 5173 and the Compose web runtime on port 8081.

TanStack Query owns authoritative Project and Geometry server state, including
request cancellation, loading and error state, cache lifecycle, and route-ID
query identity. Redux Toolkit owns shared local application state only. The
first Redux-backed state is the Geometry Playground entity selection and hover
references; Project responses, Geometry responses, authentication, and backend
errors are not copied into Redux.

After signing in with the seeded demo user, `/app` presents a temporary entry
for the seeded `Demo Project`. Its authoritative viewer route is:

```text
http://localhost:5173/app/projects/demo-project
```

The Geometry Playground remains available at `/app/geometry-playground` as a
development and diagnostic harness. It is intentionally absent from the
primary navigation and Home product actions.
