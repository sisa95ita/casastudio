# Backend Foundation Phase 1A

## Purpose

This runbook covers the local infrastructure foundation for the CasaStudio API:
NestJS, PostgreSQL, Prisma migrations, Keycloak, Swagger, Docker, and Compose.
It does not describe project persistence tables or business APIs.

## Prerequisites

- Node.js 24 LTS
- Corepack with pnpm 11.x
- Docker Desktop or Docker Engine with Docker Compose

## Environment

Copy `.env.example` to `.env` before running Compose. Copy
`apps/api/.env.example` to `apps/api/.env` when running Prisma or the API
directly from the package directory.

The `.env.example` files contain documented local-only placeholders. The actual
local values belong in ignored `.env` files. Compose uses `${VAR:?message}`
interpolation for required passwords and fails during configuration rendering
when they are missing. Docker secrets are intentionally not introduced in Phase
1A.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime mode: `development`, `test`, or `production`. |
| `API_PORT` | HTTP port used by the Nest API. |
| `CASASTUDIO_POSTGRES_DB` | Development PostgreSQL database name. |
| `CASASTUDIO_POSTGRES_USER` | Development PostgreSQL user. |
| `CASASTUDIO_POSTGRES_PASSWORD` | Development PostgreSQL password. Required by Compose. |
| `CASASTUDIO_TEST_POSTGRES_DB` | Disposable test PostgreSQL database name. |
| `CASASTUDIO_TEST_POSTGRES_PASSWORD` | Disposable test PostgreSQL password. Required by test Compose. |
| `CASASTUDIO_KEYCLOAK_ADMIN_PASSWORD` | Development Keycloak admin password. Required by Compose. |
| `CASASTUDIO_KEYCLOAK_API_CLIENT_SECRET` | Development API client secret imported into Keycloak. Required by Compose. |
| `CASASTUDIO_KEYCLOAK_DEMO_PASSWORD` | Development demo-user password imported into Keycloak. Required by Compose. |
| `DATABASE_URL` | PostgreSQL connection URL used by Prisma and the API. |
| `KEYCLOAK_BASE_URL` | Base Keycloak URL for diagnostics and operator context. |
| `KEYCLOAK_REALM` | Realm name, currently `casastudio`. |
| `KEYCLOAK_ISSUER` | Expected token issuer. For local browser tokens this is `http://localhost:8080/realms/casastudio`. |
| `KEYCLOAK_JWKS_URI` | JWKS URL used by the API. In containers this uses `http://keycloak:8080/...`. |
| `KEYCLOAK_AUDIENCE` | Required JWT audience, currently `casastudio-api`. |
| `KEYCLOAK_CLIENT_ID` | Keycloak client whose client roles authorize API routes. |
| `SWAGGER_ENABLED` | Enables Swagger. Defaults to enabled outside production and disabled in production. |
| `LOG_LEVEL` | Pino log level. |

## Local Stack

Start the development stack:

```bash
pnpm docker:dev:up
```

Stop it:

```bash
pnpm docker:dev:down
```

Service URLs:

| Service | URL |
|---|---|
| Web dev server | `http://localhost:5173` |
| API | `http://localhost:3000` |
| Swagger | `http://localhost:3000/api/docs` |
| Keycloak admin | `http://localhost:8080` |
| Keycloak health | `http://localhost:9000/health/ready` |
| PostgreSQL | `localhost:5432` |

Development credentials are read from ignored `.env` variables:

| Use | Username | Password |
|---|---|---|
| Keycloak admin | `admin` | `CASASTUDIO_KEYCLOAK_ADMIN_PASSWORD` |
| Demo user | `demo` | `CASASTUDIO_KEYCLOAK_DEMO_PASSWORD` |
| PostgreSQL | `CASASTUDIO_POSTGRES_USER` | `CASASTUDIO_POSTGRES_PASSWORD` |

These credentials are deterministic for local development and must not be reused
outside local or disposable test environments.

