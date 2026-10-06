# AI-B4 implementation report

1. **Persistence architecture found:** Prisma/PostgreSQL, normalized Project aggregate repositories, explicit Nest injection tokens and owner/admin authorization. No suitable generated-image byte store existed.
2. **Durable Proposal model:** separate application `DesignProposal` table, Project FK/cascade, stable Level/Room domain IDs and indexed newest-first Room lookup. ProjectSchema and legacy canonical rendering fields remain unchanged.
3. **Artifact abstraction:** provider-independent `DesignArtifactStore` with put/read/delete and opaque identity plus integrity metadata.
4. **Filesystem adapter/configuration:** `AI_ARTIFACT_STORAGE`, `AI_ARTIFACT_DIRECTORY`, `AI_ARTIFACT_MAX_BYTES`; exclusive temporary write, sync and atomic rename; Docker named volume and non-root directory ownership.
5. **Auto-persist generation:** provider result is validated, stored and committed as metadata before returning a durable DTO. No Save action.
6. **Consistency/compensation:** metadata failure deletes the written artifact best-effort; storage failure creates no metadata; distinct persistence Problem Details warns that the paid generation may already have completed. No provider retries.
7. **Metadata/provenance:** target IDs, generation revision/time/direction, models/mode/duration/output settings/whitelisted usage; artifact dimensions/bytes/SHA-256; context/reference fingerprint. No reference blobs, raw provider responses or secrets retained.
8. **Artifact delivery:** authenticated Project-scoped image endpoint, correct MIME/length, inline disposition, private/no-store and nosniff. Bearer-authenticated Blob fetch; one selected object URL with abort/revoke lifecycle.
9. **History APIs:** Project/Level/Room-scoped list, 20 records/page, deterministic timestamp/ID cursor; explicit authorized single-proposal deletion. No base64 in list responses.
10. **History UX:** compact Saved Room designs area with date/direction, selection, contained full-size preview, generation details, paging/refresh and accessible delete confirmation. Explicit image retry fetches only bytes.
11. **Transient/durable reconciliation:** stable proposal ID; at most three session comparisons; current session identities are excluded from separate history buttons. Reload clears comparisons and restores durable history.
12. **Revision/stale behavior:** no proposal operation increments revision; a stored/current revision mismatch shows a historical warning. Stable Room IDs survive normal aggregate replacement. Unsaved edits remain a documented revision-provenance limit.
13. **Deletion/retention:** indefinite retention until explicit proposal/Project deletion. Success removes history/session identity, closes its preview, releases its URL and can select another session entry. Metadata removal revokes API access before best-effort external-byte cleanup.
14. **Project deletion:** existing authorization and locked transaction gather keys, cascade metadata, then clean files after commit. A provider completion after Project deletion fails metadata creation and compensates its file. Removed Rooms keep Project-owned historical records.
15. **Authorization:** JwtAuthGuard plus existing owner/admin Project loader before every generate/list/fetch/delete. Proposal lookup always includes Project identity; errors do not disclose another Project's proposal existence.
16. **Validation/security:** strict bounded canonical base64, supported PNG/JPEG/WebP, nonzero bytes, container/header dimensions and metadata consistency; PNG CRC/bounded decompression; strict UUID keys, no traversal or symlink reads, SHA-256 verification. Multi-megabyte PNG, JPEG and WebP fixtures are covered.
17. **Files/migration:** see the complete changed-file manifest below. Migration `20261005120000_durable_design_proposals` is additive and separate from geometric persistence.
18. **Automated tests:** fake generation/storage/metadata and failure tests; temp-filesystem traversal, corruption, concurrency and size tests; authenticated fake-principal HTTP tests; real PostgreSQL history/aggregate replacement/Project cleanup/concurrent completion/fixture utility tests; frontend reload/lazy-loading/reconciliation/deletion/stale/scope/URL-cleanup tests; client scope/MIME/authentication tests. Existing budget and Project tests remain intact.
19. **Validation results:** recorded below after final checks. All test artifacts use temporary roots. Migration deploy/status/schema-diff were checked against a new disposable PostgreSQL database and it was dropped afterward; the developer's Project database was not migrated or edited for verification.
20. **Permanent execution rule:** zero live AI/provider calls, zero paid image generation, zero API credits consumed. Generate design was never pressed in a live browser. No subjective/manual visual acceptance was performed, and no image/design quality improvement is claimed.
21. **Exact owner acceptance:** follow [the zero-cost owner-only steps](durable-design-proposals.md#owner-only-manual-acceptance-zero-cost): apply migration in your development database, configure the durable API root, obtain canonical Project/Level/Room IDs, run `pnpm db:seed:design-history <project-id> <level-id> <room-id>`, then check Room scope, metadata/stale warning, preview/keyboard/responsiveness, reload and confirmed/cancelled deletion. Re-read Project revision/geometry to verify unchanged state. Only owners can choose the separately documented optional single paid call.
22. **MVP limits:** filesystem/root/volume durability; bounded buffered image delivery; best-effort cleanup and documented crash orphans; no background collector, ambiguous-request recovery job, cloud/CDN/thumbnails or Project-level gallery; revision does not describe unsaved geometry; structural JPEG/WebP validation is not full pixel/content acceptance.
23. **AI-C and later:** chat, follow-up edits, continuation and conversation history remain for AI-C. Structured Furniture extraction, canonical accept/reject, Apply to Project and architectural mutation remain later work. None were added.

No Git staging, commit, push, rebase or amend was performed. All work is unstaged.

## Validation results

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed, 6 tasks |
| `pnpm test` | Passed, 11 Turbo tasks; 1,457 workspace tests passed. The normal run skipped 27 DB-dependent cases, exercised separately below. Root version/tool tests also passed. |
| PostgreSQL API suite | 195 tests passed, 18 files, no skips in that run, including all 27 database-dependent cases and the zero-cost fixture command. Three subsequently added image-format/large-payload unit cases also passed in the final monorepo run. |
| `pnpm build` | Passed, 7 tasks. Vite reports the existing large-chunk warning; no build error. |
| `pnpm db:generate` | Passed, also executed by build |
| `pnpm db:validate` | Passed |
| Disposable DB `db:migrate:deploy` | All 8 migrations applied successfully, including AI-B4 |
| Disposable DB `db:migrate:status` | Up to date |
| Prisma schema diff with `--exit-code` | Exit 0; no difference detected |
| Compose base/development `config --quiet` | Both passed; Docker images were not built or deployed |
| `git diff --check` | Passed |
| Git index | Empty diff; all changes unstaged |

The temporary validation database was created separately from the development Project database and dropped in a `finally` cleanup. Local filesystem tests and the fixture-command test used temporary roots and deterministic image bytes. No live provider request or owner visual acceptance occurred.

## Changed-file manifest

```text
.dockerignore
.env.example
.gitignore
apps/api/.env.example
apps/api/Dockerfile
apps/api/package.json
apps/api/prisma/migrations/20261005120000_durable_design_proposals/migration.sql
apps/api/prisma/schema.prisma
apps/api/prisma/seed-design-history.ts
apps/api/src/ai/ai.module.ts
apps/api/src/ai/api/design-proposal.dto.ts
apps/api/src/ai/api/design-proposals.controller.test.ts
apps/api/src/ai/api/design-proposals.controller.ts
apps/api/src/ai/application/design-proposal-history.service.ts
apps/api/src/ai/application/durable-design-proposal.test.ts
apps/api/src/ai/application/generate-design-proposal.service.test.ts
apps/api/src/ai/application/generate-design-proposal.service.ts
apps/api/src/ai/application/persist-design-proposal.service.ts
apps/api/src/ai/artifacts/design-artifact.store.ts
apps/api/src/ai/artifacts/design-artifacts.module.ts
apps/api/src/ai/artifacts/filesystem-design-artifact.store.test.ts
apps/api/src/ai/artifacts/filesystem-design-artifact.store.ts
apps/api/src/ai/artifacts/validate-design-artifact.ts
apps/api/src/ai/persistence/design-proposal.integration.test.ts
apps/api/src/ai/persistence/design-proposal.repository.ts
apps/api/src/ai/persistence/prisma-design-proposal.repository.ts
apps/api/src/ai/test/design-fixture.ts
apps/api/src/api-infrastructure.test.ts
apps/api/src/common/problem-details/api-error-code.ts
apps/api/src/config/app-configuration.ts
apps/api/src/projects/persistence/prisma-project.repository.ts
apps/api/src/projects/persistence/project-persistence.test.ts
apps/api/src/projects/projects.module.ts
apps/api/tsconfig.build.json
apps/web/src/core/api/CasaStudioApiClient.test.ts
apps/web/src/core/api/CasaStudioApiClient.ts
apps/web/src/core/api/api-types.ts
apps/web/src/core/i18n/locales/en/project-viewer.json
apps/web/src/features/project-3d/AiRoomDesignPanel.test.tsx
apps/web/src/features/project-3d/AiRoomDesignPanel.tsx
apps/web/src/features/project-3d/Project3DViewer.tsx
apps/web/src/features/project-3d/camera/room-reference-camera-3d.test.ts
apps/web/src/features/project-3d/camera/room-reference-camera-3d.ts
apps/web/src/features/project-3d/model/architectural-scene-3d-model.ts
apps/web/src/features/project-3d/presentation/room-reference-relevance-3d.test.ts
apps/web/src/features/project-3d/useRoomDesignHistory.ts
compose.yml
docs/05-ai-integration.md
docs/ai/ai-b4-implementation-report.md
docs/ai/durable-design-proposals.md
package.json
packages/ai/src/contracts.ts
```
