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
