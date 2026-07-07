# 06 — Roadmap

## Sprint 0 — Project setup and documentation

Goal: create the repository foundation.

Tasks: create GitHub repository, add documentation pack, define architecture, define environment, define conventions, configure VS Code and Codex workflow, create monorepo, create placeholder apps/packages, add root scripts.

Definition of done: repository exists, documentation is committed, monorepo builds, root scripts exist, no business features implemented yet.

## Sprint 1 — Project model and 2D viewer

Goal: represent the real living room in 2D.

Tasks: define initial `casa.json`, validate with Zod, create SVG viewer, render room outline, mezzanine, staircase footprint, door/window markers, key dimensions and labels.

## Sprint 2 — Geometry engine

Goal: convert project data into 3D primitives.

Tasks: define primitive types, generate floor/walls/mezzanine/stairs/opening markers, and add tests.

## Sprint 3 — 3D viewer

Goal: navigate the house in 3D.

Tasks: setup React Three Fiber, consume geometry primitives, render neutral scene, add OrbitControls, lighting, camera reset, and viewpoint save/load.

## Sprint 4 — Export and AI design

Goal: generate a design render from a 3D viewpoint.

Tasks: export canvas, add prompt panel, create RenderModule, implement OpenAI adapter, store render metadata.

## Sprint 5 — Gallery / timeline

Goal: organize generated renders.

Tasks: render list, filter by viewpoint, show prompt, show base screenshot, show generated image, add favorites/notes if simple.

## Post-MVP

Authentication, Azure Blob Storage, Azure deployment, Jenkins pipeline, render queue, render worker, multi-project support, richer 2D editor, material management, furniture models, and AI design JSON.
