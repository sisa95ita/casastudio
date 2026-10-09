# AI-C1 implementation report — 9 October 2026

AI-C1 is implemented as the durable iteration foundation. AI-B remains closed.
AI-C retains exactly C1 / C2 / C3; conversational UX and multi-turn image quality
acceptance are not completed or claimed. All changes remain unstaged.

The complete design, API routes and repeatable structural acceptance commands are
in [Conversation & Proposal Lineage](conversation-proposal-lineage.md).

## Requested outcome report

| # | Topic | Result |
| --- | --- | --- |
| 1 | Existing AI-B architecture | Reused Room selection → Design Studio → browser references → authorized canonical context → provider → image validation/storage → durable Proposal → Room history/Proposal Review. Stable IDs, revision provenance, authorization and compensation already existed. |
| 2 | Conversation model | New scoped `DesignConversation` with root FK, timestamps and monotonic turn counter. No messages/status workflow or artifact duplication. |
| 3 | Proposal lineage | Each child Proposal is its durable turn/result identity; existing instructions store the delta. `lineage` exposes conversation ID, parent ID and turn number. |
| 4 | Root policy | Lazy creation only when the first child commits. Existing roots remain unchanged; no historical backfill or empty record on first failure. |
| 5 | Branching | Multiple children of any eligible base, shared conversation, ordered turns, concurrent first branches serialized safely. |
| 6 | Provider-neutral refinement | Separate `refineDesign` contract containing current context/references, saved base image/revision, delta, preservation policy and optional internal provider state. Generate/Try another stays independent. |
| 7 | OpenAI strategy | Explicit saved-image replay in Responses with forced edit; configured models/quality unchanged. Current official docs and installed SDK declarations verified. No provider conversation dependency. |
| 8 | Metadata isolation | Optional continuation JSON belongs to server persistence/result contracts and same-provider dispatch. Public Proposal/API/frontend contracts exclude continuation IDs. OpenAI C1 emits/uses none. |
| 9 | Fallback | The normal replay path is already the artifact-based fallback; absent/expired IDs never cause a second request or generation from scratch. |
| 10 | Primary edit semantics | Previous Proposal first, then axonometric, Interior A and Interior B; optional current view last. Initial generation ordering is unchanged. A reported `action=generate` result is rejected for refinement. |
| 11 | Re-anchoring | Every turn derives canonical context and supplies exact boundaries/Walls/Openings/Stairs/elevations and direct adjacency plus Room references. Canonical architecture outranks proposal pixels. |
| 12 | Preservation | Deterministic BASE DESIGN / ARCHITECTURE / USER CHANGE instructions preserve everything not requested to change. Broader design deltas are allowed within immutable architecture. |
| 13 | Revision safety | 409 `AI_STALE_CONTEXT` before provider work; rechecked under the Project lock before commit. Historical images/lineage remain readable. |
| 14 | Authorization | Existing Project owner/admin policy before lookup, plus Project-scoped Proposal IDs. JWT/cross-user/foreign-Project cases tested. |
| 15 | Persistence | Artifact-first storage; atomic conversation/order/child transaction; revision/existence recheck; rollback and file compensation. No provider regeneration after failure. |
| 16 | Deletion | 409 `AI_PROPOSAL_HAS_DESCENDANTS` for parents, with bytes intact. Leaf deletion removes its turn, retains conversation integrity, then cleans bytes. Empty-root conversation cleanup and Project cascade tested. |
| 17 | Backward compatibility | Null-lineage AI-B records remain readable, deletable and eligible roots. No destructive/backfill migration. |
| 18 | C2 seams | Authorized refinement and bounded conversation-by-Proposal routes, chronological pagination, parent/result/root identities, typed frontend client methods and conflicts. No UI added. |
| 19 | Files/migration | Complete manifest below; one additive migration `20261009130000_design_conversation_lineage`. Historical migrations and ProjectSchema are untouched. |
| 20 | Automated tests | 34 new test cases: 19 DB lineage, 8 adapter, 2 provider-neutral service, 4 frontend client and 1 signed-JWT branching workflow. Existing doubles/controller fixtures updated. |
| 21 | Validation | Required lint/test/build/diff/Prisma/deployment/status/schema-diff checks passed; entire API suite passed with database enabled. Details below. |
| 22 | Live provider calls | **None. No OpenAI/paid-provider request, live image generation, API credit use or subjective/manual visual acceptance occurred.** SDK calls were mocked; providers returned fixtures. |
| 23 | Owner acceptance | Repeat the documented deterministic API/DB acceptance command. It proves P1 → P2, reload, P1 → P3 branching and one fake invocation per refinement, without adding C2 UI. |
| 24 | Limitations | Probabilistic edits can change unrelated pixels; no multi-turn quality/drift claim. Saved revision checks do not cover unsaved UI geometry. Existing filesystem crash-orphan/ambiguous-response limits remain. |
| 25 | C2 handoff | Build explicit single-flight iteration UX using the typed seams, fresh saved-geometry references and stale/deletion conflict handling. C3 retains authorized multi-turn quality/drift acceptance. |

