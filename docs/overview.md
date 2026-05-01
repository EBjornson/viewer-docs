# Overview

**Primary reader:** Anyone arriving at the project (PM, engineer, author, evaluator)
**Job-to-be-done:** Understand the Viewer, the host-App pattern, and shared terminology
**Next doc:** Pick one — [Viewer Contract](viewer_contract_v1_7.md) (developers) · [Admin Authoring](admin_authoring_guide.md) (authors) · [Tester Quickstart](tester_quickstart.md) (testers)

---

## What This Repository Is

This repository builds **the Viewer** — a React + Three.js runtime for configurable, geometric SaaS products such as homes, cabins, boats, and similar assemblies.

The Viewer is intended to be embedded inside a **host App** (sometimes called a *CustomApp*) that owns the business logic — sections, options, pricing, compatibility rules, saved configurations. The host App tells the Viewer what to render at any moment; the Viewer renders it and emits events when something useful happens.

This repo ships **DemoApp** as the canonical reference host App. DemoApp demonstrates the full integration pattern and is the example any future CustomApp can mirror. **Build & Price** is one planned future CustomApp that will consume the Viewer.

The public integration surface is a single React component:

```tsx
<BuildAndPriceViewer input={viewerInput} output={viewerOutput} />
```

(Conceptually this is "the Viewer." It is currently exported as `BuildAndPriceViewer` for legacy reasons; a code rename is tracked in [CLAUDE.md](../CLAUDE.md).)

---

## The Architectural Pattern

Two cooperating parts.

### The host App

The App is the business system. It owns:

- products, sections, options
- pricing logic, compatibility rules
- saved configurations
- user/account flows
- persisted presentation/configuration intent

### The Viewer

The Viewer is the rendering and execution system. It owns:

- model loading and rendering
- camera playback
- geometry visibility execution
- material application execution
- environment / terrain / solar rendering
- capture/playback tooling
- viewer-local runtime state needed to make the experience work smoothly

The Viewer never owns business meaning or durable product truth.

For the layered internal structure of the Viewer itself, see [Architecture](architecture.md).

---

## Sections, Options, Captures

The host App's structure that the Viewer renders.

### Sections

Sections are major product decision areas — Roof, Flooring, Cabinetry, Solar Package. In the current model, one chosen option exists per section, and a section can own a *section capture* (camera pose + camera mode + presentation-mode reference + visibility + UI flags).

### Options

Options are the selectable choices within a section — Shingle Roof / Metal Roof, White Siding / Black Siding, Two Exterior Lights / No Exterior Lights. An option can own:

- geometry membership
- material assignments

Option material assignments overlay onto the model-level default materials. If no defaults have been captured, options overlay onto the baked originals.

### Presentation modes

A presentation mode is a complete visual environment — HDR sky, terrain, lighting, solar settings — saved under one of six named slots: Summer Day, Summer Night, Summer Night Interior, Winter Day, Winter Night, Winter Night Interior. Section and view captures *reference* a presentation mode by name; the host App resolves the full snapshot at replay time.

For the full capture lifecycle — payload shapes, replay paths, last-one-wins semantics — see [Capture & Replay](capture_and_replay.md).

---

## Authoring at a Glance

The host App enables admin authoring by setting `input.admin.enabled = true`. The Viewer renders its built-in **Authoring Panel** as a left-side overlay containing all capture/clear actions; no external panel hosting is needed.

Captures fire as `viewerOutput` callbacks; the host App stores them and replays them later via `viewerInput`. For the day-to-day workflow see [Admin Authoring Guide](admin_authoring_guide.md). For the model preparation that supports it see [Model Authoring Guide](model_authoring_guide.md).

---

## User Experience

For the end user, the experience is:

1. Choose a section.
2. If the section has a captured pose, the camera animates to it and the captured presentation applies.
3. Choose an option.
4. See the 3D result immediately — geometry and materials update.
5. Understand the product and price more clearly.
6. (When implemented in the host App) press a "Complete Build" or equivalent action to receive rendered images, one per authored section.

The camera and presentation system communicates the product visually; product *meaning* still comes from the host App's section/option state.

---

## Deterministic Replay

A core design goal:

> The same final configuration always produces the same final display.

That motivates several invariants:

- section-owned presentation
- option-owned configuration effects
- two **independent** cross-section ownership rules (show/hide and material assignments) enforced at the App layer

This keeps the result understandable, replayable, and shareable.

---

## Glossary

This is the canonical glossary for the documentation set. Other docs link here rather than repeating these definitions.

