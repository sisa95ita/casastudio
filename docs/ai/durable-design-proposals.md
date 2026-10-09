# AI-B4 — Durable proposal artifacts and Room design history

AI-B is closed. [AI-C1](conversation-proposal-lineage.md) extends these records
with lazy conversations, child Proposal lineage and refinement. The B4 flow below
remains the initial-generation baseline; C1 adds server-only optional continuation
metadata and prevents direct deletion of Proposals with descendants. Public history
still excludes provider IDs, and ProjectSchema remains unchanged.

## Architecture and product policy

Every successfully completed design generation is saved automatically on the server before the successful response is finalized. There is no Save action. A failed generation creates no durable record. History, image retrieval, preview, refresh, pagination, fixture seeding, and deletion perform zero provider calls. Generate/Try another retain the AI-B3 single-flight guard, one intended paid request per explicit action, and disabled SDK retries. A persistence failure never calls the provider again.

CasaStudio already uses Prisma/PostgreSQL, normalized Project aggregate repositories, explicit Nest injection tokens, and the Project owner/admin authorization policy. There was no reusable generated-image blob store or authenticated binary client. B4 reuses those database, configuration, authorization, API, and MUI dialog conventions. It adds a separate Prisma `DesignProposal` application record and a provider-independent `DesignArtifactStore`; it does not use or expand the legacy canonical design-rendering records.

No proposal data enters ProjectSchema, Level, Room, Furniture, canonical aggregate includes/serialization, or Three.js state. Generating, listing, viewing, and deleting proposals do not update the Project revision, timestamps, or geometry. Only normal Project editing advances revision.

## Record and provenance

Migration: `apps/api/prisma/migrations/20261005120000_durable_design_proposals/migration.sql`.

Each record stores an application proposal ID; the owning Project database FK; stable Level/Room domain IDs; the Project revision used to derive context; completion timestamp; Design direction; opaque artifact key; MIME type; measured width/height, byte size and SHA-256; normalized provider, orchestration/image models, mode, duration, output format/quality, and a whitelist of normalized token usage fields when available.

A SHA-256 fingerprint covers canonical derived context plus the ordered reference kinds, targets, cameras, sizes and reference-image digests. It establishes context identity without retaining canonical JSON, reference blobs, raw provider payloads, continuation IDs, headers, keys or secrets. Separate generation events remain separate records even if their image hashes coincide.

The only FK is to the owning Project, with `ON DELETE CASCADE`. Level/Room domain IDs deliberately have no geometry-table FK: complete aggregate replacement recreates subordinate rows. Removing a Room/Level keeps the Project-owned historical record. The live Room panel disappears when its Room no longer exists; an authorized caller knowing the old Level/Room IDs can still list that history. No new Project-level gallery is added.

The compound index supports Project/Level/Room lookup ordered by completion time descending, then proposal ID descending as a deterministic tie-break.

## Artifact storage and configuration

