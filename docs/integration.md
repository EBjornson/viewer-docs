# Integration Guide

**Primary reader:** App-side developer integrating the Viewer into a host App
**Job-to-be-done:** Get the Viewer mounted, push input, handle output, and implement the patterns a real host App needs (section replay, option visibility, cross-section ownership, batch capture, persistence).
**Next doc:** [Capture & Replay](capture_and_replay.md) for the lifecycle deep-dive · [Viewer Contract](viewer_contract_v1_8.md) for type-level reference · [DemoApp](demoapp.md) for the reference host App in this repo.

---

## Purpose

How a host App integrates the Viewer end-to-end — what to push in via `input`, what comes back via `output`, and the patterns a real host App needs to implement around them. [DemoApp.jsx](https://github.com/EBjornson/BPViewer/blob/main/src/DemoApp/DemoApp.jsx) is the canonical reference implementation; it covers every touch point in this guide.

> **Core principle:** the App tells the Viewer what to render; the Viewer fires events when something useful happens. The App owns persisted intent and all identity. The Viewer owns runtime execution.

---

## Delivery

The Viewer ships as a self-contained ESM bundle on jsDelivr. Loading the bundle auto-registers a `<viewer-element>` custom element that any host framework can mount.

### Bundle URL

```
https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1.1.0/viewer.js
```

The bundle includes React, Three.js, and `@react-three/fiber` internally — the host App does not need to install or supply them. A bundle on a `v1` URL never breaks; major releases ship at new URLs (`@v2`, etc.).

**Pinning policy.** `@v1.1.0` is forever-immutable. `@v1` floats to the latest `v1.x.y` tag — useful for opt-in auto-upgrade on patch/minor releases. Pick whichever matches your update appetite.

### Default assets (HDRIs, terrain textures, material textures)

```
https://cdn.jsdelivr.net/gh/EBjornson/viewer-assets@v1
```

Bundled defaults reference this CDN directly. Your App only needs to host model `.glb` files itself; HDRIs and textures resolve cross-origin from this URL.

### Vue 3

```html
<!-- index.html -->
<script type="module" src="https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1.1.0/viewer.js"></script>
```

```vue
<template>
  <viewer-element ref="viewerRef" style="width: 100%; height: 100%" />
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const viewerRef = ref(null)
const viewerInput = ref({
  model: { modelUrl: '/models/your-product.glb' },
  // … see "Building Viewer Input" below
})

onMounted(() => {
  viewerRef.value.input = viewerInput.value
  viewerRef.value.addEventListener('viewerready', (e) => {
    console.log('Viewer ready:', e.detail)
  })
})

watch(viewerInput, (next) => {
  viewerRef.value.input = next
}, { deep: true })
</script>
```

### Vanilla JS

```html
<!doctype html>
<html>
  <body>
    <viewer-element id="viewer" style="display: block; width: 100%; height: 600px"></viewer-element>

    <script type="module">
      import 'https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1.1.0/viewer.js'

      const el = document.getElementById('viewer')
      el.input = { model: { modelUrl: '/models/your-product.glb' } }
      el.addEventListener('viewerready', (e) => console.log('Ready:', e.detail))
    </script>
  </body>
</html>
```

### React (alternative)

For React hosts that prefer JSX, the bundle also exports `Viewer` as a React component:

```jsx
import { Viewer } from 'https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1.1.0/viewer.js'

function App() {
  return <Viewer input={viewerInput} output={viewerOutput} />
}
```

The rest of this guide is written against the React `<Viewer>` surface (`input` prop, `output` prop). Custom-element hosts use the same payload shapes; only the wiring is different — DOM property in place of `input`, DOM events in place of each `output.on…` callback.

### Custom element event names

The Viewer's React `output` callbacks become DOM events on `<viewer-element>`. Naming convention: drop the `on` prefix, lowercase the rest. Exception: `onError` → `viewererror` (avoids the native DOM `error` event).

| React callback | Custom element event |
|---|---|
| `onViewerReady` | `viewerready` |
| `onError` | `viewererror` |
| `onSectionCaptured` | `sectioncaptured` |
| `onSectionCaptureCleared` | `sectioncapturecleared` |
| `onOptionCaptured` | `optioncaptured` |
| `onOptionCaptureCleared` | `optioncapturecleared` |
| `onMaterialDefaultsCaptured` | `materialdefaultscaptured` |
| `onMaterialDefaultsCleared` | `materialdefaultscleared` |
| `onPresentationModeCaptured` | `presentationmodecaptured` |
| `onPresentationModeCaptureCleared` | `presentationmodecapturecleared` |
| `onRenderCaptured` | `rendercaptured` |
| `onBatchCaptureComplete` | `batchcapturecomplete` |

Each event's `.detail` carries the same payload the corresponding React callback would receive.

### Source-import path (development only)

This repo's own DemoApp imports `Viewer` from source for fast HMR during development. External integrators should always use the CDN URL — source imports require this repo's full toolchain.

---

## The Public Integration Surface

The App and the Viewer communicate through a single component:

```tsx
<Viewer input={viewerInput} output={viewerOutput} />
```

The App builds `viewerInput` and provides callbacks in `viewerOutput`. The Viewer renders the input and fires callbacks when something useful happens. **The App does not reach inside the Viewer; the Viewer does not persist state on the App's behalf.**

Public surface: [Viewer.jsx](https://github.com/EBjornson/BPViewer/blob/main/src/public/Viewer.jsx). Code-level contract types: [viewerContractTypes.js](https://github.com/EBjornson/BPViewer/blob/main/src/public/viewerContractTypes.js).

---

## What The App Owns vs What The Viewer Owns

Before the buckets and callbacks, the mental model:

**The App owns:**
- products, sections, options, the option-list-per-section structure
- pricing, compatibility rules, saved configurations
- all stored capture payloads (the Viewer never persists)
- **all identity** for captured payloads — which section, option, or pMode each capture belongs to
- presentation-mode taxonomy and storage (if used)
- option-driven geometry/material resolution (App computes, Viewer renders)

**The Viewer owns:**
- model loading and rendering
- camera playback, animation, and quick views
- visibility / material application
- environment / terrain / solar rendering
- all admin-authoring UI when `admin.enabled = true`
- viewer-local transient state needed for runtime smoothness

The Viewer never owns business meaning, durable product truth, or the identity of captured state.

---

## Building Viewer Input

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

For type-level field reference, see [Viewer Contract](viewer_contract_v1_8.md). This section describes how the App actually constructs each bucket.

A typical App keeps state like this:

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
      { geometryIds: ['wall-geom-1', 'wall-geom-2'], color: '#d4c5a9', roughness: 0.8 },
    ],
  },
  sectionCaptures: {
    section3: {
      pose: { position: [0, 18, 0], target: [0, 0, 0] },
      cameraMode: 'overhead',
      presentation: { /* full embedded snapshot */ },
      visibilityAssignments: { hiddenGeometryIds: ['roof-geom-1'] },
      presentationMode: 'day',  // optional App-side tag for re-skin
    },
  },
  optionCaptures: {
    section3: {
      'Option 1': {
        materialAssignments: [
          { geometryIds: ['solar-geom-1'], color: '#1a1a1a', roughness: 0.65 },
        ],
      },
    },
  },
  presentationModeCaptures: {
    // App-side pMode store; DemoApp uses 6 modes as a convention.
    day: { environmentId: '/hdri/meadow.exr', exposure: 0.6 },
    nightExt: { environmentId: '/hdri/city-night.exr', exposure: 0.3 },
    // … other modes
  },
}
```

The App translates that state into `viewerInput` via a `useMemo` (or framework equivalent) and re-renders when relevant pieces change. Bucket-by-bucket below.

### `model`

```ts
const viewerInput = {
  model: {
    modelUrl: '/models/test.glb',
    productId: 'product-123',
    modelVersion: 'v1',
  },
}
```

- `modelUrl` is the primary model identity. Omit (or pass `undefined`) when no model is selected; the Viewer renders an empty scene.
- `productId` and `modelVersion` are optional App-owned metadata echoed back in `onViewerReady` and capture events.

### `camera`

```ts
camera: {
  cameraMode: 'exterior',         // 'exterior' | 'interior' | 'overhead'
  pose: {
    position: [12, 4, 18],
    target: [0, 1.5, 0],
  },
}
```

- `cameraMode` and `pose` are App-owned presentation intent.
- `pose` carries no FOV — each `cameraMode` has a canonical FOV the Viewer applies at replay.
- For section replay, the App typically pulls these straight from the stored section capture.

### `scene`

Two visibility lists and two material layers:

```ts
scene: {
  visibilityAssignments: {
    hiddenGeometryIds: allOptionGeometryIds,        // every option's geometry IDs (the pool)
    shownGeometryIds: activeOptionGeometryIds,      // currently active option's geometry IDs
    sectionHiddenGeometryIds: sectionCapture?.visibilityAssignments?.hiddenGeometryIds,
    isolatedGeometryIds: null,
  },
  defaultMaterialAssignments: appState.modelDefaultCapture?.defaultMaterialAssignments,
  materialAssignments: activeOptionCapture?.materialAssignments ?? [],
}
```

**Visibility resolution rules:**
- The Viewer resolves show/hide priority — `shownGeometryIds` wins over `hiddenGeometryIds`. The App never computes a set difference.
- `sectionHiddenGeometryIds` is the section-level hide list. Like `hiddenGeometryIds` it fades on transition, but unlike `hiddenGeometryIds` it is **not overridable** by `shownGeometryIds`. Used for section-level hides (typically the roof in overhead views). The Viewer auto-suspends this list during overhead-nav dives — see [Capture & Replay](capture_and_replay.md#overhead-floor-tile-click).
- `shownGeometryIds` + `hiddenGeometryIds` together support **combinatorial ownership** — one option owning a superset of geometry that other options partially overlap (e.g. O4 owns both lights, O2 owns left only, O3 owns right only). The hide/show split handles all combinations without the App needing to understand the geometry relationships. See [Option Visibility](#option-visibility) below.

**Material resolution rules:**
- `defaultMaterialAssignments` is the model-level baseline; applied first.
- `materialAssignments` are option-driven overrides; applied second — they win for any geometry both layers target.
- A `restoreOriginalMaterial: true` entry in `materialAssignments` falls back to the model default for that geometry (or the baked original if no default has been set).
- The App owns both arrays. The Viewer doesn't know about your `modelDefaultCapture` data structure — it only receives the resolved arrays.

### `presentation`

```ts
presentation: {
  environmentId: '/hdri/meadow.exr',
  environmentRotation: 0,
  hdrIntensity: 1,
  backgroundIntensity: 2,
  terrainPresetId: 'ground',
  terrainIntensity: 1,
  exposure: 0.6,
  sunIntensity: 1,
  ambientIntensity: 0.5,
  solar: {
    latitude: 50.4983,
    longitude: -99.914,
    northOffset: 0,
    time: { hour: 14.5, dayOfYear: 172 },
  },
  ui: {
    showSolarSitePanel: true,
    showNorthArrow: true,
    showSpaceMenu: true,
  },
}
```

**Initial-load defaults:** the Viewer has built-in defaults for every `presentation` field. The whole `presentation` field is optional on initial model load. Providing a `presentation` payload is only necessary when the App needs to replay a stored capture or apply a stored pMode snapshot.

**Preserve-on-undefined:** when `input.presentation` is `undefined` (uncaptured-section navigation), the Viewer **preserves its current state** — admin tweaks aren't reset by a navigation that has nothing to push.

**Presentation Mode is App-side.** There is no `viewerInput.presentationModeCaptures` field — pMode storage and routing live entirely on the App side. DemoApp uses a 6-mode taxonomy (`'day'`, `'nightExt'`, `'nightInt'`, `'winterDay'`, `'winterNight'`, `'winterNightInt'`) as a convention; CustomApps may use any taxonomy, fewer modes, or no pMode concept at all. When an admin clicks a pMode pill in DemoApp's header, DemoApp pushes the App-stored snapshot via `viewerInput.presentation` and bumps `selectionKey`.

### `selectionKey`

```ts
selectionKey?: number  // monotonically increasing
```

The App's "selection changed — force fresh apply" signal. Bump on every section selection click and every admin pMode pill click. The Viewer responds in two layers (each gated on the corresponding input being provided):

1. **Camera animation re-fires** from `input.camera.pose` even when its reference identity is unchanged. Handles "user clicks the active section to return to its captured pose after free-navigating."
2. **Presentation re-syncs** from `input.presentation` even when values are identical to current internal state. Handles the case where the Viewer's internal admin presentation state has diverged from what the App last pushed (e.g. admin used the AuthoringPanel's pMode-tab helper buttons that mutate Viewer state without updating App state, then re-clicked an App pill to reload).

When `input.presentation` is `undefined`, the Viewer preserves its current state regardless of `selectionKey` — admin tweaks aren't stomped. **Option clicks should not bump `selectionKey`** — they change material/visibility intent (App pushes via different state), not camera or presentation intent.

### `admin`

```ts
admin: {
  enabled: true,
  batchCapture: {
    nonce: batchNonce,
    items: [
      {
        metadata: { sectionId: 'section1', sectionLabel: 'Roof' },
        camera: { pose: sectionCaptures.section1.pose, cameraMode: sectionCaptures.section1.cameraMode },
        scene: { visibilityAssignments: { hiddenGeometryIds: [...] } },
        presentation: presentationModeCaptures['day'],
      },
    ],
  },
}
```

When `admin.enabled = true`, the Viewer renders its built-in **Authoring Panel** (left-side overlay) containing all capture/clear actions and authoring tools. The panel uses internal Section / Option / pMode tabs for context selection — the App is not involved in driving panel focus. No extra setup required from the App beyond setting `enabled: true`.

Inside the panel, two admin-only helper rows sit above the capture controls:
- **Section tab — View row** (Exterior / Interior / Overhead): camera navigates to the Viewer's default poses.
- **pMode tab — pMode helper buttons** (Summer/Winter × Day/Night, four buttons): loads the Viewer's built-in lighting defaults.

Both are pure Viewer-internal authoring conveniences — no public callbacks. The pMode helper count and labels are **independent** from any host App's pMode taxonomy: helpers seed presentation state, App-side pMode pills route stored captures.

`batchCapture` triggers a programmatic multi-item render sequence — see [Batch Image Capture](#batch-image-capture) below.

---

## Receiving Viewer Output

```ts
const viewerOutput = {
  onViewerReady,
  onSectionCaptured,
  onSectionCaptureCleared,
  onOptionCaptured,
  onOptionCaptureCleared,
  onMaterialDefaultsCaptured,
  onMaterialDefaultsCleared,
  onPresentationModeCaptured,
  onPresentationModeCaptureCleared,
  onRenderCaptured,
  onBatchCaptureComplete,
  onError,
}
```

The App provides callbacks; the Viewer fires them when something useful happens. **The App does not "pull" data out of the Viewer — it receives.**

### `onViewerReady`

Fires once the model is loaded and the Viewer can start working. Payload includes `modelUrl`, `productId`, `modelVersion`, `cameraMode`, and `cameraInfo` (computed fit data: `target`, `size`, `maxDim`, `distance`).

DemoApp surfaces a Loading / Ready badge in its header that reflects this event — useful during integration to verify the readiness payload without opening DevTools.

### Capture callbacks

The primary authoring output events. The Viewer fires them when the admin clicks a capture button. **All capture payloads are identity-free** — the App attaches identity (active section / option / pMode tag) from its own state at receipt.

| Callback | Payload | App action |
|---|---|---|
| `onSectionCaptured(payload)` | `pose` + `cameraMode` + **embedded `presentation` snapshot** + `visibilityAssignments` | Store as `sectionCaptures[activeSectionId]`. Optional: attach an App-side `presentationMode` tag from currently active pMode for re-skin support. |
| `onSectionCaptureCleared()` | — | Clear `sectionCaptures[activeSectionId]`. |
| `onOptionCaptured(payload)` | `geometryIds` + `materialAssignments` | Validate cross-section ownership (see [below](#cross-section-ownership-enforcement)). On no conflict, **merge additively** into `optionCaptures[sectionId][optionId]`: union geometry IDs, incoming wins per geometryId for materials. On conflict, reject the capture and notify the user. |
| `onOptionCaptureCleared()` | — | Clear `optionCaptures[sectionId][optionId]`. |
| `onMaterialDefaultsCaptured(payload)` | model-wide `defaultMaterialAssignments` | Store as `materialDefaultCapture`. |
| `onMaterialDefaultsCleared()` | — | Clear `materialDefaultCapture`. |
| `onPresentationModeCaptured(snapshot)` | bare `ViewerPresentationInput` snapshot | Store as `presentationModeCaptures[currentPMode] = snapshot` (App attaches identity from its own active-pMode state). |
| `onPresentationModeCaptureCleared()` | — | Remove App's currently active pMode entry from `presentationModeCaptures`. |

**Identity-free routing.** DemoApp keeps refs (`selectedSectionIdRef`, `selectedOptionsRef`, `currentPModeRef`) to look up its own current selection state inside the handlers, then attaches the App-side identity (section ID, section+option, pMode key) on receipt and stores accordingly. The Viewer never knows which section, option, or pMode is active — that routing is the App's job.

**Clear callbacks always fire.** Even when the Viewer has no locally-cached capture for the current session, clear callbacks fire unconditionally. Your stored state may hold a capture from a previous session that the Viewer doesn't know about; the unconditional callback lets the App remove any persisted value.

### `onRenderCaptured`

Fires once per item during a batch capture sequence. Payload is `{ imageUrl, blob, metadata }`:

- `blob` — JPEG Blob of the off-screen 3840×2160 render
- `imageUrl` — data URL of the same image, usable directly in `<img>` elements
- `metadata` — whatever object the App placed in the corresponding `ViewerBatchRenderCaptureItem`; use it to correlate the image to its source

The App accumulates blobs (or URLs) as each `onRenderCaptured` fires and acts on the full set when `onBatchCaptureComplete` fires.

### `onBatchCaptureComplete`

Fires after all items in a batch have been captured. Use this signal to trigger downloads, backend uploads, or any post-batch processing.

```ts
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
```

### `onError`

Notifies the App when the Viewer encounters a problem that shouldn't stay invisible. Payload includes `message`, `code`, and `details`. DemoApp surfaces it as a dismissible red banner overlaid on the viewer panel.

---

## Section Replay

The most important flow in the entire integration. When the user activates a section, the App rebuilds `viewerInput` from the stored section capture and passes it back. The Viewer reacts to the changed input.

Since section captures embed the **full presentation snapshot**, replay is self-contained — no external lookup required. There are two strategies:

### Strategy A — Frozen-at-author-time (no pMode storage)

```js
const capture = sectionCaptures[activeSectionId]
const viewerInput = {
  model: { modelUrl },
  camera: { cameraMode: capture?.cameraMode, pose: capture?.pose },
  presentation: capture?.presentation,  // embedded snapshot replays verbatim
  scene: {
    visibilityAssignments: { ...optionVisibility, ...capture?.visibilityAssignments },
    materialAssignments: mergedActiveOptionMaterials,
    defaultMaterialAssignments: materialDefaults?.defaultMaterialAssignments,
  },
  admin: { enabled: adminMode },
  selectionKey: bumpedKey,
}
```

CustomApps without a pMode taxonomy use this path automatically — there's nothing else to resolve against.

### Strategy B — Re-skin via pMode lookup (DemoApp default)

```js
const capture = sectionCaptures[activeSectionId]
const presentation =
  presentationModeCaptures?.[capture?.presentationMode] ?? capture?.presentation