- **Viewer** — The rendering/runtime layer (this repository's primary product). Loads the model, animates the camera, applies scene/presentation instructions, exposes capture tooling.
- **Host App** (also: *CustomApp*) — Any business/application layer that consumes the Viewer. Owns persisted intent, pricing, product logic, and saved configurations. **DemoApp** is the reference example shipped in this repo; **Build & Price** is one planned future CustomApp.
- **DemoApp** — The reference host App in this repo (`src/DemoApp/DemoApp.jsx`). Demonstrates the full capture/replay pattern; not a published API or production target. See [DemoApp](demoapp.md).
- **`BuildAndPriceViewer`** — The current legacy export name for the Viewer's public component. Conceptually "the Viewer." A code rename is tracked in `CLAUDE.md`.
- **Viewer Input** — The structured object the host App passes into the Viewer to control what it renders. Buckets: `model`, `camera`, `scene`, `presentation`, `presentationModeCaptures`, `admin`, plus `presentationSyncKey`.
- **Viewer Output** — The set of callbacks the Viewer uses to send events back to the host App — readiness, capture payloads, geometry picks, render captures, errors.
- **Section** — A major product decision area such as Roof, Flooring, or Solar Package. Host-App-owned identity.
- **Option** — A selectable choice inside a section.
- **Section capture** — Stored package of camera pose + camera mode + presentation-mode reference + visibility + UI flags for one section.
- **View capture** — Stored package with the same shape as a section capture, keyed by camera mode (`'exterior'` | `'interior'` | `'overhead'`) instead of by section. Replayed when the user presses a View button.
- **Presentation Mode** — A named visual preset (`'day'`, `'nightExt'`, `'nightInt'`, `'winterDay'`, `'winterNight'`, `'winterNightInt'`) that owns a full `ViewerPresentationInput` snapshot. Section and view captures reference a mode by name; the host App resolves the snapshot at replay time.
- **Presentation Mode capture** — Stored full `ViewerPresentationInput` snapshot for one named mode.
- **Option capture** — Stored package of geometry membership and / or material assignments for one option within one section. Captures are additive — repeated captures merge.
- **Material Assignment** — An instruction telling the Viewer how specific geometry should look (color, roughness, metalness, maps, textureScale, etc.).
- **Model Default Materials** — Material assignments stored at the host App layer and passed to the Viewer via `scene.defaultMaterialAssignments` on every load. Applied before option assignments; option assignments always win for the same geometry.
- **Capture Payload** — The serialisable snapshot fired by a `ViewerOutput` callback when the admin clicks a capture action. The host App stores it and replays it later via `ViewerInput`.
- **Geometry ID** — Stable identifier used to target a piece of geometry for visibility/material/configuration behavior. Derived from scene-graph path at load time.
- **Scene Path** — The hierarchy-based path that determines a Geometry ID. Stable across reloads as long as the export hierarchy is stable.
- **Admin Mode** — Enabled by setting `input.admin.enabled = true`. Causes the Viewer to render its built-in Authoring Panel as a left-side overlay. The panel is dynamic by default — filtered by `input.admin.activeAuthoringFocus` (`'section' | 'option' | 'view' | 'presentationMode' | 'all'`).
- **`presentationSyncKey`** — Optional monotonically-increasing counter on `viewerInput`. Signals **"App selection changed"** — bump on every section/view selection change (captured or not). The Viewer interprets in two layers: (1) clears any active view-button highlight on every change, so only one section/view button stays "active" across both layers; (2) re-syncs presentation state from `input.presentation` only when a snapshot is provided. When `input.presentation` is `undefined` (uncaptured selection), the Viewer preserves its current state to maintain authoring continuity.
- **`presentationModeCaptures`** — Host-App-owned input field on `viewerInput`: a map of mode id → `ViewerPresentationInput` snapshot. The Viewer reads it when the user clicks a mode tile (applies the captured snapshot, or falls back to built-in lighting defaults if absent). Pass the full persisted map every render — the Viewer only reads it.
- **Space** — A navigable region in the scene graph, marked by a node under the `Spaces` top-level container. The system term that covers interior rooms and any other navigable regions added in future; intentionally general so additional kinds (zones, areas) can sit alongside Rooms.
- **Room** — A walkable interior space — a child of `Spaces > Rooms`. The most common kind of Space today; user-facing UI labels this panel "Rooms."
- **Doorway** — A connection between two rooms, marked under `Spaces > Doorways` with leaf name `<RoomA>_<RoomB>`.
- **Entry** — A special doorway with `Exterior_<RoomName>` naming, connecting outside to the named room.
- **Light marker** — A node whose name contains `_PL` (point) or `_SL[<degrees>]` (spot, default 90°) followed by `_` or end-of-name. Each marker becomes a Three.js point or spot light at runtime, positioned at the marker node's world transform origin. Wrapping markers + only that fixture's geometry under a shared parent component **binds** the spawned light to the fixture: it hides automatically when every fixture mesh is in the active hide set.
- **Light Source Mode** — Three-way authoring toggle (`Import` / `Auto` / `None`) determining how interior lights are placed. Captured per presentation mode.
- **Pivot marker** — A group with a `_<degrees><CW|CCW>` substring in its name (e.g. `BedroomDoor_90CCW`). At runtime, clicking the marker's geometry rotates the group around the SketchUp blue (vertical) axis at its local origin. Used for doors, casement windows, lids, and similar hinged geometry. Session-only state — not captured.
- **Batch Capture** — A programmatic multi-item render sequence triggered by the host App via `admin.batchCapture`. The Viewer captures one JPEG per item, fires `onRenderCaptured` per item, then `onBatchCaptureComplete`.
