# Viewer Contract v1.8

**Primary reader:** App-side developer
**Job-to-be-done:** Reference for the Viewer's input/output types
**Next doc:** [Integration Guide](integration_guide.md)

---

## Changes since v1.7

v1.8 is a substantial simplification. The Viewer no longer tracks active state on behalf of the App, and capture payloads no longer carry identity. The App is the single source of truth for which section, option, and presentation mode are active.

**Removed from contract:**
- `viewerInput.presentationModeCaptures` — pMode storage is App-internal; the Viewer never reads it
- `viewerInput.activePresentationMode` — Viewer doesn't track active pMode
- `presentationMode` field on Section/View capture payloads — App attaches its own metadata if it wants pMode tagging
- Capture family: `View` — Views are now **optionless Sections** (a Section may exist without options)
- Callbacks: `onViewCaptured`, `onViewCaptureCleared`, `onViewSelected`, `onActivePresentationModeChanged`
- `VIEWER_PRESENTATION_MODES` enum — pMode taxonomy is App-side; the 6-mode convention is a DemoApp default
- UI flags: `showPresetViews`, `showPresentationPresets`, `showWinterPresets` — the Viewer no longer renders View rows or pMode rows; the App owns those UI surfaces

**Renamed:**
- `presentationSyncKey` → `selectionKey` (one purpose: force camera animation re-fire on bump)

**Also removed (no current consumer):**
- `viewerInput.admin.activeOptionCapture` — Viewer's authoring panel renders pending edits without comparing against App-stored state
- `viewerInput.admin.activeAuthoringFocus` — Viewer's authoring panel uses an internal admin tab/toggle to pick context instead of being driven by the App
- `onSpaceTileWalkActivated` — floor-tile-click navigation is purely viewer-internal; author designs the overhead-view section's presentation to read acceptably from both overhead and interior camera positions
- `onGeometryPicked` — Viewer tracks admin selection internally for material editing; no current App-side consumer

**Capture payload changes:**
- All capture callbacks fire **identity-free, mode-agnostic payloads**. The App attaches identity (active section, active option, active pMode) from its own state on receipt.
- Section capture payloads embed the **full `ViewerPresentationInput` snapshot** instead of carrying a `presentationMode` reference. Section captures are self-contained — they replay without any external lookup.

**`selectionKey` semantic:** two-layer "selection changed — force fresh apply" signal. The App bumps the counter on every section selection click and every admin pMode pill click. The Viewer responds in two layers (each gated on the corresponding input being provided): (1) camera animation re-fires from `input.camera.pose` even when its reference is unchanged; (2) presentation re-syncs from `input.presentation` even when values are identical to current internal state. The view-button-clearing and mode-highlight-resync layers from v1.7's `presentationSyncKey` are removed (their underlying state is gone from the Viewer); the camera-re-fire and presentation-resync semantics survive in cleaner symmetric form.

**What stayed:**
- Public boundary is still `<Viewer input={viewerInput} output={viewerOutput} />`
- `model`, `camera`, `scene`, `presentation`, `admin` input buckets
- Capture/store/replay direction (Viewer fires capture, App stores, App replays via input)
- Section, Option, Material Defaults, Presentation Mode capture families (Section subsumes View)
- Batch render flow

---

## Overview

The contract boundary between the host App and the Viewer: input shape, output callbacks, replay direction. **The App owns persisted intent and all identity. The Viewer owns runtime execution.**

---

## Public Boundary

The public integration surface is:

```ts
<Viewer input={viewerInput} output={viewerOutput} />
```

The current shared code representation of these public shapes lives in:

- [viewerContractTypes.js](../src/public/viewerContractTypes.js)

The App should always use `Viewer` directly. No wrapper is needed.

---

## Design Intent

The Viewer is designed to render configurable geometric products — homes, cabins, boats, and similar configurable assemblies — inside a host App that owns the business logic. The host App is sometimes called a *CustomApp*; **DemoApp** in this repo is the canonical reference example.