const viewerInput = {
  // …same as Strategy A, but with the resolved `presentation` above
  presentation,
}
```

The App-side `presentationModeCaptures` lookup wins when a pMode store entry exists for the section's tag — so updating one pMode automatically propagates to all sections that share it ("re-skin" semantics). The embedded snapshot serves as the fallback when the lookup misses.

DemoApp uses Strategy B by default. Sections needing per-section variation should be tagged with their own dedicated pMode rather than diverging from a shared one — this keeps the App's structure consistent and avoids accidental drift.

### Bumping `selectionKey` on section clicks

Bump `selectionKey` on every section selection click (and every admin pMode pill click) so the Viewer animates the camera even when the pose reference is identical to the previous render and re-syncs presentation even when values match. Option clicks should not bump — they change material/visibility intent, not camera or presentation intent.

For the full lifecycle of every capture family — payload shapes, replay paths, identity-free routing, Admin vs User Mode rendering — see [Capture & Replay](capture_and_replay.md).

---

## Option Visibility

When the App drives option-based geometry visibility, it passes two flat lists:

- `hiddenGeometryIds` — every geometry ID owned by every option in the section (the full pool)
- `shownGeometryIds` — geometry IDs owned by the currently active option

The Viewer's rule: **show list wins over hide list**. The App never computes a set difference — it collects and passes; the Viewer resolves.

```ts
scene: {
  visibilityAssignments: {
    hiddenGeometryIds: allOptionGeometryIds,
    shownGeometryIds: activeOptionGeometryIds,
    sectionHiddenGeometryIds: sectionCapture?.visibilityAssignments?.hiddenGeometryIds,
  },
  materialAssignments: activeOptionCapture?.materialAssignments ?? [],
  defaultMaterialAssignments: appState.modelDefaultCapture?.defaultMaterialAssignments,
}
```

This pattern supports **combinatorial ownership**: one option owns a superset of geometry that other options partially overlap (e.g. O4 owns both lights, O2 owns left only, O3 owns right only). The hide/show split handles all combinations without the App needing to understand the geometry relationships.

`sectionHiddenGeometryIds` is the right field for section-level geometry hides. Like `hiddenGeometryIds` it fades on transition (so the roof fades in / out gracefully alongside the camera animation), but unlike `hiddenGeometryIds` it is not overridable by `shownGeometryIds` — so it survives even when an option's `shownGeometryIds` happens to overlap the same geometry. The Viewer also auto-suspends this list during overhead-nav floor-tile / Rooms-panel dives.

---

## Cross-Section Ownership Enforcement

The App is responsible for enforcing two **independent** rules to keep replay deterministic:

1. **Show/hide geometry rule:** a geometry item may appear in the show/hide list (`geometryIds`) of multiple options within the same section, but cannot appear in show/hide lists of options across multiple different sections.
2. **Material assignment rule:** a geometry item can be targeted by material assignments from only one section. If section A's option assigns a material to geometry G, no option in any other section can assign a material to G.

The rules are intentionally independent. The same geometry **may** be in section A's show/hide list **and** section B's material assignments simultaneously — that combination is allowed because each rule individually still holds.

Enforcement is at the App layer because section identity is App-owned; the Viewer fires `onOptionCaptured` with no section context. The Viewer is intentionally agnostic to which section/option the admin had selected when the capture button was pressed — that routing is the App's job, and so is validating the routing.

### Recommended pattern

In the `onOptionCaptured` handler, scan the existing `optionCaptures` map separately for each rule. Reject if either rule is violated.

```js
function findOptionCaptureConflicts(optionCaptures, activeSectionId, payload) {
  const geometry = []
  // Rule 1: incoming show/hide list vs other sections' show/hide lists
  payload.geometryIds?.forEach((id) => {
    for (const sectionId of Object.keys(optionCaptures)) {
      if (sectionId === activeSectionId) continue
      for (const optionId of Object.keys(optionCaptures[sectionId] ?? {})) {
        if (optionCaptures[sectionId][optionId]?.geometryIds?.includes(id)) {
          geometry.push({ id, sectionId, optionId })
        }
      }
    }
  })

  const material = []
  // Rule 2: incoming material targets vs other sections' material targets
  const materialTargets = new Set()
  payload.materialAssignments?.forEach((a) => {
    a.geometryIds?.forEach((id) => { if (id) materialTargets.add(id) })
  })
  materialTargets.forEach((id) => {
    for (const sectionId of Object.keys(optionCaptures)) {
      if (sectionId === activeSectionId) continue
      for (const optionId of Object.keys(optionCaptures[sectionId] ?? {})) {
        const owned = optionCaptures[sectionId][optionId]?.materialAssignments?.some(
          (a) => a.geometryIds?.includes(id)
        )
        if (owned) material.push({ id, sectionId, optionId })
      }
    }
  })

  return { geometry, material }
}

