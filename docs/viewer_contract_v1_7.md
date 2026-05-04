# Viewer Contract v1.7

**Primary reader:** App-side developer
**Job-to-be-done:** Reference for the Viewer's input/output types
**Next doc:** [Integration Guide](integration_guide.md)

---

## Changes since v1.6

- **`presentationSyncKey` semantics.** The host App now bumps on every section/view selection change — captured or not. The Viewer interprets in two layers: view-button highlight clearing on every change, and presentation re-sync only when `input.presentation` is provided. Earlier versions advised gating the bump on capture availability; that guidance has been replaced by the in-Viewer guard. See *Presentation* below.

---

## Overview

The contract boundary between the host App and the Viewer: input shape, output callbacks, replay direction. **The App owns persisted intent. The Viewer owns runtime execution.** Reflects the current stable implementation; intentionally conservative about transient internals.

---

## Public Boundary

The public integration surface is:

```ts
<Viewer input={viewerInput} output={viewerOutput} />
```

The public contract is centered on:

- `input`
- `output`

The current shared code representation of these public shapes lives in:

- [viewerContractTypes.js](../src/public/viewerContractTypes.js)

The App should always use `Viewer` directly. No wrapper is needed.

---

## Design Intent

The Viewer is designed to render configurable geometric products — homes, cabins, boats, and similar configurable assemblies — inside a host App that owns the business logic. The host App is sometimes called a *CustomApp*; **DemoApp** in this repo is the canonical reference example.

### The host App owns

- products
- sections
- options
- compatibility rules
- pricing logic
- saved configurations
- persisted presentation intent
- admin-authored option ownership/mapping data

### The Viewer owns

- model loading and rendering
- camera playback and quick views
- geometry visibility execution
- material application execution
- environment / terrain / solar rendering
- capture tools
- viewer-side authoring helpers
- transient runtime state needed to make the experience work smoothly

The Viewer should not own business meaning or durable product truth.

---

## High-Level Flow

```ts
App state -> ViewerInput -> Viewer runtime -> ViewerOutput -> App persistence / workflow
```

---

## Viewer Input

```ts
type ViewerInput = {
  model: ViewerModelInput
  camera?: ViewerCameraInput
  scene?: ViewerSceneInput
  presentation?: ViewerPresentationInput
  presentationModeCaptures?: Record<ViewerPresentationMode, ViewerPresentationInput>
  activePresentationMode?: ViewerPresentationMode
  admin?: ViewerAdminInput
  presentationSyncKey?: number
}
```

### Model

```ts
type ViewerModelInput = {
  modelUrl?: string
  productId?: string
  modelVersion?: string
}
```

#### Model Notes

- `modelUrl` is the primary model identity used by the Viewer at runtime. Omit (or pass `undefined`) when no model is selected; the Viewer renders an empty scene in that case.
- `productId` and `modelVersion` are optional App-owned metadata echoed back in readiness/capture events when available.
- Current DemoApp persistence keys authored state by model ID, but that is a repo-specific convenience, not part of the public contract.

### Camera

```ts
type ViewerCameraMode = 'exterior' | 'interior' | 'overhead'

type ViewerCameraInput = {
  cameraMode?: ViewerCameraMode
  pose?: {
    position: [number, number, number]
    target: [number, number, number]
  }
}
```

#### Camera Notes

- `camera.cameraMode` and `camera.pose` are App-owned presentation intent.
- `pose` carries no FOV: each `cameraMode` has a canonical FOV the Viewer applies at replay. A captured FOV would be redundant with `cameraMode`, so it is intentionally omitted.
- The Viewer may keep transient runtime camera state while executing the requested pose.
- The current implementation supports:
  - direct pose playback
  - quick-view execution
  - startup motion
  - viewer-internal navigation helpers for spaces / entries / doorways
- Those viewer-internal navigation helpers are not part of the public contract.

### Scene

```ts
type ViewerSceneInput = {
  visibilityAssignments?: {
    hiddenGeometryIds?: string[]         // geometry to hide (fade); overridden by shownGeometryIds
    shownGeometryIds?: string[]          // geometry to show even if present in hiddenGeometryIds
    instantHiddenGeometryIds?: string[]  // geometry to hide instantly (no fade)
    isolatedGeometryIds?: string[] | null
  }
  defaultMaterialAssignments?: {
    geometryIds: string[]
    color?: string
    roughness?: number
    metalness?: number
    maps?: {
      color?: string
      normal?: string
      roughness?: string
      ao?: string
    }
    textureScale?: number
    normalMapIntensity?: number
    textureRotation?: number
  }[]
  materialAssignments?: {
    geometryIds: string[]
    color?: string
    roughness?: number
    metalness?: number
    restoreOriginalMaterial?: boolean
    maps?: {
      color?: string
      normal?: string
      roughness?: string
      ao?: string
    }
    textureScale?: number
    normalMapIntensity?: number
    textureRotation?: number
  }[]
}
```

