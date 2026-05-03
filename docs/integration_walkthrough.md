# Example Integration Walkthrough

**Primary reader:** App-side developer
**Job-to-be-done:** See concrete code for an end-to-end integration
**Next doc:** [Capture & Replay deep-dive](capture_and_replay.md)

---

## Purpose

A working code-first example of integrating `Viewer` end-to-end — `viewerInput` construction, all capture callbacks wired up, persistence, and batch image capture. Read [How a Host App Talks to the Viewer](integration_guide.md) for the why; this doc is the how.

---

## The Starting Point

The Viewer is currently integrated like this:

```tsx
<Viewer
  input={viewerInput}
  output={viewerOutput}
/>
```

So there are two jobs for The App:

1. build `viewerInput`
2. respond to `viewerOutput` events

---

## Step 1: The App Keeps Its Own State

The App should own the meaningful state.

For example:

```ts
const appState = {
  activeSectionId: 'section3',
  chosenOptionBySection: {
    section1: 'Option 1',
    section2: 'Option 2',
    section3: 'Option 1',
  },
  modelDefaultCapture: {
    defaultMaterialAssignments: [
      {
        geometryIds: ['wall-geom-1', 'wall-geom-2'],
        color: '#d4c5a9',
        roughness: 0.8,
      },
    ],
  },
  sectionCaptures: {
    section3: {
      pose: {
        position: [0, 18, 0],
        target: [0, 0, 0],
      },
      cameraMode: 'overhead',
      presentationMode: 'day',
      visibilityAssignments: {
        hiddenGeometryIds: ['roof-geom-1', 'roof-geom-2'],
        isolatedGeometryIds: null,
      },
    },
  },
  optionCaptures: {
    'section3_Option 1': {
      materialAssignments: [
        {
          geometryIds: ['solar-geom-1'],
          color: '#1a1a1a',
          roughness: 0.65,
          metalness: 0.2,
        },
      ],
    },
  },
  viewCaptures: {
    interior: {
      cameraMode: 'interior',
      pose: { position: [2, 1.6, 3], target: [0, 1.6, 0] },
      presentationMode: 'nightInt',
      visibilityAssignments: { hiddenGeometryIds: [] },
    },
  },
  presentationModeCaptures: {
    day: { environmentId: '/hdri/meadow.exr', exposure: 0.6 },
    nightExt: { environmentId: '/hdri/city-night.exr', exposure: 0.3 },
    nightInt: { environmentId: '/hdri/interior.exr', exposure: 0.5 },
    winterDay: { environmentId: '/hdri/winter-day.exr', exposure: 0.5 },
    winterNight: { environmentId: '/hdri/winter-night.exr', exposure: 0.25 },
    winterNightInt: { environmentId: '/hdri/interior.exr', exposure: 0.45 },
  },
}
```

The App should be able to explain:

- which section is active
- which option is chosen
- what presentation belongs to that section
- what geometry/material effects belong to that option

That is the App’s job.

---

## Step 2: The App Translates Its State Into Viewer Input

The Viewer should not have to understand your business rules directly.

Instead, The App should translate its own state into a `viewerInput` object.

For example:

```ts
const activeCapture = appState.sectionCaptures[appState.activeSectionId]
const activeOptionCapture = appState.optionCaptures[`${appState.activeSectionId}_${chosenOption}`]

// Resolve presentation — see capture_and_replay.md#presentation-resolution for the why.
const modeSnapshot = appState.presentationModeCaptures[activeCapture?.presentationMode] ?? defaultPresentation
const presentation = activeCapture?.ui
  ? { ...modeSnapshot, ui: { ...modeSnapshot?.ui, ...activeCapture.ui } }
  : modeSnapshot

const viewerInput = {
  model: {
    modelUrl: currentModelUrl,
    productId: currentProductId,
    modelVersion: currentModelVersion,
  },
  camera: {
    cameraMode: activeCapture?.cameraMode ?? 'exterior',
    pose: activeCapture?.pose,
  },
  scene: {
    visibilityAssignments: {
      hiddenGeometryIds: allOptionGeometryIds,
      shownGeometryIds: activeOptionGeometryIds,
      instantHiddenGeometryIds: activeCapture?.visibilityAssignments?.hiddenGeometryIds,
    },
    defaultMaterialAssignments: appState.modelDefaultCapture?.defaultMaterialAssignments,
    materialAssignments: activeOptionCapture?.materialAssignments ?? [],
  },
  presentation,
  presentationModeCaptures: appState.presentationModeCaptures, // App's full per-mode capture map; the Viewer reads it for mode-switch resolution
  admin: {
    enabled: isAdminMode,
    activeAuthoringFocus,   // drives the dynamic Authoring Panel
  },
}
```

In plain language:

- The App does the product thinking
- then sends the Viewer a clean set of instructions
- `defaultMaterialAssignments` is passed from the App's `modelDefaultCapture` record — the Viewer merges it with `materialAssignments` internally
- The presentation field is resolved via the canonical two-layer pattern: mode snapshot first, capture's `ui` overrides on top. See [Capture & Replay → presentation resolution](capture_and_replay.md#presentation-resolution).

---

## Step 3: The App Renders the Viewer

Example:

```tsx
function ProductPage() {
  // Build the input object directly inside useMemo (see Step 2 for the shape).
  // The App's role here is purely structural — packaging captured intent into
  // the contract shape — so there's no helper layer between App and Viewer.
  const viewerInput = useMemo(() => ({ /* …shape from Step 2… */ }), [appState])

  const viewerOutput = useMemo(() => ({
    onViewerReady: handleViewerReady,
    onSectionCaptured: handleSectionCaptured,
    onSectionCaptureCleared: handleSectionCaptureCleared,
    onOptionCaptured: handleOptionCaptured,
    onOptionCaptureCleared: handleOptionCaptureCleared,
    onMaterialDefaultsCaptured: handleMaterialDefaultsCaptured,
    onMaterialDefaultsCleared: handleMaterialDefaultsCleared,
    onViewCaptured: handleViewCaptured,
    onPresentationModeCaptured: handlePresentationModeCaptured,
    onGeometryPicked: handleGeometryPicked,
    onRenderCaptured: (event) => {
      if (event?.blob) {
        batchBlobsRef.current.push({ metadata: event.metadata, blob: event.blob })
      }
    },
    onBatchCaptureComplete: () => {
      batchBlobsRef.current.forEach(({ metadata, blob }) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${metadata?.sectionLabel ?? 'section'}.jpg`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      })
      batchBlobsRef.current = []
    },
    onError: handleViewerError,
  }), [])

  return (
    <Viewer
      input={viewerInput}
      output={viewerOutput}
    />
  )
}
```

That is the main integration pattern.

---

## Step 4: User Interactions

When the user clicks a section tab or changes an option, the App updates its own state, sets `activeAuthoringFocus` to `'section'` or `'option'` so the Authoring Panel adapts, rebuilds `viewerInput`, and re-renders. The Viewer reacts to the changed input.

Option changes specifically pass two flat lists to `scene.visibilityAssignments`:

- `hiddenGeometryIds` — every geometry ID owned by every option in the section
- `shownGeometryIds` — geometry IDs from the currently active option

The Viewer resolves show vs hide internally (show wins); the App never computes a set difference.

```ts
scene: {
  visibilityAssignments: {
    hiddenGeometryIds: allOptionGeometryIds,
    shownGeometryIds: activeOptionGeometryIds,
    instantHiddenGeometryIds: sectionCapture?.visibilityAssignments?.hiddenGeometryIds,
  },
  materialAssignments: activeOptionCapture?.materialAssignments ?? [],
  defaultMaterialAssignments: appState.modelDefaultCapture?.defaultMaterialAssignments,
}
```

`instantHiddenGeometryIds` is used for section-level hides because they happen during the section transition — there is no benefit from a fade animation in that context.

---

## Step 5: Admin Captures a Section Presentation

In admin mode, an admin may:

- move the camera
- tune presentation
- hide some geometry
- click "Section Capture"

The Viewer fires:

- `onSectionCaptured(payload)`

The App should store that payload keyed by the active section ID.

Example:

```ts
function handleSectionCaptured(payload) {
  setAppState((prev) => ({
    ...prev,
    sectionCaptures: {
      ...prev.sectionCaptures,
      [prev.activeSectionId]: payload,
    },
  }))
}
```

The payload includes `pose`, `cameraMode`, `presentationMode`, `visibilityAssignments`, and `ui`. These are replayed by passing them back into `viewerInput` when the section is activated — the App resolves `presentationModeCaptures[payload.presentationMode]` to a full presentation snapshot, then spreads `payload.ui` on top so the capture's UI visibility flags take precedence over the mode snapshot's flags.

In plain language:

- the Viewer tells The App what was captured
- The App decides how and where to store it

---

## Step 6: Admin Picks Geometry

When geometry is picked, the Viewer fires `onGeometryPicked(event)`. The App can use that for authoring mappings, debugging, or admin UI feedback. The full event shape is in [viewer_contract_v1_7.md](viewer_contract_v1_7.md#viewergeometrypickedevent).

---

## Step 7: The App Triggers Batch Image Capture

When the user clicks "Complete Build", the App builds one item per section that has a captured pose and increments `batchCapture.nonce` to start the render sequence.

```ts
// When "Complete Build" is clicked:
const items = sections
  .filter((s) => sectionCaptures[s.id]?.pose)
  .map((s) => ({
    metadata: { sectionId: s.id, sectionLabel: s.label },
    camera: { pose: sectionCaptures[s.id].pose, cameraMode: sectionCaptures[s.id].cameraMode },
    scene: {
      visibilityAssignments: {
        hiddenGeometryIds: sectionCaptures[s.id].visibilityAssignments?.hiddenGeometryIds ?? [],
        shownGeometryIds: activeOptionGeometryIdsForSection(s.id),
        instantHiddenGeometryIds: [],
      },
    },
    presentation: presentationModeCaptures[sectionCaptures[s.id].presentationMode],
  }))

