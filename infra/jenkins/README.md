# CasaStudio Jenkins Infrastructure

This directory contains the local Jenkins infrastructure for Backend Foundation
Phase 1E. Jenkins is development infrastructure for validating repository
changes; it is not part of the CasaStudio web/API/PostgreSQL/Keycloak runtime.

## Files

| File | Responsibility |
| --- | --- |
| `Dockerfile` | Builds the Jenkins LTS controller image and installs the declared plugins. |
| `agent.Dockerfile` | Builds the single inbound build agent with Node.js 24, Corepack, Git, Docker CLI, Docker Buildx, and Docker Compose support. |
| `plugins.txt` | Direct Jenkins plugin set for Pipeline, GitHub multibranch discovery, credentials, JCasC, JUnit, timestamps, and workspace cleanup. |
| `casc/jenkins.yaml` | Non-secret Jenkins Configuration as Code defaults. |

## Local Startup

Create ignored local values before the first run:

```bash
cp .env.example .env
```

Set at least:

```text
CASC_JENKINS_ADMIN_ID
CASC_JENKINS_ADMIN_PASSWORD
CASC_JENKINS_ADMIN_EMAIL
```

Start Jenkins:

```bash
pnpm jenkins:up
```

Jenkins is served at `http://localhost:8082` by default. The normal shutdown is:

```bash
pnpm jenkins:down
```

The normal shutdown intentionally keeps the `jenkins_home` volume. To destroy
local Jenkins state, run the explicit Compose reset manually:

```bash
docker compose -f compose.jenkins.yml down --volumes
```

## Agent Bootstrap

JCasC creates a permanent inbound node named `casastudio-agent-node` with one
executor. The controller has zero executors, so it does not run CasaStudio
builds.

The inbound agent secret is Jenkins state and must not be committed. On first
startup, open the `casastudio-agent-node` node page in Jenkins, copy the generated
agent secret, set it as `CASC_JENKINS_AGENT_SECRET` in the ignored `.env`, and
restart the agent:

```bash
docker compose -f compose.jenkins.yml up -d --build agent
```

The placeholder value in `.env.example` is intentionally not a working secret.

## Docker Socket Trust Model

Only the dedicated Jenkins agent mounts `/var/run/docker.sock`. The controller
does not mount it.

The agent container starts as root only long enough to read the mounted socket's
numeric group ID, create a matching in-container group when needed, add
`jenkins` to it, and then exec the inbound agent as the non-root `jenkins` user.
No host-specific Docker socket GID is committed.

The agent can control the local Docker daemon. That means any pipeline running
on the agent can build images, start containers, read container metadata, and
affect local Docker resources. This is acceptable only for trusted CasaStudio
repository revisions on a single-developer local Jenkins instance. It is not a
sandbox and is not suitable for untrusted multi-tenant builds.

A future hosted Jenkins setup should use isolated ephemeral agents or a remote
container builder instead of sharing the local Docker socket.

## Local Resource Policy

This Jenkins setup is local development CI for a resource-constrained
Docker/Colima host. Jenkins sets `TURBO_CONCURRENCY=1` so repository-wide Turbo
tasks validate the same packages with serialized task execution. This does not
limit normal developer monorepo commands outside Jenkins and can be revisited on
larger CI infrastructure.

## pnpm Package Store

Dependency installation runs as the non-root `jenkins` user on the permanent
inbound agent. `PNPM_HOME` is `/home/jenkins/.local/share/pnpm`, and the agent's
`PNPM_CONFIG_STORE_DIR` environment variable explicitly sets pnpm's
`store-dir` to `/home/jenkins/.local/share/pnpm/store`. With the pinned pnpm 11
toolchain, `pnpm store path` therefore resolves to
`/home/jenkins/.local/share/pnpm/store/v11`.

The explicit `store-dir` is required because the inbound-agent image mounts
`/home/jenkins/agent` separately from `/home/jenkins`. Without the override,
pnpm's hard-link capability check crosses those mount boundaries and pnpm falls
back to `/home/jenkins/agent/.pnpm-store`. That fallback is outside the build
workspace but is not owned by the durable named agent-home volume. The explicit
configuration prevents that fallback and makes the persistence boundary
unambiguous.

The existing `jenkins_agent_home` named volume mounts `/home/jenkins`, so the
content-addressable package store survives normal pipeline cleanup, container
restart, and fresh agent-container creation. Jenkins still deletes each source
workspace and its `node_modules` after a build. Persisting only pnpm's shared
package content avoids stale workspace state while allowing unchanged packages
to be imported from the store instead of downloaded again.

The install stage logs the effective store path, its size before and after the
install, pnpm's normal reused/downloaded progress, and total install duration.
A first population is expected to download packages. A later build with the
same lockfile should report substantial reuse and substantially fewer
downloads; no absolute duration is guaranteed because filesystem and network
conditions vary.

Inspect the cache without listing its contents:

```bash
docker compose -f compose.jenkins.yml exec --user jenkins agent pnpm config get store-dir
docker compose -f compose.jenkins.yml exec --user jenkins agent pnpm store path
docker compose -f compose.jenkins.yml exec --user jenkins agent sh -lc 'du -sh "$(pnpm store path)"'
```

Clearing this cache is exceptional maintenance, not a routine build step. The
following command is destructive only to the validated pnpm store path; it does
not remove Jenkins home, source workspaces, databases, or unrelated volumes:

```bash
docker compose -f compose.jenkins.yml exec --user jenkins agent sh -lc '
  store_path="$(pnpm store path)"
  case "$store_path" in
    /home/jenkins/.local/share/pnpm/store/*) rm -rf -- "$store_path" ;;
    *) echo "Refusing to remove unexpected store path: $store_path" >&2; exit 1 ;;
  esac
'
```

## Multibranch Pipeline

Create a Jenkins Multibranch Pipeline that points at the GitHub repository and
uses `Jenkinsfile` from each checked-out revision. Configure GitHub credentials
and webhooks in Jenkins; do not store tokens or webhook secrets in this
repository.

The intended flow is:

```text
GitHub repository
        ↓
Multibranch Pipeline
        ↓
pull-request discovery
        ↓
Jenkinsfile from the checked-out revision
        ↓
Jenkins status check on the pull request
```

Configure pull-request discovery without ordinary branch discovery. In
particular, do not enable a duplicate `main` build: this local Mac installation
uses the Multibranch job only for validation of pull requests. A future DEV
deployment path will be a separate manual job.

Each validation run resolves one timestamped snapshot identity, uses it for
frontend metadata and both local Docker image tags, and deletes those exact
images afterward. The pipeline does not push images, deploy environments,
create releases, or advance the declared repository version.
