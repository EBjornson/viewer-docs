# Capabilities and Limits

**Primary reader:** Anyone evaluating the Viewer's current state
**Job-to-be-done:** Know what's working today vs. what's known-limited
**Next doc:** [Overview](overview.md)

---

## Purpose

What the Viewer reliably does today, what is prototype-like, and what should not be mistaken for productized behavior. Intended for stakeholder conversations, partner onboarding, and setting realistic expectations.

---

## Current Stable Capabilities

### Viewer playback

The current viewer can reliably:

- load a `.glb` model
- present exterior, interior, and overhead quick views
- replay App-provided camera and presentation intent
- apply visibility and material assignments
- render HDR, terrain, lighting, and solar-driven presentation state
- swing click-to-rotate pivot markers (doors, windows, hinged fixtures) at runtime

### Section presentation capture/replay

The current stable authoring flow supports:

- capturing section presentation
- replaying section presentation later
- using section-level hidden geometry as presentation context

This is especially useful for things like:

- overhead views with roof hidden
- guided camera moments per section

### Option geometry/material capture

The current stable authoring flow supports:

- associating geometry with options
- associating material changes with options
- a **Capture Material Only** button that captures material changes without claiming show/hide ownership of selected geometry — used when colouring geometry that's already owned for show/hide by another section
- replaying chosen options later
- removing captured option geometry/materials

### Model default material capture

The current stable authoring flow supports:

- capturing a model-level material baseline (colors, textures, roughness/metalness)
- persisting that baseline per demo model
- replaying it automatically on every load, before any option assignments are applied
- option assignments always override defaults for the same geometry
- clearing the stored model default baseline

### Deterministic ownership model

The App enforces two independent cross-section ownership rules — show/hide ownership and material assignment ownership — at its `onOptionCaptured` handler. Captures that would violate either rule are rejected and the admin sees a red banner naming the conflicting geometry and owning section/option. Pre-existing violations from older persisted state are surfaced via a separate amber banner on load.