// Increment nonce in viewerInput to start the batch:
setViewerInput((prev) => ({
  ...prev,
  admin: {
    ...prev.admin,
    batchCapture: { nonce: (prev.admin?.batchCapture?.nonce ?? 0) + 1, items },
  },
}))
```

The Viewer detects the nonce change and begins processing each item in sequence:

1. Snaps the camera to the item's pose
2. Waits 1500ms for materials and shadows to settle
3. Captures a 3840×2160 JPEG off-screen
4. Fires `onRenderCaptured({ imageUrl, blob, metadata })` — the App accumulates the blob

When all items are done, the Viewer fires `onBatchCaptureComplete`. At that point the App triggers downloads, one per accumulated blob. The `metadata.sectionLabel` the App placed in each item is used to name the download file.

---

## Step 8: Persistence and Replay

The App owns persistence — capture payloads belong wherever the App stores them (backend, browser, file). Replay is straightforward: when loading a saved design, the App reconstructs `viewerInput` from stored values and passes it to `Viewer`. The Viewer reacts to the changed input. There is no "ask the Viewer to remember" path — the App is always the source of truth.

DemoApp persists to browser `localStorage` keyed by model ID (`demoapp_v2_${modelId}`); a production App would persist to its backend.

---

## A Full End-to-End Example

[DemoApp.jsx](../src/DemoApp/DemoApp.jsx) is the canonical end-to-end example. It implements every callback in the contract, persists per-model snapshots to `localStorage`, enforces cross-section ownership, runs the batch render flow, and is the reference any future CustomApp should mirror. Read it alongside this walkthrough — the structural shape is exactly what Steps 1–8 above describe.

A few handlers in DemoApp show patterns that are easy to miss from the contract reference alone and are worth a closer look:

### Option capture — conflict gate + additive merge

The recommended `onOptionCaptured` flow lives at [DemoApp.jsx:753-778](../src/DemoApp/DemoApp.jsx#L753-L778):

1. Run `findOptionCaptureConflicts` ([DemoApp.jsx:113-132](../src/DemoApp/DemoApp.jsx#L113-L132), with the per-id helper at [DemoApp.jsx:91-111](../src/DemoApp/DemoApp.jsx#L91-L111)) to enforce the two cross-section ownership rules independently.
2. If either rule fires, store the conflict for the banner and **do not store the payload**.
3. Otherwise call `mergeOptionCapture(existing, payload)` ([DemoApp.jsx:310-327](../src/DemoApp/DemoApp.jsx#L310-L327)), which unions geometry IDs and lets incoming material assignments win per `geometryId`.

Two captures into the same option therefore **accumulate** by design. To replace the payload from scratch, click *Option Clear* first and then capture again.

### Space-tile walk activation

`onSpaceTileWalkActivated` ([DemoApp.jsx:810-812](../src/DemoApp/DemoApp.jsx#L810-L812)) just records the captured `cameraMode` in App state. The `viewerInput` builder reads it and applies the matching `viewCaptures[mode]` payload's presentation and visibility — but does **not** override `camera.pose`, since the Viewer is already navigating via pathNav. See the derivation block at [DemoApp.jsx:886-916](../src/DemoApp/DemoApp.jsx#L886-L916).

### Active presentation mode — argument intentionally ignored

`onActivePresentationModeChanged` ([DemoApp.jsx:824-832](../src/DemoApp/DemoApp.jsx#L824-L832)) intentionally drops the `mode` argument it receives. The active presentation mode lives entirely in the Viewer (it owns mode selection); the App listens to this callback only to update `activeAuthoringFocus = 'presentationMode'` so the dynamic Authoring Panel filters to mode-relevant controls. If a future App needs to persist the active mode itself, that's the place to read the arg.

### Batch render flow

`onRenderCaptured` ([DemoApp.jsx:833-837](../src/DemoApp/DemoApp.jsx#L833-L837)) accumulates JPEG blobs in a `useRef` array as each item completes. `onBatchCaptureComplete` ([DemoApp.jsx:838-855](../src/DemoApp/DemoApp.jsx#L838-L855)) then composites a footer overlay (`compositeInfoOverlay` at [DemoApp.jsx:22-76](../src/DemoApp/DemoApp.jsx#L22-L76)) onto each blob and triggers downloads. The trigger is the `admin.batchCapture.nonce` increment in `handleCaptureSectionRenderings` ([DemoApp.jsx:920-956](../src/DemoApp/DemoApp.jsx#L920-L956)) — the Viewer detects the bump and processes the items in sequence.

---

## What The App Should Avoid

### Do not reach into `ViewerRoot`

The App should depend on:

- `Viewer`

not:

- `ViewerRoot`

### Do not build business rules into the Viewer

The Viewer should not become the source of truth for:

- valid options
- pricing
- persistence
- saved product meaning

### Do not rely on Viewer-internal implementation details as the long-term contract

The Viewer's internal hooks and bridges are implementation details.

Always integrate through `Viewer` with `input` and `output` only.

---

## Short Summary

The practical workflow is:

1. The App owns the important state
2. The App translates that state into `viewerInput`
3. The App passes `viewerInput` into `Viewer`
4. The Viewer renders it
5. The Viewer emits events
6. The App saves what matters
7. When ready, the App increments `admin.batchCapture.nonce` to trigger batch image capture — the Viewer renders one JPEG per item and delivers them via `onRenderCaptured` / `onBatchCaptureComplete`

That is the cleanest way to integrate The App with The Viewer.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