#### Scene Notes

- Scene assignments are rendering instructions only.
- They do not imply business meaning by themselves.
- `hiddenGeometryIds`, `shownGeometryIds`, `instantHiddenGeometryIds`, and `isolatedGeometryIds` are interpreted by the Viewer runtime. The Viewer resolves show/hide priority: `shownGeometryIds` wins over `hiddenGeometryIds`. `instantHiddenGeometryIds` hides without fade animation.
- `defaultMaterialAssignments` and `materialAssignments` are two distinct layers merged by the Viewer:
  - `defaultMaterialAssignments` — model-level baseline; applied first.
  - `materialAssignments` — option-driven overrides; applied second, winning for any geometry also covered by a default.
  - A `restoreOriginalMaterial: true` entry in `materialAssignments` restores to the model default for that geometry if one exists, or to the baked original if no default has been set.
- The App owns both arrays and passes them through the contract. The Viewer does not know about the `modelDefaultCapture` data structure — it only receives the resolved arrays.
- Current implementation prefers stable `geometryId` values when available and still supports mesh UUID fallback for compatibility.
- Current DemoApp authoring uses this scene layer to replay:
  - section presentation hidden geometry
  - option-owned geometry membership
  - option-owned material assignments
  - model-level default materials (via `defaultMaterialAssignments`)

### Presentation

```ts
type ViewerPresentationInput = {
  environmentId?: string
  environmentRotation?: number
  hdrIntensity?: number
  backgroundIntensity?: number
  terrainPresetId?: string
  terrainIntensity?: number
  exposure?: number
  sunIntensity?: number
  ambientIntensity?: number
  pointLightIntensity?: number
  spotLightIntensity?: number
  pointLightDistance?: number
  pointLightDecay?: number
  spotLightDecay?: number
  pointLightColorTemperature?: number
  emissiveIntensity?: number
  lightSourceMode?: 'import' | 'auto' | 'none'
  solar?: {
    latitude?: number
    longitude?: number
    northOffset?: number
    time?: {
      hour?: number       // hour of day (0–23.75 in 0.25 increments)
      dayOfYear?: number  // day of year (1–366; supports leap years)
    }
  }
  ui?: {
    showSolarSitePanel?: boolean
    showNorthArrow?: boolean
    showPresetViews?: boolean
    showPresentationPresets?: boolean
    showWinterPresets?: boolean
    showSpaceMenu?: boolean
  }
}
```

#### Presentation Notes

- Presentation is App-owned, persistable visual intent.
- The Viewer interprets and renders it.
- The Viewer may derive render-time values from these inputs, such as light direction and sun vector.
- Solar inputs supported by the contract:
  - `latitude`, `longitude`, `northOffset` — App-persisted solar site configuration
  - `time.hour`, `time.dayOfYear` — optional solar time; included in section/view capture snapshots for deterministic replay. If omitted, the Viewer defaults to solar noon on the summer solstice. The end user can adjust date/time via the Solar panel without the App needing to track it.
- `ui.showSolarSitePanel` controls the Solar / Site panel.
- `ui.showNorthArrow` controls the North Arrow overlay.
- `ui.showPresetViews` controls the Views row (Exterior / Interior / Overhead buttons).
- `ui.showPresentationPresets` controls the Summer presentation mode row (Summer Day / Summer Night / Summer Night Interior buttons).
- `ui.showWinterPresets` controls the Winter presentation mode row (Winter Day / Winter Night / Winter Night Interior buttons).
- `ui.showSpaceMenu` controls the **SpaceMenu** — a scrollable right-column list of navigable spaces and entries. Each item is clickable to navigate to that location.
- In Admin Mode all of these panels are always visible regardless of their flags. A dashed orange outline on any panel indicates it is currently hidden from users (the flag is false in the active capture).
- These UI flags are intentionally separate.

