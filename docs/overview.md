# Overview

**Primary reader:** Anyone arriving at the project (PM, engineer, author, evaluator)
**Job-to-be-done:** Understand the Viewer, the host-App pattern, and shared terminology
**Next doc:** Pick one — [Viewer Contract](viewer_contract_v1_8.md) (developers) · [Admin Authoring](admin_authoring_guide.md) (authors) · [Demo Walkthrough](demo_walkthrough.md) (hands-on tour)

---

## What This Repository Is

This repository builds **the Viewer** — a React + Three.js runtime for configurable, geometric SaaS products such as homes, cabins, boats, and similar assemblies.

The Viewer is intended to be embedded inside a **host App** (sometimes called a *CustomApp*) that owns the business logic — sections, options, pricing, compatibility rules, saved configurations. The host App tells the Viewer what to render at any moment; the Viewer renders it and emits events when something useful happens.

This repo ships **DemoApp** as the canonical reference host App. DemoApp demonstrates the full integration pattern and is the example any future CustomApp can mirror. **Build & Price** is one planned future CustomApp that will consume the Viewer.

The public integration surface is a single React component:

```tsx
<Viewer input={viewerInput} output={viewerOutput} />
```

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

Sections are major product decision areas — Roof, Flooring, Cabinetry, Solar Package. A section may have associated options (where exactly one is active at a time) or no options (in which case it serves as a "view-like" stored moment). A section can own a *section capture* (camera pose + camera mode + embedded presentation snapshot + visibility).

### Options

Options are the selectable choices within a section — Shingle Roof / Metal Roof, White Siding / Black Siding, Two Exterior Lights / No Exterior Lights. An option can own:

- geometry membership
- material assignments

Option material assignments overlay onto the model-level default materials. If no defaults have been captured, options overlay onto the baked originals.

### Presentation modes (App-side convention)

A presentation mode is a complete visual environment — HDR sky, terrain, lighting, solar settings. The pMode taxonomy is **App-side** — the contract has no built-in pMode awareness. DemoApp uses six named slots (Summer Day, Summer Night, Summer Night Interior, Winter Day, Winter Night, Winter Night Interior) as a convention; other CustomApps may use any taxonomy, or none at all. Section captures **embed the full presentation snapshot** directly, so they replay self-contained even when the App doesn't maintain a pMode store. Apps that *do* maintain a pMode store can opt into "re-skin" semantics — tagging section captures with a pMode key, and re-resolving via `presentationModeCaptures[tag]` at replay time so updates to a pMode automatically propagate to all sections that share it.

