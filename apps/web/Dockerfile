FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /workspace

RUN apt-get update \
  && apt-get install --yes --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/geometry/package.json packages/geometry/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM base AS dependencies
RUN pnpm install --frozen-lockfile

FROM dependencies AS development
COPY . .
EXPOSE 5173
CMD ["pnpm", "--filter", "@casastudio/web", "dev"]

FROM dependencies AS build
ARG VITE_API_BASE_URL
ARG VITE_KEYCLOAK_BASE_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_KEYCLOAK_ROLE_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_KEYCLOAK_BASE_URL=$VITE_KEYCLOAK_BASE_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_KEYCLOAK_ROLE_CLIENT_ID=$VITE_KEYCLOAK_ROLE_CLIENT_ID
COPY . .
RUN pnpm --filter @casastudio/web... build

FROM nginx:1.29-alpine AS runtime
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1
