# CasaStudio Jenkins Infrastructure

This directory contains the local Jenkins infrastructure for Backend Foundation
Phase 1E. Jenkins is development infrastructure for validating repository
changes; it is not part of the CasaStudio web/API/PostgreSQL/Keycloak runtime.

## Files

| File | Responsibility |
| --- | --- |
| `Dockerfile` | Builds the Jenkins LTS controller image and installs the declared plugins. |
| `agent.Dockerfile` | Builds the single inbound build agent with Node.js 24, Corepack, Git, Docker CLI, and Docker Compose support. |
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

JCasC creates a permanent inbound node named `casastudio-agent` with one
executor. The controller has zero executors, so it does not run CasaStudio
builds.

The inbound agent secret is Jenkins state and must not be committed. On first
startup, open the `casastudio-agent` node page in Jenkins, copy the generated
agent secret, set it as `CASC_JENKINS_AGENT_SECRET` in the ignored `.env`, and
restart the agent:

```bash
docker compose -f compose.jenkins.yml up -d --build agent
```

The placeholder value in `.env.example` is intentionally not a working secret.

## Docker Socket Trust Model

Only the dedicated Jenkins agent mounts `/var/run/docker.sock`. The controller
does not mount it.

The agent can control the local Docker daemon. That means any pipeline running
on the agent can build images, start containers, read container metadata, and
affect local Docker resources. This is acceptable only for trusted CasaStudio
repository revisions on a single-developer local Jenkins instance. It is not a
sandbox and is not suitable for untrusted multi-tenant builds.

A future hosted Jenkins setup should use isolated ephemeral agents or a remote
container builder instead of sharing the local Docker socket.

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
branch and pull-request discovery
        ↓
Jenkinsfile from the checked-out revision
        ↓
Jenkins status check on the pull request
```