### The host App owns

- products
- sections (with or without options)
- options
- compatibility rules
- pricing logic
- saved configurations
- persisted presentation intent
- presentation mode taxonomy and storage (if used)
- admin-authored option ownership/mapping data
- **all identity for captured payloads** (which section, which option, which pMode the capture belongs to)
- all view/pMode selection UI (admin-mode and any user-mode equivalents)

### The Viewer owns

- model loading and rendering
- camera playback and quick views
- geometry visibility execution
- material application execution
- environment / terrain / solar rendering
- capture tools (the editing surface and the "I'm done, persist this" trigger)
- viewer-side authoring helpers
- transient runtime state needed to make the experience work smoothly

The Viewer does not own business meaning, durable product truth, or identity of captured state.

---

## High-Level Flow

```ts
App state -> ViewerInput -> Viewer runtime -> ViewerOutput -> App persistence / workflow
```

**Capture flow:**

1. Admin makes adjustments in the Viewer (camera, lighting, geometry, materials)
2. Admin clicks a Capture button in the Viewer's Authoring Panel
3. Viewer fires an output callback with an **identity-free payload** describing the current state
4. App receives the payload, attaches its own identity (section ID, option ID, pMode tag), and stores it

**Replay flow:**

1. User activates a section, option, or pMode in App-rendered UI
2. App reads the matching stored payload and constructs `viewerInput`
3. Viewer renders

---

## Viewer Input

```ts
type ViewerInput = {
  model: ViewerModelInput
  camera?: ViewerCameraInput
  scene?: ViewerSceneInput
  presentation?: ViewerPresentationInput
  admin?: ViewerAdminInput
  selectionKey?: number
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

- `modelUrl` is the primary model identity used by the Viewer at runtime. Omit (or pass `undefined`) when no model is selected; the Viewer renders an empty scene.
- `productId` and `modelVersion` are optional App-owned metadata echoed back in readiness/capture events when available.

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

- `cameraMode` and `pose` are App-owned presentation intent.
- `pose` carries no FOV: each `cameraMode` has a canonical FOV the Viewer applies at replay.
- The Viewer may keep transient runtime camera state while executing the requested pose.

### Scene

```ts
type ViewerSceneInput = {
  visibilityAssignments?: {
    hiddenGeometryIds?: string[]         // geometry to hide (fade); overridden by shownGeometryIds
    shownGeometryIds?: string[]          // geometry to show even if present in hiddenGeometryIds
    instantHiddenGeometryIds?: string[]  // geometry to hide instantly (no fade)
    isolatedGeometryIds?: string[] | null
  }
  defaultMaterialAssignments?: ViewerMaterialAssignment[]
  materialAssignments?: ViewerMaterialAssignment[]
}

type ViewerMaterialAssignment = {
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
}
```

#### Scene Notes

- Scene assignments are rendering instructions only. They do not imply business meaning by themselves.
- The Viewer resolves show/hide priority: `shownGeometryIds` wins over `hiddenGeometryIds`. `instantHiddenGeometryIds` hides without fade animation.
- `defaultMaterialAssignments` and `materialAssignments` are two distinct layers merged by the Viewer:
  - `defaultMaterialAssignments` — model-level baseline; applied first.
  - `materialAssignments` — option-driven overrides; applied second, winning for any geometry also covered by a default.
  - A `restoreOriginalMaterial: true` entry in `materialAssignments` restores to the model default for that geometry if one exists, or to the baked original if no default has been set.
- The App owns both arrays. The Viewer does not know about the App's `materialDefaultCapture` data structure — it only receives the resolved arrays.
- Current implementation prefers stable `geometryId` values when available and still supports mesh UUID fallback for compatibility.

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
    showSpaceMenu?: boolean
  }
}
```

#### Presentation Notes