`DesignArtifactStore` owns `put`, `read`, and idempotent `delete`; metadata is returned by `put`. The repository stores an opaque artifact key, never an exposed filesystem path. The interface can later support object storage without changing providers or API identity; B4 implements only filesystem storage.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_ARTIFACT_STORAGE` | `filesystem` | Only supported adapter in B4 |
| `AI_ARTIFACT_DIRECTORY` | `.data/design-artifacts` | Private root, relative to API process working directory, or an absolute path |
| `AI_ARTIFACT_MAX_BYTES` | `20000000` | Positive per-image byte limit, configurable up to 100 MB |

For `pnpm api:dev`, the default is under `apps/api/.data/design-artifacts`. Use an absolute path to share storage across different launch working directories. `.data` is excluded from Git and Docker build contexts. No directory or file is created just by constructing the adapter. The first write creates a private directory if necessary.

Writes use application UUID identities, exclusive temporary files with restrictive permissions, file sync, then atomic rename in the same root. Concurrent distinct writes cannot share filenames. Failed writes remove temporary files where possible. Clients cannot choose keys or paths. Read/delete reject all keys outside the strict UUID format. Reads refuse symlinks, check size bounds and verify SHA-256; deletion unlinks the entry without following symlinks. The configured root and its parent directories are trusted server configuration and must be protected by the operator.

Provider image validation requires supported PNG/JPEG/WebP MIME, matching data-URL prefix, strict canonical base64, nonempty bounded bytes, format signatures/headers, positive measured dimensions, and consistency with normalized artifact/telemetry dimensions and format. PNG additionally validates chunk CRCs, bounded decompression, scanline lengths/filter bytes for non-interlaced output. Dimensions are capped at 16,384 per side and 64 million pixels; PNG inflation is capped at 128 MB. JPEG/WebP use structural headers for dimensions, without pixel/content analysis. This is not a general image repair or content-analysis pipeline. No SVG, remote-provider URL fetching, OCR, AI thumbnails, or automatic image ranking is introduced.

Compose mounts the `design_artifacts` named volume at `/workspace/.data/design-artifacts`; the runtime image creates the mount directory for the `node` user. API storage configuration uses this absolute path in Compose, and the same volume remains available with the development overlay. Container replacement preserves it. Removing volumes explicitly removes stored bytes; back up PostgreSQL and this volume together. Without a persistent operator-managed root/volume, filesystem durability does not extend across replacement of the underlying disk.

## Generation and consistency

The sequence is provider generation → normalized proposal → validate/decode image → atomic artifact write → Prisma metadata create → return the persisted DTO. The DTO contains the authenticated CasaStudio artifact route, not provider bytes or the storage identity. Usage and model/configuration fields are selected explicitly. Persistence has no provider dependency.

If metadata creation fails after a file is written, the application tries to delete that file and returns `AI_PROPOSAL_PERSISTENCE_FAILED` (503). Its user-facing meaning is: **The design was generated, but CasaStudio could not save the proposal.** The paid request may have succeeded. No automatic provider retry/fallback occurs; another Generate action is a new paid request. A malformed provider artifact returns the distinct invalid-provider-response category before metadata creation.

External bytes and PostgreSQL cannot share an ACID transaction. A process crash between file write and metadata commit can orphan a file; a crash after metadata/Project deletion but before file cleanup can also orphan bytes. Failed compensation/cleanup is logged using safe Project/proposal IDs. These orphan bytes have no API lookup/access once metadata is gone. There is no distributed transaction, outbox, background garbage collector, or timed retention policy. An HTTP connection loss after commit can make success ambiguous to the client; Room history/Refresh can recover the committed result without generation.

## Authenticated APIs

All operations use JwtAuthGuard and AuthorizedProjectLoader before proposal access. Owners with the CasaStudio user role and administrators follow the existing Project policy. Proposal lookups additionally include owning Project identity; unguessable IDs are never treated as authorization. Cross-user requests get the existing Project denial before proposal lookup, independent of whether a particular proposal exists. Missing proposals within an authorized Project return generic 404s without storage details.

| Method | Route | Behavior |
| --- | --- | --- |
| POST | `/api/v1/projects/:id/design-proposals` | Generate and auto-persist exactly one successful proposal |
| GET | `/api/v1/projects/:id/design-proposals?levelId=…&roomId=…&cursor=…` | 20 normalized metadata records, newest first; optional next cursor |
| GET | `/api/v1/projects/:id/design-proposals/:proposalId/artifact` | Authorized image bytes, correct Content-Type/length, inline disposition |
| DELETE | `/api/v1/projects/:id/design-proposals/:proposalId` | Explicit deletion; 204 on success |

History responses contain no image base64, raw provider payload, whole Project or artifact key. Cursors are bounded, validated timestamp/ID positions, scoped by the requested authorized Project/Level/Room. No unbounded public history query exists. Image/history responses use `Cache-Control: private, no-store`; images also send `X-Content-Type-Options: nosniff`.

Because browser `<img>` does not supply CasaStudio's in-memory Bearer token, the API client fetches a Blob through the normal authenticated boundary. The panel creates an object URL only for the selected image, shares it with full-size preview, aborts obsolete reads, and revokes the URL on selection replacement, deletion, retry, scope change or unmount. An explicit Retry image retries only byte retrieval. Full-resolution images are not eagerly fetched for history rows.

## Room history and session comparison

The compact Saved Room designs area lists date, direction and historical revision status. Selection opens the existing contained image preview and Generation details. Saved designs persist through reload; the current-session comparison remains limited to three proposals and still resets with its AI-B3 context/direction/reference invalidation rules.

Stable proposal ID reconciles both views: current session entries refer to the same durable records and are omitted from the separate history buttons while present in comparison. After session invalidation or reload, they remain in history. A completion invalidated by a direction edit is still durable on the server and can enter the current Room's history without re-entering invalidated session comparisons. A completion belonging to another selected Room is never inserted into that Room's panel.

History retains one metadata page; Older designs replaces it rather than accumulating all history. Refresh history returns to the newest page. Session entries remain separate from paging. Refresh after a request completed during panel unmount or when a first history read was overtaken by generation recovers the server's authoritative page/cursor.

A proposal whose stored revision differs from the current Project revision is labeled **Historical design — current geometry may differ**. No geometric reconciliation or current-geometry claim is made. Unsaved scene edits invalidate comparisons but do not create a new persisted revision; revision comparison alone cannot describe unsaved changes.

Deletion uses the existing accessible MUI confirmation pattern, with title/description, initial Cancel focus, Escape/cancel support, pending lock and failure feedback. It is available from the selected design and full-size preview. Success removes the ID from history and comparison, closes preview, releases its image URL, and selects another session comparison when available. No bulk deletion or Save action is added.

## Retention and Project deletion

Retention is indefinite until explicit proposal or owning Project deletion. There is no invented 30/90-day expiry. Proposal deletion commits metadata removal first, revoking artifact delivery, then performs best-effort byte cleanup. A cleanup failure does not resurrect a deleted record or trigger generation.

Project deletion keeps the repository's authorization check and Project row lock inside its existing transaction. It gathers artifact keys while the row is locked, deletes the Project and cascaded proposal metadata, then removes associated files after commit. Foreign-key insertion and the locked Project deletion serialize concurrent metadata creation: a generation finishing after Project removal fails metadata persistence and compensates its file. Normal aggregate replacement does not delete proposal rows. Cleanup failures after committed Project deletion are logged and can leave inaccessible orphan files as described above.

## Owner-only manual acceptance (zero cost)

Agents must not perform subjective/manual visual acceptance, live provider calls, paid generations, or press Generate design for verification. These steps belong to the owners. No claim of improved visual/design quality follows from B4.

1. Apply the new migration to your chosen development database: `pnpm db:migrate:deploy`. Configure `AI_ARTIFACT_DIRECTORY` to the same durable root used by your API. Start API/web normally. For this path, leave `AI_PROVIDER` and `OPENAI_API_KEY` unset; the fixture utility itself never imports or calls a provider.
2. Choose an existing Project with a Room in 3D. Obtain the stable Project/Level/Room IDs from the canonical Project JSON (the existing authenticated GET Project response or your source fixture). Record its current revision. From the repository root run `pnpm db:seed:design-history <project-id> <level-id> <room-id>`. The explicit development/test-only utility adds two deterministic 640×480 PNG patterns, one tagged at the current revision and one at the preceding revision, with provider `local-fixture`. It does not edit Project data. Repeat for another Room only if needed to check scope. It refuses production mode.
3. Reopen/select the target Room and use Refresh history if already open. Confirm both Local fixture entries appear with date, direction and provenance; the older one carries the Historical design indicator. Neither fixture is an interior-design quality baseline.
4. Select a fixture, inspect Generation details, open full-size preview, and close it using keyboard/Escape. Check image containment and focus restoration at desktop and narrow widths. No Generate/Try another action is needed.
5. Reload the browser and reselect the same Room. Confirm the entries still appear and either image can be reopened. Switch to another Room and confirm its history is scoped correctly; switch back and confirm the original records remain.
6. Cancel one deletion and confirm the record stays. Then confirm deletion, including from an open preview. Confirm the row/session identity disappears, the preview closes, and an authorized request to its artifact route now returns 404. A second signed-in user must not list/fetch/delete the owner's proposal; an administrator follows the established override.
7. Re-read the Project through its authenticated API and compare the recorded revision/geometry: fixture creation, history/preview and proposal deletion must not change them. A normal saved geometry edit may advance revision and should make existing proposals historical. Removing the target Room should leave its Project-owned records durable but remove the live panel. On a disposable Project, verify Project deletion removes its proposal metadata/artifact access and normal file cleanup.
8. Delete the remaining fixture records explicitly when acceptance is complete. Review storage/database backups and the documented crash windows if using this MVP beyond local development.

Optional paid acceptance is a **separate owner decision**, never an agent step: authorize your budget/configuration, generate one design once, confirm it appears in history, reload and reopen it. Persistence does not change generation cost semantics. On persistence failure or ambiguous HTTP success, inspect history/provider billing before choosing a new paid action.

## Automated validation and remaining scope

Tests use fake providers, deterministic local image bytes and temporary filesystem roots. Coverage includes one-artifact/one-record persistence before response; Project immutability; scoped/order/bounded/cursor listing and reload; authenticated binary headers/bytes and cross-user denial; traversal/symlink/integrity/size checks; write/metadata/compensation failures; no provider retries; explicit deletion; deleted-Room history; stable-ID session reconciliation; lazy Blob loading and URL cleanup; PostgreSQL aggregate replacement/Project deletion and a generation finishing after Project deletion. The existing OpenAI SDK factory test still asserts `maxRetries: 0` and no live SDK invocation.

Run `pnpm lint`, `pnpm test`, `pnpm build`, `git diff --check`, `pnpm db:validate`. Database-dependent API suites run when `DATABASE_URL` is supplied. Validate deployment of all migrations and `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` against a disposable test database, never against an unapproved production schema. Test files and validation must use temp storage, not the operator's artifact directory.

MVP limits: trusted single filesystem root/volume; bounded in-process binary delivery; no cloud/CDN/thumbnails; no crash-orphan collector; no idempotency/recovery job for ambiguous paid requests; no Project-level gallery for deleted Rooms; snapshot pagination without a long-lived database snapshot; revision provenance does not model unsaved geometry; structural image validation is not subjective/content acceptance. Retention configuration and an S3-compatible adapter can be added later at the artifact boundary.

AI-C1 now owns durable follow-up/branch lineage and provider-neutral refinement.
AI-C2 owns conversational design UX; AI-C3 owns multi-turn quality validation. AI-D
will own typed Furniture operations, canonical accept/reject and Apply to Project.
None of that later scope is implemented by C1.

## AI-B4.1 presentation update

The original compact history/full-size-preview presentation above has been replaced
by Inspector modes, a dedicated Room Design History dialog and Proposal Review.
History includes the same durable IDs surfaced in session comparisons, while loading
one selected artifact. Existing metadata paging, authorization, storage and object-URL
cleanup remain unchanged. Follow the current [Design Studio owner acceptance procedure](design-studio-workspace.md)
for UI validation.