See [Cross-Section Ownership Enforcement](integration_guide.md#cross-section-ownership-enforcement) for the canonical rules and conflict-detection code.

### Demo model persistence

The current repo supports:

- browser-side persistence of authored demo state
- per-demo-model storage
- reset of saved demo authoring

### Admin mode toggle

The Viewer supports `input.admin.enabled`:

- `true` — renders the built-in Authoring Panel (left-side overlay) with internal Section / Option / pMode tabs for context selection. Top of the Section tab includes a **View row** (Exterior / Interior / Overhead) for navigating to built-in default poses; top of the pMode tab includes four **pMode helper buttons** (Summer/Winter × Day/Night) for loading built-in lighting defaults. Both are pure Viewer-internal admin conveniences — no public callbacks.
- `false` — renders purely from what the App passes through `viewerInput`; clean presentation mode for end-user browsing

This is helpful for both authoring and demonstrating capability.

### Section image capture (batch render)

The system can generate one JPEG render per section programmatically. The App triggers a batch by setting `admin.batchCapture = { nonce, items }` in `viewerInput` (incrementing the nonce is the trigger). The Viewer processes each item in sequence — snapping the camera, settling 1500ms for materials and shadows, then capturing a 3840×2160 JPEG off-screen. The Viewer fires `onRenderCaptured({ imageUrl, blob, metadata })` after each item and `onBatchCaptureComplete` when all items are done.

The DemoApp demonstrates this with the **Complete Build** button, which becomes blue once at least one section has a captured pose. Clicking it downloads one JPEG per captured section, named by section label.

---

## Capabilities That Exist But Are Still More Prototype-Like

### Viewer-internal navigation aids

The repo supports substring-based name markers for viewer-side navigation and authoring aids:

- `<RoomName>_RM` — walkable interior spaces (e.g. `LivingDining_RM`)
- `<RoomA>_<RoomB>_DW` — interior connections between two rooms (e.g. `Hall_FrontBedroom_DW`)
- `Exterior_<RoomName>_DW` — entries from outside into the named room (e.g. `Exterior_LivingDining_DW`)

A dedicated **Rooms panel** (implemented by the internal `SpaceMenu` component) shows the list of navigable rooms in the right column of the viewer (shown or hidden by the **Rooms** User Visibility toggle). Each room is clickable to navigate to that location. This replaces the inline text footer that was previously in the navigation bar.

There are two distinct navigation behaviors depending on how the user reaches a room:

**Rooms panel button:** Clicking a room in the Rooms panel **only navigates the camera** — it switches the view mode to interior and animates the camera to that location. It does not change lighting, environment, exposure, material assignments, or geometry visibility. All scene presentation state is left exactly as it was before the click.

**Overhead floor-tile click:** When the user is in an overhead-mode section and clicks a floor tile (a recognized `_RM` room marker face), the Viewer navigates the camera into that interior space via pathNav. **No callback fires** in v1.8 — the camera movement is purely Viewer-internal. The active section's presentation/visibility persists. See [Capture & Replay → Overhead Floor-Tile Click](capture_and_replay.md#overhead-floor-tile-click).

Room navigation is **viewer-side runtime behavior** — used during authoring and by end users navigating the model. There is currently no plan to expose the list of available rooms to the App through the public contract. The Rooms panel (controlled by `ui.showSpaceMenu`) renders the list and handles navigation entirely within the Viewer.

### Runtime debug helpers

The repo currently includes helpful debug/admin tools such as:

- performance HUD
- pathNav debug path
- camera debug readouts

A custom axis helper implementation also exists in the repo, but it is currently parked/disabled pending a safer revisit.

These are valuable in development and demos, but they are not the same thing as a final user-facing product interface.

### Current DemoApp authoring workflow

The repo’s current authoring workflow is very useful, but it still lives in a reference demo application (`DemoApp`) rather than a polished SaaS admin application.

---

## Known Limits

### 1. The public host-app contract is still intentionally narrow

The stable public integration boundary is:

- `Viewer`
- `input`
- `output`

Any internal viewer modules below that boundary are implementation details and should not be treated as a final host-app integration API.

### 2. Persistence is currently browser-local

Current stable persistence is:

- `localStorage`
- per demo model

This is great for demonstration and prototyping, but it is not a substitute for a real backend persistence model.

### 3. Lower-level refinement is currently handled through options

The current repo treats options as the practical place for lower-level configuration refinement.

That means the current system is intentionally centered on:

- sections
- options

rather than on an additional separate refinement layer.

### 4. Batch render produces individual downloads, not a zip archive

The current batch capture implementation produces full-quality 3840×2160 JPEGs and downloads them individually (one file per section). A zip archive or server-side batch delivery is not yet implemented.

### 5. Model quality still matters a lot

The system works best when:

- hierarchy is stable
- naming is disciplined
- configurable geometry is targetable
- navigation markers are authored carefully

Weak model structure can still create friction.

### 6. Some richer navigation behavior is still under evaluation

The repo now supports richer interior navigation and path-based motion, including routed interior replay for viewer-resolved interior targets.

Useful progress has been made, and some interior constraint behavior now exists as well, but parts of that navigation/runtime behavior are still being tuned and should not yet be described as fully settled product behavior.

### 7. Model re-export can break existing captures

Stable `geometryId` values are derived from the model's scene hierarchy path at load time. If a model is re-exported with structural changes — renamed objects, reorganised hierarchy, or reordered siblings — the resulting `geometryId` values may change. Any captured section, option, or material assignments that reference the old IDs will no longer match, effectively requiring re-authoring.

There is no automatic migration path. The current recommendation is to treat the exported model hierarchy as stable once authoring begins and to co-ordinate any structural model updates carefully. `productId` and `modelVersion` are available in `ViewerModelInput` for App-level version tracking, but the Viewer does not automatically remap captures across model versions.

---

## What This Means For External Communication

It is fair to say:

- the section/option authoring model is real
- capture/replay is real
- viewer/app boundary is becoming coherent
- the demo is now meaningfully expressive

It is also fair to say:

- some advanced navigation behavior is still being refined
- the current admin environment is still a reference demo application (`DemoApp`), not a final production admin product
- persistence is still local demo persistence, not final backend persistence

That balance is honest and strong.

---

## Good External-Framing Language

If you need a concise external summary, something like this is accurate:

> The current system already demonstrates a coherent section-and-option-based configuration model, section presentation capture, option geometry/material replay, and a clear Viewer/App boundary. Some advanced navigation behaviors and long-term host-app/admin integration details are still being refined.

---

## Short Summary

### Strong today

- section presentation capture/replay (pose + camera mode + presentationMode reference + visibility + UI flags)
- option material capture/replay
- model default material capture/replay
- presentation mode capture/replay (App-side pMode taxonomy; DemoApp uses 6 modes: Summer Day / Summer Night / Summer Night Interior / Winter Day / Winter Night / Winter Night Interior)
- deterministic ownership model
- admin mode toggle (viewer self-contained authoring overlay)
- per-model local persistence (DemoApp, localStorage)
- section image capture (batch render — 3840×2160 JPEG per section via Complete Build)
- coherent viewer boundary direction

### Still maturing

- advanced navigation behavior
- full production admin experience
- backend persistence model
- batch render zip archive / server-side delivery

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