onOptionCaptured: (payload) => {
  const conflicts = findOptionCaptureConflicts(optionCaptures, activeSectionId, payload)
  if (conflicts.geometry.length || conflicts.material.length) {
    setCaptureConflict({ activeSectionId, activeOptionId, conflicts })
    return  // do not merge
  }
  setOptionCaptures((prev) => ({
    ...prev,
    [activeSectionId]: {
      ...prev[activeSectionId],
      [activeOptionId]: mergeOptionCapture(prev[activeSectionId]?.[activeOptionId], payload),
    },
  }))
}
```

The two checks are intentionally separate. An incoming material-only payload (no `geometryIds`) only triggers the material rule. An incoming show/hide-only payload only triggers the show/hide rule. A payload that captures both kinds of intent at once is checked against both rules independently.

### Capture Material Only

The Viewer's authoring overlay exposes a **Capture Material Only** button alongside the standard **Option Capture** button. Capture Material Only fires `onOptionCaptured` with `materialAssignments` only — no `geometryIds` — letting the admin route material-only intent without inadvertently claiming show/hide ownership of the selected geometry. This makes the cross-section material assignment workflow (option in section B colors geometry already show/hide-owned by section A) a single-click operation that doesn't trip Rule 1.

### Notifying the user

DemoApp uses a red banner overlaid on the viewer panel that names the conflicting geometry IDs and the owning section/option, distinguishing show/hide conflicts from material conflicts:

> *Capture rejected — cross-section ownership conflict.*
> *Already in show/hide list of **Section 1 / Option 2**: G_roof_01, G_roof_02.*
> *Clear that capture first, or pick different geometry.*

A separate amber banner surfaces pre-existing cross-section violations from persisted state on load (e.g. localStorage snapshots from before enforcement existed), grouped into "show/hide ownership" and "material assignment ownership" sections so the admin can address each kind separately.

### No contract change required

The Viewer continues to fire `onOptionCaptured` exactly as before — rejection is purely an App-layer policy decision. There is no `onOptionCaptureRejected` callback in the current contract; the Viewer's draft material assignments are cleared synchronously after firing the callback regardless of whether the App ultimately stores the capture. For a material-only conflict this means the user briefly sees painted-but-uncaptured material edits revert on the next render rebuild — a minor flicker. If the friction proves significant in practice, a small contract addition (an `onOptionCaptureRejected` callback so the Viewer can defer draft clearing) would be the natural follow-up.

---

## Batch Image Capture

A programmatic multi-item render sequence that produces one JPEG per item. Triggered by the App when (e.g.) the user clicks "Complete Build."

The flow:

1. The App constructs a list of `ViewerBatchRenderCaptureItem` entries — one per section to render, each carrying camera pose, scene visibility, and presentation.
2. The App writes `admin.batchCapture = { nonce: <incremented>, items }` into `viewerInput`. **Incrementing the nonce is the trigger signal.**
3. The Viewer detects the nonce change and processes items in sequence: snaps the camera, waits 1500ms for materials and shadows to settle, then captures a 3840×2160 JPEG off-screen.
4. After each capture the Viewer fires `onRenderCaptured({ imageUrl, blob, metadata })`. The App accumulates the blobs.
5. When all items are done, the Viewer fires `onBatchCaptureComplete`. The App uses this signal to trigger downloads or backend storage.

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
        sectionHiddenGeometryIds: [],
      },
    },
    presentation: presentationModeCaptures?.[sectionCaptures[s.id].presentationMode]
      ?? sectionCaptures[s.id].presentation,
  }))

setViewerInput((prev) => ({
  ...prev,
  admin: {
    ...prev.admin,
    batchCapture: { nonce: (prev.admin?.batchCapture?.nonce ?? 0) + 1, items },
  },
}))
```

