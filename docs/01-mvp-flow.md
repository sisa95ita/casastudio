# 01 — MVP Flow

## Purpose

This document defines the functional flow of the first usable CasaStudio MVP.

## Flow overview

```text
1. Project model / casa.json
2. 2D blueprint viewer
3. Geometry engine: 2D → 3D
4. Navigable 3D viewer
5. Saved viewpoints
6. Export current view
7. AI design panel
8. Image-to-image API call
9. Render gallery / timeline
```

## 1. Project model / `casa.json`

The project is described as structured data. The model should include project metadata, unit system, rooms, walls or room dimensions, openings, mezzanine, staircase, heights, saved viewpoints, and render metadata.

```json
{
  "project": { "id": "casa-simone", "name": "Casa Simone", "units": "cm" },
  "rooms": [{ "id": "living-room", "name": "Living Room", "width": 488, "depth": 385, "height": 390 }],
  "features": [{ "id": "mezzanine", "type": "mezzanine", "roomId": "living-room", "position": [238, 0, 195], "size": [250, 385, 20] }]
}
```

## 2. 2D blueprint viewer

For the MVP, the 2D layer can be a viewer rather than a full editor. It must display room outline, main dimensions, mezzanine footprint, staircase footprint, door/window markers, labels, and key measurements. SVG is preferred.

## 3. Geometry engine: 2D → 3D

The geometry engine converts the validated project model into 3D primitives: floor, walls, mezzanine slab, simplified stairs, and opening markers. It must preserve real-world proportions.

## 4. Navigable 3D viewer

The 3D viewer must support orbit, pan, zoom, and camera reset. The MVP style should be neutral and technical.

## 5. Saved viewpoints

A viewpoint stores name, camera position, camera target or rotation, field of view, optional description, and references to project/room.

## 6. Export current view

The app must export the current 3D canvas or saved viewpoint as a PNG image containing the 3D scene only, not the UI.

## 7. AI design panel

The user can provide prompt text, style preset, constraints, selected viewpoint, and base image.

## 8. Image-to-image API call

The backend receives projectId, viewpointId, exported base image, prompt, optional preset, and provider configuration. It calls an AI provider through an adapter.

## 9. Render gallery / timeline

Each render is linked to project, room, viewpoint, base image, prompt, provider, model, generated image, status, creation date, notes, and favorite flag. The gallery is a project decision timeline.
