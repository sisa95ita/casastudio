# AI Coding Guidelines

## Purpose

This document tells AI coding agents how to work on CasaStudio.

## Before coding

Always read README.md, docs/00-vision.md, docs/01-mvp-flow.md, docs/02-architecture.md, docs/04-monorepo.md, and the current task document.

## Task scope

Implement only the requested task. Respect explicit out-of-scope instructions.

## Code quality

Prefer small files, explicit names, pure functions for domain logic, clear package boundaries, and tests for non-trivial logic.

Avoid hidden global state, unnecessary dependencies, framework-specific code inside pure packages, and future features that were not requested.

## Output expectation

After implementing a task, summarize files changed, what was implemented, what was intentionally not implemented, and how to run or test it.