Admin overlays and debug helpers are automatically hidden during capture so they don't appear in rendered images.

---

## Persistence

The App owns persistence — capture payloads belong wherever the App stores them (backend, browser, file). Replay is straightforward: when loading a saved design, the App reconstructs `viewerInput` from stored values and passes it to `<Viewer>`. The Viewer reacts to the changed input. **There is no "ask the Viewer to remember" path — the App is always the source of truth.**

DemoApp persists per-model snapshots to browser `localStorage` keyed by model ID (`demoapp_v3_${modelId}`); a production CustomApp would persist to its backend instead, but the data shapes are the same. See [DemoApp → Persistence](demoapp.md#persistence) for the snapshot contents.

---

## A Full End-to-End Example

[DemoApp.jsx](https://github.com/EBjornson/BPViewer/blob/main/src/DemoApp/DemoApp.jsx) is the canonical end-to-end example. It implements every callback in the contract, persists per-model snapshots to `localStorage`, enforces cross-section ownership, runs the batch render flow, and is the reference any future CustomApp can mirror.

A few patterns in DemoApp are easy to miss from the type-level reference alone and worth a closer look:

**Identity-free capture routing.** All capture callbacks fire identity-free payloads. DemoApp routes by reading its own current selection state in the handlers — `selectedSectionIdRef`, `selectedOptionsRef`, and `currentPModeRef` (the App's sticky "currently active pMode" tracker, updated on pMode pill clicks and section selection from the section's pMode tag). The handlers attach the App-side identity on receipt and store accordingly.

**Section capture — App-side pMode tagging.** `onSectionCaptured` payload includes the embedded presentation snapshot but no pMode reference. DemoApp attaches `presentationMode: currentPModeRef.current` as App metadata when storing — enabling the optional re-skin replay path later. CustomApps that don't care about re-skin can skip the tag entirely; the embedded snapshot replays cleanly on its own.

**Option capture — conflict gate + additive merge.** The recommended `onOptionCaptured` flow:

1. Run `findOptionCaptureConflicts` to enforce the two cross-section ownership rules independently.
2. If either rule fires, store the conflict for the banner and **do not store the payload**.
3. Otherwise call `mergeOptionCapture(existing, payload)` — unions geometry IDs and lets incoming material assignments win per `geometryId`.

Two captures into the same option therefore **accumulate** by design. To replace the payload from scratch, click *Option Clear* first and then capture again.

**pMode pill click — App-side state update.** When admin clicks a pMode pill in DemoApp's header, `handlePModePillClick` sets `activePMode` (transient — cleared on next section click), updates `currentPModeRef.current` (sticky), and bumps `selectionKey`. The next render's `viewerInput` pushes `presentationModeCaptures[activePMode]` as `presentation`. The selectionKey bump ensures the Viewer's presentation hook re-syncs even when values match the previous push.

**Batch render flow.** `onRenderCaptured` accumulates JPEG blobs in a `useRef` array as each item completes. `onBatchCaptureComplete` composites a footer overlay onto each blob and triggers downloads. The trigger is the `admin.batchCapture.nonce` increment in `handleCaptureSectionRenderings` — the Viewer detects the bump and processes the items in sequence.

For the DemoApp header UI, the Loading/Ready badge, capture status pills, and payload-inspector tooltips, see [DemoApp](demoapp.md).

---

## What The App Should Not Do

### 1. Do not reach into `ViewerRoot`

The App should depend on `Viewer`, not `ViewerRoot`. `ViewerRoot` is an internal implementation boundary and changes freely.

### 2. Do not rely on Viewer-internal implementation details

The Viewer's internal hooks, bridges, and state stores are implementation details. The App should only interact through `input` and `output` on `<Viewer>`. Anything below that surface is not part of the host-app contract.

### 3. Do not ask the Viewer to own business rules

The Viewer should never become the source of truth for which option is valid, what the product means, what pricing should be, or what should be persisted. Those decisions belong to the App.

---

## Summary

The practical workflow:

1. The App owns the important state (sections, options, captures, label renames, persistence)
2. The App translates that state into `viewerInput` (`model`, `camera`, `scene`, `presentation`, `admin` + `selectionKey`)
3. The App passes `viewerInput` into `<Viewer>` and provides `viewerOutput` callbacks
4. The Viewer renders and emits identity-free capture payloads
5. The App attaches identity and stores
6. The App rebuilds `viewerInput` from stored state on section/option changes — Viewer reacts
7. When the App wants section renders, it increments `admin.batchCapture.nonce` — Viewer renders one JPEG per item

The integration boundary is exactly `<Viewer input={viewerInput} output={viewerOutput} />`. Anything below that surface is internal and may change.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