- Presentation is App-owned, persistable visual intent. The Viewer renders it.
- All fields are optional; the Viewer fills in built-in defaults for omitted values.
- When `input.presentation` is `undefined`, the Viewer **preserves its current state** — admin authoring isn't reset by uncaptured navigation.
- The Viewer has no internal pMode awareness. It renders whatever `presentation` the App pushes. Switching presentation modes (in admin or user mode) is implemented by the App pushing a different `viewerInput.presentation` snapshot.

#### UI flags

The `ui` field controls user-facing panel visibility:
- `ui.showSolarSitePanel` — Solar / Site panel
- `ui.showNorthArrow` — North Arrow overlay
- `ui.showSpaceMenu` — Rooms panel (scrollable list of navigable spaces)

In Admin Mode, all panels are always visible regardless of these flags. A dashed orange outline indicates a panel currently hidden from users.

### selectionKey

```ts
selectionKey?: number
```

Optional monotonically-increasing counter. The App bumps it on every user-initiated action where it wants the Viewer to "force a fresh apply" of currently-pushed state — section selection clicks and admin pMode pill clicks are the primary cases.

The Viewer responds in two layers (each gated on the corresponding input being provided):

1. **Camera animation re-fires** from `input.camera.pose` even when its reference identity is unchanged. Handles the "user clicks the active section to return to its captured pose after free-navigating" case.
2. **Presentation re-syncs** from `input.presentation` even when values are identical to current internal state. Handles the case where the Viewer's internal admin presentation state has diverged from what the App last pushed (e.g. admin used the Viewer's NavigationDemoPanel pMode buttons that mutate Viewer state without updating App state, then re-clicked an App pMode pill to reload the App-stored snapshot).

When `input.presentation` is `undefined` (uncaptured-section navigation), the Viewer **preserves its current state** regardless of `selectionKey` — admin tweaks aren't stomped by a navigation that has nothing to push.

Bumping when neither input is provided is harmless. Option clicks should not bump `selectionKey` — they change material/visibility intent (App pushes via different state), not camera or presentation intent.

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

type ViewerAdminInput = {
  enabled?: boolean
  batchCapture?: ViewerAdminBatchCaptureInput
}
```

#### Admin Notes

- The admin bucket remains part of the runtime input boundary.
- The App only needs to decide whether the Viewer should expose admin/authoring tooling (`enabled: true`) or display the product in presentation mode (`enabled: false`).
- When `enabled: true`, the Viewer renders its own built-in Authoring Panel (left-side overlay) — no external panel hosting required from the App. The panel uses internal tabs/toggles for context selection (Section / Option / pMode); the App is not involved in driving panel focus.
- The Viewer's admin overlay also includes Viewer-internal authoring conveniences (quick-view buttons for default Exterior/Interior/Overhead poses; default lighting buttons for Day/Night starting points). These are admin-mode-only Viewer UI and do not enter the contract.

`batchCapture` triggers a programmatic multi-item render sequence. The App constructs a list of `ViewerBatchRenderCaptureItem` entries and increments `nonce` to start the batch. The Viewer processes the items in sequence — snapping the camera to each item's pose, settling for materials and shadows, then capturing a 3840×2160 JPEG. The Viewer fires `onRenderCaptured` after each item and `onBatchCaptureComplete` when all items are done. Admin overlays and debug helpers are automatically hidden during capture so they do not appear in rendered images.

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
  onPresentationModeCaptured?: (snapshot: ViewerPresentationInput) => void
  onPresentationModeCaptureCleared?: () => void
  onRenderCaptured?: (event: ViewerRenderCapturedEvent) => void
  onBatchCaptureComplete?: () => void
  onError?: (event: ViewerErrorEvent) => void
}
```

### Capture payload types

```ts
type ViewerCameraPose = {
  position: [number, number, number]
  target: [number, number, number]
}

type ViewerSectionCapturePayload = {
  pose: ViewerCameraPose
  cameraMode: ViewerCameraMode
  presentation: ViewerPresentationInput   // FULL embedded snapshot — self-contained
  visibilityAssignments?: ViewerSceneVisibilityAssignments
}

type ViewerOptionCapturePayload = {
  geometryIds?: string[]                  // omit (or empty) for material-only captures
  materialAssignments?: ViewerMaterialAssignment[]
}

type ViewerMaterialDefaultsPayload = {
  defaultMaterialAssignments: ViewerMaterialAssignment[]
}
```