For the full capture lifecycle — payload shapes, replay paths, the embedded-snapshot fallback — see [Capture & Replay](capture_and_replay.md).

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
- **Viewer Input** — The structured object the host App passes into the Viewer to control what it renders. Buckets: `model`, `camera`, `scene`, `presentation`, `admin`, plus `selectionKey`.
- **Viewer Output** — The set of callbacks the Viewer uses to send events back to the host App — readiness, capture payloads, render captures, errors.
- **Section** — A major product decision area such as Roof, Flooring, or Solar Package. Host-App-owned identity. May have associated options (one active at a time) or no options (in which case it serves as a stored "view-like" moment).
- **Option** — A selectable choice inside a section.
- **Section capture** — Stored package of camera pose + camera mode + **embedded presentation snapshot** + visibility for one section. Self-contained — no external lookup required for replay.
- **Presentation Mode (pMode)** — App-side concept (the contract has no built-in pMode awareness). DemoApp uses a 6-mode taxonomy (`'day'`, `'nightExt'`, `'nightInt'`, `'winterDay'`, `'winterNight'`, `'winterNightInt'`) as a convention; other CustomApps may use any taxonomy or none.
- **Presentation Mode capture** — App-stored full `ViewerPresentationInput` snapshot keyed by pMode id. Optional. Apps that maintain a pMode store can re-resolve `presentationModeCaptures[capture.presentationMode]` at section replay time for "re-skin" semantics; Apps without pMode storage fall back to the section capture's embedded snapshot.
- **Option capture** — Stored package of geometry membership and / or material assignments for one option within one section. Captures are additive — repeated captures merge.
- **Material Assignment** — An instruction telling the Viewer how specific geometry should look (color, roughness, metalness, maps, textureScale, etc.).
- **Model Default Materials** — Material assignments stored at the host App layer and passed to the Viewer via `scene.defaultMaterialAssignments` on every load. Applied before option assignments; option assignments always win for the same geometry.
- **Capture Payload** — The serialisable snapshot fired by a `ViewerOutput` callback when the admin clicks a capture action. **Identity-free** — the App attaches its own identity (active section / option / pMode tag) on receipt. The host App stores the payload and replays it later via `ViewerInput`.
- **Geometry ID** — Stable identifier used to target a piece of geometry for visibility/material/configuration behavior. Derived from scene-graph path at load time.
- **Scene Path** — The hierarchy-based path that determines a Geometry ID. Stable across reloads as long as the export hierarchy is stable.
- **Admin Mode** — Enabled by setting `input.admin.enabled = true`. Causes the Viewer to render its built-in Authoring Panel as a left-side overlay. Panel uses internal Section / Option / pMode tabs for context selection. Top of the Section tab carries a **View row** (Exterior / Interior / Overhead → built-in default poses); top of the pMode tab carries four **pMode helper buttons** (Summer/Winter × Day/Night → built-in lighting defaults). Both are pure Viewer-internal authoring conveniences — no public callbacks. The pMode helper count is independent from any host App's pMode taxonomy.
- **`selectionKey`** — Optional monotonically-increasing counter on `viewerInput`. The App's "selection changed — force fresh apply" signal — bump on every section selection click and every admin pMode pill click. The Viewer responds in two layers (each gated on the corresponding input being provided): (1) camera animation re-fires from `input.camera.pose` even when its reference identity is unchanged; (2) presentation re-syncs from `input.presentation` even when values match current internal state. When `input.presentation` is `undefined`, the Viewer preserves its current state regardless of `selectionKey`.
- **Space** — A navigable region in the scene graph, marked by a node whose name contains a recognized space-marker suffix. The system term that covers interior rooms and any other navigable regions added in future; intentionally general so additional kinds (zones, areas) can sit alongside Rooms.
- **Room** — A walkable interior space — a node whose name contains `_RM` (e.g. `LivingDining_RM`). The most common kind of Space today; user-facing UI labels this panel "Rooms."
- **Doorway** — A connection between two rooms, marked by a node whose name contains `_DW` with the form `<RoomA>_<RoomB>_DW` (e.g. `Hall_FrontBedroom_DW`).
- **Entry** — A special doorway with `Exterior_<RoomName>_DW` naming, connecting outside to the named room.
- **Light marker** — A node whose name contains `_PL` (point) or `_SL[<degrees>]` (spot, default 90°) followed by `_` or end-of-name. Each marker becomes a Three.js point or spot light at runtime, positioned at the marker node's world transform origin. Wrapping markers + only that fixture's geometry under a shared parent component **binds** the spawned light to the fixture: it hides automatically when every fixture mesh is in the active hide set.
- **Light Source Mode** — Three-way authoring toggle (`Import` / `Auto` / `None`) determining how interior lights are placed. Captured per presentation mode.
- **Pivot marker** — A group with a `_<degrees><CW|CCW>` substring in its name (e.g. `BedroomDoor_90CCW`). At runtime, clicking the marker's geometry rotates the group around the SketchUp blue (vertical) axis at its local origin. Used for doors, casement windows, lids, and similar hinged geometry. Session-only state — not captured.
- **Batch Capture** — A programmatic multi-item render sequence triggered by the host App via `admin.batchCapture`. The Viewer captures one JPEG per item, fires `onRenderCaptured` per item, then `onBatchCaptureComplete`.