OpenAI's documented image context, multi-turn mechanisms and forced-edit behavior
support explicit replay. [Official image guide](https://developers.openai.com/api/docs/guides/image-generation).
Responses retention, Conversations state and continuation billing informed the
decision to keep application persistence authoritative.
[Official conversation-state guide](https://developers.openai.com/api/docs/guides/conversation-state).

## Validation results

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed, all 6 package tasks |
| `pnpm test` | Passed, 1,499 tests including 16 root tooling tests; 58 DB tests skipped by Turbo strict environment filtering |
| `node tools/ai-c1-validation.mjs --filter @casastudio/api test --maxWorkers=2` | Passed, 20 files / 237 tests, no skips; all DB-backed API suites included |
| Focused C1 DB lineage | 19 cases passed in the full DB-enabled API run |
| Signed-JWT API workflow | 12 cases passed, including C1 branching, reload, conflicts, DTO bounds and authorization |
| OpenAI adapter | 42 mocked cases passed, including 8 new refinement cases |
| Frontend client | 29 cases passed, including refinement/lineage/conflicts |
| `pnpm build` | Passed, 7 tasks; existing Vite large-chunk advisory remains |
| `git diff --check` | Passed |
| Prisma generate/validate | Passed |
| Migration deployment | All 9 migrations successfully deployed to fresh local `casastudio_ai_c1_validation` |
| Migration status | Up to date |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | Passed, no difference |
| Git index | Empty; no add/commit/push/rebase/amend performed |

The database launcher removes `OPENAI_API_KEY` and `AI_PROVIDER` from child
environments and targets the dedicated local validation database. Tests use
temporary artifacts and isolated Projects; fixtures are removed after each suite.
The root Turbo test runner filters `DATABASE_URL`, so database suites were run
separately rather than treating skipped tests as validation.

The first disposable `casastudio_ai_c1` database was used during implementation.
Prisma refused a destructive reset through its AI safety guard; no reset occurred.
A fresh empty `casastudio_ai_c1_validation` database was created for finalized
migration validation instead. Existing databases/data were not destroyed. Both
validation databases remain local; the final acceptance launcher targets the latter.

Non-failing existing advisories include large Vite chunks and the Prisma/pg
concurrent-query deprecation warning during canonical aggregate persistence tests.
No new stochastic or paid acceptance was added.

## Changed files

The manifest below includes production code, fixtures/tests, migration, documentation
and the deterministic validation launcher. No user-facing UI component was changed.

- `apps/api/prisma/migrations/20261009130000_design_conversation_lineage/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/ai/ai.module.ts`
- `apps/api/src/ai/api/design-proposal.dto.ts`
- `apps/api/src/ai/api/design-proposals.controller.test.ts`
- `apps/api/src/ai/api/design-proposals.controller.ts`
- `apps/api/src/ai/api/design-workflow.integration.test.ts`
- `apps/api/src/ai/application/generate-design-proposal.service.test.ts`
- `apps/api/src/ai/application/generate-design-proposal.service.ts`
- `apps/api/src/ai/application/lineage-problem.ts`
- `apps/api/src/ai/application/persist-design-proposal.service.ts`
- `apps/api/src/ai/application/refine-design-proposal.service.ts`
- `apps/api/src/ai/openai/openai-interior-design.provider.test.ts`
- `apps/api/src/ai/openai/openai-interior-design.provider.ts`
- `apps/api/src/ai/openai/openai-prompt-builder.ts`
- `apps/api/src/ai/persistence/design-lineage.integration.test.ts`
- `apps/api/src/ai/persistence/design-proposal.repository.ts`
- `apps/api/src/ai/persistence/prisma-design-proposal.repository.ts`
- `apps/api/src/ai/test/design-fixture.ts`
- `apps/api/src/ai/unconfigured-interior-design.provider.ts`
- `apps/api/src/common/problem-details/api-error-code.ts`
- `apps/web/src/core/api/CasaStudioApiClient.test.ts`
- `apps/web/src/core/api/CasaStudioApiClient.ts`
- `apps/web/src/core/api/api-types.ts`
- `docs/05-ai-integration.md`
- `docs/ai/ai-c1-implementation-report.md`
- `docs/ai/conversation-proposal-lineage.md`
- `docs/ai/durable-design-proposals.md`
- `packages/ai/src/contracts.ts`
- `packages/ai/src/design-service.test.ts`
- `packages/ai/src/design-service.ts`
- `packages/ai/src/failures.ts`
- `packages/ai/src/provider.ts`
- `tools/ai-c1-validation.mjs`