The imported demo user also has stable Keycloak user ID
`8d62f7e2-0c2a-4f2a-a9cf-7f62c2f4e8f7`. Keycloak emits this value as the token
`sub`, and backend seed data uses it as the development owner and creator
subject. Usernames and email addresses are display/login attributes only.

## Prisma Migrations

Runtime Prisma integration lives under `apps/api/src/persistence`. Prisma CLI
schema and SQL migration history live under `apps/api/prisma`.

Development migration workflow:

```bash
pnpm db:migrate:dev
```

Production-like and test workflow:

```bash
pnpm db:migrate:deploy
pnpm db:migrate:status
```

Validation and client generation:

```bash
pnpm db:validate
pnpm db:generate
```

`prisma migrate deploy` applies pending SQL migrations from the committed
history. It does not perform development drift detection; use `migrate dev`
against development databases when changing the schema. Do not use `prisma db
push` as the normal CasaStudio migration strategy.

The Compose migration service runs before the API starts. API readiness also
checks the Prisma migration history table so the API does not report ready before
the migration owner has run.

## Health Checks

```bash
docker compose config
docker compose -f compose.yml -f compose.dev.yml config
docker compose -f compose.yml -f compose.test.yml config
docker compose -f compose.yml -f compose.dev.yml up --build
docker compose -f compose.yml -f compose.dev.yml ps
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
curl -I http://localhost:3000/api/docs
```

Liveness is process-only. Readiness checks PostgreSQL connectivity, applied
Prisma migration metadata, and Keycloak JWKS reachability.

In constrained automation environments where published container ports are not
reachable from the host, run the same API checks from inside the API container:

```bash
docker compose -f compose.yml -f compose.dev.yml exec api \
  node -e "fetch('http://127.0.0.1:3000/api/v1/health/ready').then(async r => { console.log(r.status); console.log(await r.text()); })"
```

Verify failure behavior by stopping one dependency at a time:

```bash
docker compose -f compose.yml -f compose.dev.yml stop postgres
curl http://localhost:3000/api/v1/health/live
curl -i http://localhost:3000/api/v1/health/ready
docker compose -f compose.yml -f compose.dev.yml up -d postgres

docker compose -f compose.yml -f compose.dev.yml stop keycloak
curl http://localhost:3000/api/v1/health/live
curl -i http://localhost:3000/api/v1/health/ready
docker compose -f compose.yml -f compose.dev.yml up -d keycloak
```

`/health/live` should remain `200 OK`; `/health/ready` should return a
non-success response with the unavailable dependency marked `error`.

## Keycloak Token

The development realm is imported from
`docker/keycloak/casastudio-realm.json`.

Get a demo access token:

```bash
set -a
. ./.env
set +a

TOKEN="$(
  curl -s \
    -d grant_type=password \
    -d client_id=casastudio-web \
    -d username=demo \
    --data-urlencode "password=$CASASTUDIO_KEYCLOAK_DEMO_PASSWORD" \
    http://localhost:8080/realms/casastudio/protocol/openid-connect/token \
    | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => console.log(JSON.parse(body).access_token));"
)"
```

Verify protected diagnostics:

```bash
curl -i http://localhost:3000/api/v1/auth/me
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/auth/me
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/auth/admin
```

The demo user has the `casastudio-user` client role for `casastudio-api`, so
`/auth/me` succeeds with a valid token and `/auth/admin` returns Forbidden.

## Production-Like Local Build

Build API and web images:

```bash
docker compose build web api
```

Run the production-like stack:

```bash
docker compose up --build
```

In production mode, Swagger is disabled unless `SWAGGER_ENABLED=true` is set
explicitly.

## Common Startup Failures

- Invalid or missing env vars: the API exits during Nest configuration startup.
- PostgreSQL unavailable: migration service fails or readiness returns `error`.
- Migrations not applied: API starts but readiness returns `error` for PostgreSQL.
- Keycloak not ready or realm not imported: readiness returns `error` for Keycloak and JWT validation fails.
- Existing Keycloak state: startup import skips a realm that already exists; recreate the container state when changing the development realm.
- Missing Compose passwords: `docker compose config` fails with the required variable message before containers start.
