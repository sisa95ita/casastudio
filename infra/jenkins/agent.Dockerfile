FROM docker:28-cli AS docker-cli
FROM node:24-bookworm-slim AS node

FROM jenkins/inbound-agent:latest-jdk21

USER root

ENV PNPM_HOME=/home/jenkins/.local/share/pnpm
ENV PATH=/usr/local/bin:${PNPM_HOME}:${PATH}

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY docker-entrypoint.sh /usr/local/bin/casastudio-jenkins-agent-entrypoint

RUN apt-get update \
  && apt-get install --yes --no-install-recommends bash ca-certificates curl git openssl passwd procps util-linux \
  && ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && ln -sf ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
  && install -d -o jenkins -g jenkins "${PNPM_HOME}" /home/jenkins/.cache /home/jenkins/.pnpm-store \
  && chmod 0755 /usr/local/bin/casastudio-jenkins-agent-entrypoint \
  && corepack enable \
  && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["casastudio-jenkins-agent-entrypoint"]