`onPresentationModeCaptured` fires with a bare `ViewerPresentationInput` snapshot — no wrapper type.

#### Capture payload notes

All capture callbacks fire **identity-free payloads**. The App attaches its own identity from its current state at the moment of capture:

- **Section capture** → routed to the App's currently active section
- **Option capture** → routed to the App's currently active section + currently active option
- **Material Defaults** → global (no identity needed)
- **Presentation Mode capture** → routed to the App's currently active pMode (if the App maintains a pMode taxonomy)

The Viewer never knows which section/option/pMode is currently active. The App is the sole authority for routing.

#### Section capture is self-contained

The `presentation` field embeds a full `ViewerPresentationInput` snapshot. To replay a section, the App simply spreads the capture into `viewerInput`:

```js
const capture = sectionCaptures[selectedSectionId]
const viewerInput = {
  model: { modelUrl },
  camera: { cameraMode: capture.cameraMode, pose: capture.pose },
  presentation: capture.presentation,
  scene: {
    visibilityAssignments: { ...optionVisibility, ...capture.visibilityAssignments },
    materialAssignments: mergedActiveOptionMaterials,
    defaultMaterialAssignments: materialDefaults?.defaultMaterialAssignments,
  },
  admin: { enabled: adminMode },
  selectionKey: bumpedKey,
}
```

No external lookup. The section payload is everything needed for camera + presentation + visibility replay.

#### Optional pMode tagging (App pattern)

The App may attach a pMode tag to its stored section capture for re-skin support:

```js
onSectionCaptured: (payload) => {
  setSectionCaptures(prev => ({
    ...prev,
    [activeSectionId]: { ...payload, presentationMode: currentPModeRef.current }
  }))
}
```

The tag is **App metadata, not contract data**. DemoApp shows this pattern.

#### Optional re-skin (App pattern)

When pMode is updated, the App can scan its stored sections and update the embedded `presentation` snapshots for sections tagged with the changed pMode:

```js
onPresentationModeCaptured: (snapshot) => {
  const modeId = currentPModeRef.current
  setPresentationModeCaptures(prev => ({ ...prev, [modeId]: snapshot }))
  if (autoRestampEnabled) {
    setSectionCaptures(prev => Object.fromEntries(
      Object.entries(prev).map(([id, c]) =>
        c.presentationMode === modeId
          ? [id, { ...c, presentation: snapshot }]
          : [id, c]
      )
    ))
  }
}
```

Pure App-side logic. The Viewer is uninvolved.

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

### ViewerRenderCapturedEvent

```ts
type ViewerRenderCapturedEvent = {
  imageUrl?: string
  blob?: unknown
  metadata?: Record<string, unknown>
}
```

#### Notes

- Fires once per item during a batch capture sequence, delivering the rendered JPEG as a `blob` and a data-URL `imageUrl`.
- `metadata` carries whatever object the App placed in the corresponding `ViewerBatchRenderCaptureItem`. Use it to correlate each image to its source section or item.

### onBatchCaptureComplete

Fires after all items in a batch have been captured. Use this signal to trigger any post-batch processing — for example, downloads or backend storage.

### ViewerErrorEvent

```ts
type ViewerErrorEvent = {
  message?: string
  code?: string
  details?: unknown
}
```

---

## Capture / Store / Replay Direction

The intended flow:

1. Admin configures the scene in the Viewer
2. Viewer emits identity-free capture payloads
3. The App attaches identity from its own state and stores
4. The App later sends stored payloads back as `viewerInput`
5. The Viewer replays

### App-facing authoring command set

The Viewer fires a `ViewerOutput` callback for each authoring action. The App stores the result and replays it via `viewerInput`:

1. **Section Capture** → `onSectionCaptured(payload)` — pose + cameraMode + presentation snapshot + visibilityAssignments. App routes to active section.
2. **Clear Section Capture** → `onSectionCaptureCleared()` — App clears active section's stored capture.
3. **Option Capture** → `onOptionCaptured(payload)` — geometryIds + materialAssignments. App **merges additively** into the active section + active option: geometry IDs are unioned; material assignments are merged per `geometryId` with the incoming value winning. To start from scratch, clear first then capture again.
4. **Capture Material Only** → `onOptionCaptured(payload)` — fires with `materialAssignments` only and `geometryIds` omitted, so the App's show/hide ownership rule is not triggered.
5. **Clear Option Capture** → `onOptionCaptureCleared()` — App clears the option capture.
6. **Capture Material Defaults** → `onMaterialDefaultsCaptured(payload)` — model-level material baseline. Passed back to Viewer via `scene.defaultMaterialAssignments` on every load.
7. **Clear Material Defaults** → `onMaterialDefaultsCleared()` — App clears the baseline.
8. **Mode Capture** → `onPresentationModeCaptured(snapshot)` — current presentation snapshot. App routes to active pMode (if maintaining a pMode taxonomy).
9. **Mode Clear** → `onPresentationModeCaptureCleared()` — App clears the active pMode entry.

`Clear Recent Material Changes` is a viewer-local authoring reset tool, not an App-facing command.

**Clear buttons always fire.** Even when the Viewer has no locally-cached capture for the current session, clear callbacks fire unconditionally. The App may hold a stored capture from a previous session that the Viewer doesn't know about; the unconditional callback lets the App remove any persisted value.

### Views as optionless sections

There is no separate `View` capture family in v1.8. A Section may exist **with options** (functionally serving as what v1.7 called a Section) or **without options** (functionally serving as what v1.7 called a View). Both replay through the same Section Capture / Replay path.

If a Section has options, exactly one option must be active. The App's option list within that section is rendered however the App chooses.

### Presentation Modes are App-side

The 6-mode taxonomy used in DemoApp (`day`, `nightExt`, `nightInt`, `winterDay`, `winterNight`, `winterNightInt`) is an App-side convention, **not a contract surface**. Other Apps may use any taxonomy — fewer modes, more modes, different names, or no modes at all.

The App renders pMode selection buttons (admin-mode for authoring; optionally user-mode for runtime presentation switching). The Viewer's only role is rendering whatever `viewerInput.presentation` snapshot the App pushes.

The Viewer's Authoring Panel keeps **Mode Capture** and **Mode Clear** buttons (admin-only) for the admin to persist the currently-edited presentation snapshot. These callbacks fire identity-free; the App attaches the pMode tag from its own active-pMode state.

### Batch Image Capture

Batch capture is an App-initiated programmatic render sequence that produces one JPEG per item:

1. The App constructs a list of `ViewerBatchRenderCaptureItem` entries — one per section to render, each carrying camera pose, scene visibility, and presentation.
2. The App writes `admin.batchCapture = { nonce: <incremented>, items }` into `viewerInput`. Incrementing the nonce is the trigger signal.
3. The Viewer detects the nonce change and processes items in sequence: for each item it snaps the camera, waits 1500ms for materials and shadows to settle, then captures a 3840×2160 JPEG off-screen.
4. After each capture the Viewer fires `onRenderCaptured({ imageUrl, blob, metadata })`. The App accumulates the blobs.
5. When all items are done, the Viewer fires `onBatchCaptureComplete`. The App uses this signal to trigger downloads or backend storage.

For the full capture lifecycle — payload shapes per family, replay paths, last-one-wins semantics, Admin vs User Mode rendering — see [Capture & Replay](capture_and_replay.md).

---

## Working Rules

### App owns persisted truth

Especially for:
- product definitions
- sections (with or without options) and options
- pricing and compatibility logic
- saved configurations
- presentation mode storage and taxonomy (if used)
- option ownership/mapping data
- **all identity for captured payloads**

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
