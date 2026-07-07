# AI Project Context

## Purpose

This document is written for AI coding agents.

## Product summary

CasaStudio is an open-source AI-assisted interior design and architectural visualization web app.

The MVP takes structured 2D project data, renders a 2D blueprint, generates a navigable 3D scene, exports viewpoints as PNG images, sends them to an image-to-image AI provider with a design prompt, and stores generated renders in a gallery.

## Key rule

The project model is the source of truth. Do not duplicate geometry knowledge across unrelated modules.

## Architecture

Use a monorepo and modular monolith. Do not introduce microservices, queues, or workers unless explicitly requested.

## Current MVP focus

Build incrementally: documentation, monorepo setup, schema, 2D viewer, geometry engine, 3D viewer, AI render module, gallery.

## Do not implement unless asked

Do not implement a full CAD editor, AI-generated furnished 3D scenes, worker queue, authentication, cloud deployment, furniture catalogue, or advanced rendering unless explicitly requested.