All six presentation modes have built-in hardcoded defaults in the Viewer. `input.presentation` is entirely optional on initial model load — if omitted, the Viewer renders using its built-in defaults. Providing a `presentation` payload is only necessary when the App needs to replay a stored capture.

**`presentationSyncKey`:** An optional monotonically-increasing counter the App increments to signal **"App selection changed"** (a section, view, or other selection event the Viewer should react to). The Viewer interprets a changed value at three layers:

1. **View-button highlight clearing** — fires unconditionally on every change. The Viewer clears any active view-button highlight so the App's own section/view selection becomes the single "active" indicator. (Only one section/view should be highlighted at a time across both layers.)
2. **Presentation re-sync** — fires only if `input.presentation` is provided. When present, the Viewer re-runs `initFromPresentation` against the supplied snapshot, resetting any locally-authored admin overrides to match. When `input.presentation` is `undefined` (because the active section has no captured presentation), the Viewer **preserves its current state** so authoring continuity is maintained — admin tweaks made before the navigation aren't stomped.
3. **Mode-highlight re-sync** — fires only if `input.activePresentationMode` is provided. The Viewer re-applies the value to its internal mode-button highlight, even when the value itself hasn't changed since the previous render. This is what makes "re-click the active section to reset to its preset mode" work when the user has manually clicked a different mode button in between.

**Bump on user-driven section/view selection changes** — captured or not — in **user mode**. In **admin mode**, do **not** bump on Viewer-internal navigation (admin view-button presses): admin view clicks are handled internally by the Viewer (camera, presentation, and mode-highlight all settle from `handleViewChange` → `applyViewCaptureToRuntime`), so a syncKey bump would re-fire the Viewer's input-driven re-sync paths with the still-active *section's* data and override the just-applied view state. Section selection changes should still bump in admin mode (they're driven by the App, not the Viewer). This aligns with the broader contract rule that the App must not trigger replay in admin mode (see `onViewSelected`).

`presentationSyncKey` was previously documented as "force re-sync of input.presentation" and the App was advised to gate the bump on capture availability. That semantics has been replaced by the multi-layer model above as of v1.7.

**`presentationModeCaptures`:** An optional map of all presentation-mode captures the App has persisted, keyed by mode id (`'day'`, `'nightExt'`, `'nightInt'`, `'winterDay'`, `'winterNight'`, `'winterNightInt'`). The Viewer reads this map when the user clicks a presentation mode tile — if a capture exists for the clicked mode, the Viewer applies it; otherwise it falls back to its built-in lighting defaults (and seasonal HDRI/terrain for winter modes). The App owns this map; the Viewer only reads it. Pass the App's full persisted map every render — the Viewer compares by reference, so a stable identity (e.g. a memoized `useState` value) is fine.

**`activePresentationMode`:** The presentation mode the App considers active. The Viewer mirrors this into its internal mode-button highlight so user-mode replays — where the App switches presentation modes implicitly via section/view selection — keep the highlighted button in sync. Without this field, the Viewer's button highlight has no channel for App-driven mode changes (presentation snapshots flow through `input.presentation`, but they don't carry a mode key). Recommended integration: pass the active capture's mode key directly (e.g. `presentationCapture?.presentationMode`); no App-side state mirror is needed. The Viewer re-syncs from this field on every `presentationSyncKey` bump, so re-clicking the active section/view re-applies the capture's mode to the highlight even when the underlying value hasn't changed. Direct mode-button clicks (consumed by the Viewer via `onActivePresentationModeChanged`) update the Viewer's state optimistically and don't bump `presentationSyncKey`, so the optimistic state is preserved without any App round-trip. Optional and backwards-compatible: if omitted, the Viewer manages its mode highlight internally and the user-mode replay sync just won't happen.

### Admin

```ts
type ViewerBatchRenderCaptureItem = {
  metadata?: object
  camera?: { pose?: ViewerCameraPose, cameraMode?: ViewerCameraMode }
  scene?: ViewerSceneInput
  presentation?: ViewerPresentationInput
}

type ViewerAdminBatchCaptureInput = {
  nonce: number
  items: ViewerBatchRenderCaptureItem[]
}

type ViewerAuthoringFocus = 'section' | 'option' | 'view' | 'presentationMode' | 'all'

type ViewerAdminInput = {
  enabled: boolean
  activeOptionCapture?: ViewerOptionCapturePayload
  batchCapture?: ViewerAdminBatchCaptureInput
  activeAuthoringFocus?: ViewerAuthoringFocus
}
```

#### Admin Notes

