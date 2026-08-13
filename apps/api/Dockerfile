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
RUN pnpm --filter @casastudio/api db:generate
RUN pnpm --filter @casastudio/api^... build
EXPOSE 3000
CMD ["pnpm", "--filter", "@casastudio/api", "dev"]

FROM dependencies AS build
COPY . .
RUN pnpm --filter @casastudio/api db:generate
RUN pnpm --filter @casastudio/api... build

FROM build AS runtime
ENV NODE_ENV="production"
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || '3000') + '/api/v1/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