- The admin bucket remains part of the runtime input boundary.
- The App only needs to decide whether the Viewer should expose admin/authoring tooling (`enabled: true`) or display the product in presentation mode (`enabled: false`).
- When `enabled: true`, the Viewer renders its own built-in Authoring Panel — no external panel hosting required from the App. The panel is dynamic by default: the App should set `activeAuthoringFocus` to the most recently clicked authoring target so the panel filters its content. Omitting the field (or sending `'all'`) puts the panel into a legacy two-tab fallback. See [Dynamic Authoring Panel](integration_guide.md#dynamic-authoring-panel) in the integration guide for the focus → controls table and the App-side threading pattern.
- The Viewer exposes tooling for:
  - section presentation capture (fires `onSectionCaptured`)
  - option capture workflows (fires `onOptionCaptured`)
  - material defaults capture (fires `onMaterialDefaultsCaptured`)
  - view captures (fires `onViewCaptured`)
  - presentation mode captures (fires `onPresentationModeCaptured`)
  - viewer-internal navigation aids such as spaces / entries / doorways
- Spaces / entries / doorways are viewer-side helpers, not intended persisted App business concepts.
- `batchCapture` triggers a programmatic multi-item render sequence. The App constructs a list of `ViewerBatchRenderCaptureItem` entries and increments `nonce` to start the batch. The Viewer processes the items in sequence — snapping the camera to each item's pose, settling for materials and shadows, then capturing a 3840×2160 JPEG. The Viewer fires `onRenderCaptured` after each item and `onBatchCaptureComplete` when all items are done. Admin overlays and debug helpers are automatically hidden during capture so they do not appear in rendered images.

---

## Viewer Output

```ts
type ViewerOutput = {
  onViewerReady?: (event: ViewerReadyEvent) => void
  onSectionCaptured?: (payload: ViewerSectionCapturePayload) => void
  onSectionCaptureCleared?: () => void
  onOptionCaptured?: (payload: ViewerOptionCapturePayload) => void
  onOptionCaptureCleared?: () => void
  onMaterialDefaultsCaptured?: (payload: ViewerMaterialDefaultsPayload) => void
  onMaterialDefaultsCleared?: () => void
  onViewCaptured?: (payload: ViewerViewCapturePayload) => void
  onViewCaptureCleared?: (cameraMode: ViewerCameraMode) => void
  onViewSelected?: (cameraMode: ViewerCameraMode) => void
  onSpaceTileWalkActivated?: (cameraMode: ViewerCameraMode) => void
  onPresentationModeCaptured?: (payload: ViewerPresentationModeCapturePayload) => void
  onPresentationModeCaptureCleared?: (mode: ViewerPresentationMode) => void
  onActivePresentationModeChanged?: (mode: ViewerPresentationMode) => void
  onBatchCaptureComplete?: () => void
  onGeometryPicked?: (event: ViewerGeometryPickedEvent) => void
  onRenderCaptured?: (event: ViewerRenderCapturedEvent) => void
  onError?: (event: ViewerErrorEvent) => void
}

type ViewerPresentationMode = 'day' | 'nightExt' | 'nightInt' | 'winterDay' | 'winterNight' | 'winterNightInt'

type ViewerSectionCapturePayload = {
  pose: ViewerCameraPose
  cameraMode?: ViewerCameraMode
  presentationMode: ViewerPresentationMode
  visibilityAssignments?: ViewerSceneVisibilityAssignments
  ui?: {
    showSolarSitePanel?: boolean
    showNorthArrow?: boolean
    showPresetViews?: boolean
    showPresentationPresets?: boolean
    showWinterPresets?: boolean
    showSpaceMenu?: boolean
  }
}

type ViewerViewCapturePayload = {
  cameraMode: ViewerCameraMode
  pose: ViewerCameraPose
  presentationMode: ViewerPresentationMode
  visibilityAssignments?: ViewerSceneVisibilityAssignments
  ui?: {
    showSolarSitePanel?: boolean
    showNorthArrow?: boolean
    showPresetViews?: boolean
    showPresentationPresets?: boolean
    showWinterPresets?: boolean
    showSpaceMenu?: boolean
  }
}

type ViewerOptionCapturePayload = {
  // Selected geometry IDs the active option should own for show/hide.
  // Omit (or send empty) to signal "no show/hide ownership claim" — used by
  // the Viewer's Capture Material Only flow.
  geometryIds?: string[]
  // Material overrides the active option should apply when selected.
  materialAssignments?: ViewerMaterialAssignment[]
}

type ViewerMaterialDefaultsPayload = {
  defaultMaterialAssignments?: ViewerMaterialAssignment[]
}

type ViewerPresentationModeCapturePayload = {
  mode: ViewerPresentationMode
  presentation: ViewerPresentationInput
}
```

### ViewerReadyEvent

```ts
type ViewerReadyEvent = {
  modelUrl?: string
  productId?: string
  modelVersion?: string
  cameraMode?: ViewerCameraMode
  cameraInfo?: {
    target: [number, number, number]
    size: [number, number, number]
    maxDim: number
    distance: number
  }
}
```

#### ViewerReadyEvent Notes

- Runtime emits a structured readiness payload, not a bare callback.
- `cameraInfo` is Viewer-derived readiness data based on initial framing.
- Exact internal runtime objects remain private even if they help produce this payload.

### Capture payload types

See the `ViewerSectionCapturePayload`, `ViewerViewCapturePayload`, `ViewerOptionCapturePayload`, `ViewerMaterialDefaultsPayload`, and `ViewerPresentationModeCapturePayload` types defined in the `ViewerOutput` section above.

Section and view capture payloads carry a `presentationMode` name rather than inline presentation values. The App resolves mode → snapshot at replay time using its own `presentationModeCaptures` storage. Two replay paths exist:
- **Section / View activation** — the App resolves `presentationModeCaptures[capture.presentationMode]` and pushes that snapshot via `input.presentation` (and bumps `presentationSyncKey`).
- **Mode-tile click inside the Viewer** — the Viewer reads `input.presentationModeCaptures[mode]` directly (the App's full persisted map; see the input field). The App does not need to push `input.presentation` for this case; the Viewer applies the snapshot from its map.

Field-by-field replay mapping for section/view activation:
- `pose` → `input.camera.pose`
- `cameraMode` → `input.camera.cameraMode`
- `presentationMode` → resolved via `presentationModeCaptures[capture.presentationMode]` → `input.presentation`
- `visibilityAssignments` → `input.scene.visibilityAssignments`
- `materialAssignments` → `input.scene.materialAssignments`
- `defaultMaterialAssignments` → `input.scene.defaultMaterialAssignments`
- `ui` → `input.presentation.ui` (UI visibility flags from the capture take precedence over the stored presentation mode snapshot's flags; the App should prefer `capture.ui` over `presentationModeCaptures[mode].ui`)

Section captures and view captures use identical payload shapes. The App replays both through the same `viewerInput` fields — the only difference is what triggers the replay (section tab click vs. `onViewSelected` callback).

### ViewerGeometryPickedEvent

```ts
type ViewerGeometryPickedEvent = {
  geometryId?: string
  meshName?: string
  assemblyId?: string
}
```

#### ViewerGeometryPickedEvent Notes

- Fires when the admin clicks geometry in Admin Mode. Used by DemoApp authoring flows for selection and material-editing context.
- The event is informational — it does not itself stage a capture. Captures are produced by the dedicated `onOptionCaptured` / `onSectionCaptured` / etc. callbacks fired when the admin clicks a Capture button.

### ViewerRenderCapturedEvent

```ts
type ViewerRenderCapturedEvent = {
  imageUrl?: string
  blob?: unknown
  metadata?: Record<string, unknown>
}
```

#### ViewerRenderCapturedEvent Notes

- This fires once per item during a batch capture sequence, delivering the rendered JPEG as a `blob` and a data-URL `imageUrl`.
- `metadata` carries whatever object the App placed in the corresponding `ViewerBatchRenderCaptureItem`. Use it to correlate each image to its source section or item.

### onBatchCaptureComplete

`onBatchCaptureComplete` fires after all items in a batch have been captured. The App should use this signal to trigger any post-batch processing — for example, initiating file downloads for each accumulated blob or writing images to a backend store.

### ViewerErrorEvent

```ts
type ViewerErrorEvent = {
  message?: string
  code?: string
  details?: unknown
}
```

#### ViewerErrorEvent Notes

- This remains part of the intended contract direction.
- The goal is for runtime failures to stay observable without leaking internal implementation details.

---

## Capture / Store / Replay Direction

The intended flow is:

1. Admin configures the scene in the Viewer
2. Viewer emits capture payloads
3. The App stores those payloads
4. The App later sends the persisted intent back as Viewer input
5. The Viewer replays that intent

### App-facing authoring command set

The Viewer fires a `ViewerOutput` callback for each authoring action. The App stores the result and replays it via `viewerInput`:

1. `Section Capture` → `onSectionCaptured(payload)` — pose + cameraMode + presentationMode + visibilityAssignments. App stores against active section.
2. `Clear Section Capture` → `onSectionCaptureCleared()` — App clears active section's capture.
3. `Option Capture` → `onOptionCaptured(payload)` — materialAssignments. App **merges additively** into the existing stored payload for the active section's active option: geometry IDs are unioned; material assignments are merged per `geometryId` with the incoming value winning. To start from scratch, clear first then capture again.
4. `Clear Option Capture` → `onOptionCaptureCleared()` — App clears the option capture.
5. `Capture Material Defaults` → `onMaterialDefaultsCaptured(payload)` — model-level material baseline. Passed to Viewer via `scene.defaultMaterialAssignments` on every load.
6. `Clear Material Defaults` → `onMaterialDefaultsCleared()` — App clears the baseline.
7. `View Capture` → `onViewCaptured(payload)` — cameraMode + pose + presentationMode + visibilityAssignments. App stores keyed by camera mode. When `onViewSelected` fires **in User Mode**, App resolves the capture's `presentationMode` via `presentationModeCaptures` and replays through `viewerInput` (same path as section replay). **In Admin Mode**, `onViewSelected` is also fired but the App must not trigger camera or presentation replay — the Viewer handles navigation internally. The callback's only purpose in Admin Mode is to allow the App to clear section tab highlighting.
8. `Clear View Capture` → `onViewCaptureCleared(cameraMode: ViewerCameraMode)` — App removes the entry for that camera mode from its stored set.
9. `Presentation Mode Capture` → `onPresentationModeCaptured(payload)` — mode + full `ViewerPresentationInput` snapshot. App stores keyed by mode. Referenced by section/view captures at replay time.
10. `Clear Presentation Mode Capture` → `onPresentationModeCaptureCleared(mode)` — App removes the stored entry for that mode from its `presentationModeCaptures`.

`Clear Recent Material Changes` is a viewer-local authoring reset tool, not an App-facing command.

**Clear buttons always fire.** `Clear Material Defaults` (fires `onMaterialDefaultsCleared`), `Clear View Capture` (fires `onViewCaptureCleared(cameraMode)`), and `Clear Presentation Mode Capture` (fires `onPresentationModeCaptureCleared(mode)`) always fire their callbacks even when the Viewer has no locally-cached capture value for the current session. This is intentional: the App may hold a stored capture from a previous session that the Viewer has no knowledge of. Firing the clear callback unconditionally lets the App remove that persisted value.

### Batch Image Capture

Batch capture is an App-initiated programmatic render sequence that produces one JPEG per item. The intended flow is:

1. The App constructs a list of `ViewerBatchRenderCaptureItem` entries — one per section to render, each carrying camera pose, scene visibility, and presentation.
2. The App writes `admin.batchCapture = { nonce: <incremented>, items }` into `viewerInput`. Incrementing the nonce is the trigger signal.
3. The Viewer detects the nonce change and begins processing items in sequence: for each item, it snaps the camera to the item's pose, waits 1500ms for materials and shadows to settle, then captures a 3840×2160 JPEG off-screen.
4. After each capture the Viewer fires `onRenderCaptured({ imageUrl, blob, metadata })`. The App accumulates the blobs.
5. When all items are done, the Viewer fires `onBatchCaptureComplete`. The App uses this signal to trigger downloads or backend storage.

This flow demonstrates the App→Viewer batch rendering capability via the contract boundary.

For the full capture lifecycle — payload shapes per family, replay paths, last-one-wins semantics, Admin vs User Mode rendering, and how section captures resolve their `presentationMode` reference at replay time — see [Capture & Replay](capture_and_replay.md).

---

## Working Rules

### App owns persisted truth

Especially for:

- product definitions
- sections and options
- pricing and compatibility logic
- saved configurations
- presentation presets
- option ownership/mapping data

### Viewer owns runtime execution

Especially for:

- active animation state
- current camera execution
- constraint handling
- render-time scene application
- geometry/material restore behavior
- viewer-local debug/admin helpers

### Public wrapper stays narrow

`Viewer` should continue to protect the host application from:

- `ViewerRoot` refactors
- viewer-local bridges
- runtime debug tooling
- viewer-internal authoring state

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
