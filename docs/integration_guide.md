# How a Host App Talks to the Viewer

**Primary reader:** App-side developer
**Job-to-be-done:** Wire the Viewer into a host App
**Next doc:** [Integration Walkthrough](integration_walkthrough.md)

---

## Purpose

How a host App integrates `Viewer` — what to push in via `input`, what comes back via `output`, and which parts are stable vs. internal. Use [DemoApp.jsx](../src/DemoApp/DemoApp.jsx) as the reference integration; it covers every touch point in this guide.

> **Core principle:** the App tells the Viewer what to render; the Viewer fires events when something useful happens. Nothing more.

---

## Delivery

The Viewer ships as a self-contained ESM bundle on jsDelivr. Loading the bundle auto-registers a `<viewer-element>` custom element that any host framework can mount.

### Bundle URL

```
https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1.0.0/viewer.js
```

The bundle includes React, Three.js, and `@react-three/fiber` internally — the host App does not need to install or supply them. A bundle on a v1 URL never breaks; major releases ship at new URLs (`@v2`, etc.).

**Pinning policy.** `@v1.0.0` is forever-immutable. `@v1` floats to the latest `v1.x.y` tag — useful for opt-in auto-upgrade on patch/minor releases. Pick whichever matches your update appetite.

### Default assets (HDRIs, terrain textures, material textures)

```
https://cdn.jsdelivr.net/gh/EBjornson/viewer-assets@v1
```

Bundled defaults reference this CDN directly. Your App only needs to host model `.glb` files itself; HDRIs and textures resolve cross-origin from this URL.

### Vue 3

```html
<!-- index.html -->
<script type="module" src="https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1.0.0/viewer.js"></script>
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
  // … see "How The App Pushes Information Into The Viewer" below
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
      import 'https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1.0.0/viewer.js'

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
import { Viewer } from 'https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1.0.0/viewer.js'

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
| `onViewCaptured` | `viewcaptured` |
| `onViewCaptureCleared` | `viewcapturecleared` |
| `onViewSelected` | `viewselected` |
| `onSpaceTileWalkActivated` | `spacetilewalkactivated` |
| `onPresentationModeCaptured` | `presentationmodecaptured` |
| `onPresentationModeCaptureCleared` | `presentationmodecapturecleared` |
| `onActivePresentationModeChanged` | `activepresentationmodechanged` |
| `onGeometryPicked` | `geometrypicked` |
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

The App builds `viewerInput` and provides callbacks in `viewerOutput`. The Viewer renders the input and fires callbacks when something useful happens. The App does not reach inside the Viewer; the Viewer does not persist state on the App's behalf.

Public surface: [Viewer.jsx](../src/public/Viewer.jsx). Code-level contract types: [viewerContractTypes.js](../src/public/viewerContractTypes.js).

---

## How The App Pushes Information Into The Viewer

The App pushes information in by building a `viewerInput` object and passing it to:

```tsx
<Viewer input={viewerInput} ... />
```

That input is divided into a few buckets.

### 1. `model`

This tells the Viewer which 3D model to load.

Example:

```ts
const viewerInput = {
  model: {
    modelUrl: '/models/test.glb',
    productId: 'product-123',
    modelVersion: 'v1',
  },
}
```

Think of this as:

- “Here is the product model you should show.”

### 2. `camera`

This tells the Viewer how you want the camera presented.

Example:

```ts
camera: {
  cameraMode: 'exterior',
  pose: {
    position: [12, 4, 18],
    target: [0, 1.5, 0],
  },
}
```

Think of this as:

- “Please show this model from this general camera mode”
- “Please animate or move the camera to this pose”

Important:

- The App owns this **intent**
- The Viewer owns the actual runtime execution of that motion
- When the user presses a View button in User Mode, the Viewer fires `onViewSelected(cameraMode)`. The App looks up its stored view capture for that slot and replays it by rebuilding `viewerInput` with the capture's `pose`, `cameraMode`, and `visibilityAssignments`, plus the resolved presentation snapshot (`presentationModeCaptures[capture.presentationMode]`) with `capture.ui` spread on top — the same path as section replay.
- When the admin captures a view, the Viewer fires `onViewCaptured(payload)`. The App stores the payload keyed by camera mode.

### 3. `scene`

This tells the Viewer what geometry/material state to apply.

Example:

```ts
scene: {
  visibilityAssignments: {
    hiddenGeometryIds: ['geom-101', 'geom-202'],  // hide these (fade)
    shownGeometryIds: ['geom-202'],               // show these even if in hiddenGeometryIds
    isolatedGeometryIds: null,
  },
  defaultMaterialAssignments: [
    {
      geometryIds: ['geom-305'],
      color: '#d4c5a9',
      roughness: 0.8,
    },
  ],
  materialAssignments: [
    {
      geometryIds: ['geom-305'],
      color: '#ffffff',
      roughness: 0.7,
      metalness: 0.1,
    },
    {
      geometryIds: ['geom-410'],
      restoreOriginalMaterial: true,
    },
  ],
}
```

Think of this as:

- “Hide these parts” (`hiddenGeometryIds`)
- “Show these parts even if they are in the hide list” (`shownGeometryIds`) — the Viewer resolves the difference; the App never needs to compute a set
- “Isolate or show all” (`isolatedGeometryIds`)
- “Apply these model-level default materials” (`defaultMaterialAssignments`)
- “Apply these option-driven material overrides” (`materialAssignments`)
- “Restore this part to its original material” (or model default, if one was set)

The Viewer merges the two material layers internally:

- `defaultMaterialAssignments` is the model-level baseline, applied first.
- `materialAssignments` are option-driven overrides, applied second — they win for any geometry both layers target.
- A `restoreOriginalMaterial: true` entry in `materialAssignments` falls back to the model default for that geometry (not the baked original) when a default has been set.

Important:

- these are rendering instructions
- they do **not** by themselves explain product business meaning
- the App owns and computes both arrays; the Viewer does not know about your `modelDefaultCapture` data structure

### 4. `presentation`

This tells the Viewer how the scene should feel visually.

Example:

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
    enabled: true,
    latitude: 50.4983,
    longitude: -99.914,
    northOffset: 0,
  },
  ui: {
    showSolarSitePanel: true,
    showNorthArrow: true,
    showPresetViews: true,
    showPresentationPresets: true,
    showWinterPresets: false,
    showSpaceMenu: true,
  },
}
```

Think of this as:

- “Use this environment”
- “Use this lighting”
- “Use this terrain”
- “Use these solar settings”

**Initial load defaults:** all six presentation modes (`'day'`, `'nightExt'`, `'nightInt'`, `'winterDay'`, `'winterNight'`, `'winterNightInt'`) have hardcoded defaults built into the Viewer. The `presentation` field is entirely optional on initial model load — if omitted, the Viewer renders using its built-in defaults. Providing a `presentation` payload is only necessary when the App needs to replay a stored capture.

**`presentationSyncKey`:** A companion field to `presentation`. It is an optional monotonically-increasing counter the App bumps to signal **"App selection changed"** — captured or not. The Viewer interprets a changed value at two layers:

1. **View-button highlight clearing** — fires unconditionally. The Viewer clears any active view-button highlight so the App's section/view selection is the single "active" indicator across both layers.
2. **Presentation re-sync** — fires only when `input.presentation` is provided. When it is, the Viewer re-runs its initialization and resets local admin overrides to match. When `input.presentation` is `undefined` (the active section has no capture), the Viewer **preserves its current state** so authoring tweaks aren't stomped by a navigation that has nothing to replay.

**Bump on every section/view selection change.** The App does not need to gate the bump on capture availability; the Viewer's two-layer interpretation handles both cases correctly. (This is a v1.7 contract change — earlier versions advised gating the bump on capture availability, which has been replaced by the in-Viewer guard.)

**`presentationModeCaptures`:** Map of all presentation-mode captures the App has persisted, keyed by mode id. The Viewer reads it when the user clicks a presentation mode tile inside the Viewer — if a capture exists for that mode, the Viewer applies it; otherwise it falls back to its built-in lighting defaults. The App owns this map; the Viewer only reads. Pass the App's full persisted map (e.g. a `useState`-stored object) every render.

### 5. `admin`

This tells the Viewer whether it should behave in an authoring/admin-friendly way, and can also trigger a programmatic batch render.

Example:

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

Think of this as:

- “We are authoring right now” (`enabled: true`)
- “Render these items as a batch” (`batchCapture`)

When `input.admin.enabled = true`, the Viewer renders its built-in **Authoring Panel** (left-side overlay) containing all capture/clear actions and authoring tools. No extra setup required from the App beyond setting this flag. The Navigation Panel (View row + Summer/Winter presentation mode rows along the bottom) renders identically in admin and user modes and contains no capture controls.

The Authoring Panel is **dynamic by default** — it filters its content based on `input.admin.activeAuthoringFocus`. The App should set this field on every authoring-relevant click so the panel adapts to the current context. See *Dynamic Authoring Panel* below for details.

To trigger a batch render, set `admin.batchCapture = { nonce, items }` and increment `nonce`. Each item supplies the camera pose, scene visibility, and presentation for one render. The Viewer processes the items in sequence and fires `onRenderCaptured` per item, then `onBatchCaptureComplete` when done. Admin overlays are hidden automatically during capture.

The App only needs to implement the `ViewerOutput` capture callbacks to receive and store the payloads the Viewer fires.

---

## How The App Gets Information Back From The Viewer

The App provides callback functions in `viewerOutput`; the Viewer fires them when something useful happens. The App stores or reacts to the payload — the App does not "pull" data out of the Viewer.

```tsx
<Viewer input={viewerInput} output={viewerOutput} />
```

For a complete `viewerOutput` object wired up to App state and persistence, see [Integration Walkthrough](integration_walkthrough.md). The next section enumerates each callback's payload and intended App action.

---

## The Main Viewer Events

### `onViewerReady`

This tells The App:

- the model is ready
- the viewer has enough information to start working

Current payload can include:

- `modelUrl`
- `productId`
- `modelVersion`
- `cameraMode`
- `cameraInfo` — computed fit data: `target`, `size`, `maxDim`, `distance`

This is useful for:

- app awareness
- debugging
- knowing when the viewer is ready for user interaction

**DemoApp implementation:** a Loading / Ready badge in the header reflects this event. It shows "Loading…" until `onViewerReady` fires, then turns green and shows "Ready". Hovering the badge displays the full payload (with a Copy button) so integrators can inspect the event data without opening DevTools. The badge resets on every model switch.

### Capture callbacks

These are the primary authoring output events. The Viewer fires them when the admin clicks a capture button:

| Callback | Payload | App action |
|---|---|---|
| `onSectionCaptured(payload)` | pose + cameraMode + presentationMode + visibilityAssignments + ui | store as `sectionCaptures[activeSectionId]` |
| `onSectionCaptureCleared()` | — | clear `sectionCaptures[activeSectionId]` |
| `onOptionCaptured(payload)` | geometryIds + materialAssignments | Validate cross-section ownership (see *Cross-Section Ownership Enforcement* below). On no conflict, **merge additively** into `optionCaptures[sectionId][optionId]`: union geometry IDs, incoming wins per geometryId for materials. On conflict, reject the capture and notify the user. |
| `onOptionCaptureCleared()` | — | clear `optionCaptures[sectionId][optionId]` |
| `onMaterialDefaultsCaptured(payload)` | model-wide material defaults | store as `materialDefaultCapture` |
| `onMaterialDefaultsCleared()` | — | clear `materialDefaultCapture` |
| `onViewCaptured(payload)` | cameraMode + pose + presentationMode + visibilityAssignments + ui | store as `viewCaptures[payload.cameraMode]` |
| `onViewCaptureCleared(cameraMode)` | — | remove `viewCaptures[cameraMode]` |
| `onViewSelected(cameraMode)` | cameraMode string | In User Mode: look up `viewCaptures[cameraMode]`, resolve `presentationModeCaptures[capture.presentationMode]`, and replay via `viewerInput`. In Admin Mode: callback IS fired (to allow the App to clear section tab highlighting), but the App should NOT trigger camera/presentation replay — the Viewer handles navigation internally. |
| `onSpaceTileWalkActivated(cameraMode)` | cameraMode string | Apply presentation + visibility from `viewCaptures[cameraMode]` (resolving its `presentationMode`); do **not** set camera pose — the Viewer is already navigating via pathNav. Fires in User Mode only. See [Capture & Replay → Overhead Space-Tile Click](capture_and_replay.md#overhead-space-tile-click-spacetileclicknav). |
| `onPresentationModeCaptured(payload)` | `{ mode: string, presentation: ViewerPresentationInput }` | store as `presentationModeCaptures[payload.mode] = payload.presentation` |
| `onActivePresentationModeChanged(mode)` | mode string | track active mode; apply `presentationModeCaptures[mode]` to `input.presentation` if desired |

> **⚠️ `onViewSelected` in Admin Mode:** The Viewer fires `onViewSelected` in both User Mode and Admin Mode. In Admin Mode the Viewer handles view navigation internally and does **not** expect the App to drive a camera or presentation replay in response. Driving replay from the App in Admin Mode would cause a double-animation. Guard any replay logic with a check on `isAdminMode` before acting on this callback.

Replay resolves the captured `presentationMode` name to a full snapshot via `presentationModeCaptures`, spreads the capture's `ui` flags on top of `modeSnapshot.ui` (so per-capture flags override mode-level flags), then writes `pose`, `visibilityAssignments`, and the resolved `presentation` into `viewerInput`. See [Capture & Replay → presentation resolution](capture_and_replay.md#presentation-resolution) for the canonical code.

### `onGeometryPicked`

This tells The App:

- which piece of geometry was selected or picked

Useful for:

- authoring mappings
- admin/debug workflows
- future richer configuration tooling

### `onRenderCaptured`

Fires once per item during a batch capture sequence. The payload is `{ imageUrl, blob, metadata }`:

- `blob` — a JPEG Blob of the off-screen 3840×2160 render
- `imageUrl` — a data URL of the same image, usable directly in `<img>` elements
- `metadata` — whatever object the App placed in the corresponding `ViewerBatchRenderCaptureItem`; use it to correlate the image to its source section or item

The App should accumulate blobs (or URLs) as each `onRenderCaptured` fires and then act on the full set when `onBatchCaptureComplete` fires.

### `onBatchCaptureComplete`

Fires after all items in a batch have been captured. The App should use this signal to trigger downloads, backend uploads, or any other post-batch processing of the accumulated blobs.

Example:

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

This gives The App a way to know:

- something went wrong
- the Viewer encountered an issue that should not stay invisible

Payload includes `message`, `code`, and `details`.

**DemoApp implementation:** a dismissible red banner appears overlaid on the viewer panel showing the error code and message. It clears on dismiss or model switch.

---

## Option Geometry Visibility

When the App drives option-based geometry visibility, it passes two lists:

- `hiddenGeometryIds` — every geometry ID owned by any option in the section (the full pool)
- `shownGeometryIds` — geometry IDs owned by the currently active option

The Viewer's rule: **show list wins over hide list**. The App never computes a set difference — it collects and passes; the Viewer resolves.

```ts
scene: {
  visibilityAssignments: {
    hiddenGeometryIds: allOptionGeometryIds,   // flatMap all options → all their IDs
    shownGeometryIds: activeOptionGeometryIds, // flatMap active option → its IDs
    instantHiddenGeometryIds: sectionCapture?.visibilityAssignments?.hiddenGeometryIds,
  },
}
```

`instantHiddenGeometryIds` is used for section-level geometry here rather than `hiddenGeometryIds` because section-level hides take effect during the camera animation triggered by a section change. There is no benefit from a fade animation in that context — the geometry should disappear immediately as the section loads. Using `instantHiddenGeometryIds` avoids a visible fade artifact during the transition.

This pattern supports **combinatorial ownership** — where one option owns a superset of geometry that other options partially overlap (e.g. O4 owns both lights, O2 owns left only, O3 owns right only). The hide/show split handles all combinations without the App needing to understand the geometry relationships.

---

## Cross-Section Ownership Enforcement

The App is responsible for enforcing two **independent** rules to keep replay deterministic:

1. **Show/hide geometry rule:** a geometry item may appear in the show/hide list (`geometryIds`) of multiple options within the same section, but cannot appear in show/hide lists of options across multiple different sections.
2. **Material assignment rule:** a geometry item can be targeted by material assignments from only one section. If section A's option assigns a material to geometry G, no option in any other section can assign a material to G.

The rules are intentionally independent. The same geometry may be in section A's show/hide list **and** section B's material assignments simultaneously — that combination is allowed because each rule individually still holds.

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

## Dynamic Authoring Panel

The Authoring Panel (left-side overlay rendered when `input.admin.enabled = true`) filters its content based on `input.admin.activeAuthoringFocus`. The App should track the admin's "last clicked" authoring target and pass it through this field so the panel adapts as the admin works.

```ts
type ViewerAuthoringFocus = 'section' | 'option' | 'view' | 'presentationMode' | 'all'
```

| Last admin click | App should set | Panel surfaces |
|---|---|---|
| Section tab (App-side) | `'section'` | Section Capture/Clear, Geometry tools, User Visibility, Camera Mode |
| Option button (App-side) | `'option'` | Option Capture / Material Only / Clear, Material Defaults, Geometry tools, Assembly Inspector, Materials picker |
| View Preset button (Viewer-side, fires `onViewSelected`) | `'view'` | View Capture/Clear, Geometry tools, User Visibility, Camera Mode |
| Presentation Mode button (Viewer-side, fires `onActivePresentationModeChanged`) | `'presentationMode'` | Mode Capture/Clear, User Visibility, Presentation sliders, HDR Environment, Terrain Preset |
| `'all'` or omitted | — | Legacy two-tab fallback, all controls visible |

For Section/Option clicks (which originate in the App), the App tracks state directly. For View/Presentation Mode clicks (which originate in the Viewer), the App listens to the corresponding output callback and updates focus there. DemoApp shows the full pattern:

```js
const [activeAuthoringFocus, setActiveAuthoringFocus] = useState('section')

// Section tab click handler:
onClick={() => { setSelectedSectionId(s.id); setActiveAuthoringFocus('section') }}

// Option button click handler:
onClick={() => { setSelectedOption(o); setActiveAuthoringFocus('option') }}

// Viewer callbacks:
onViewSelected: (cameraMode) => { setActiveAuthoringFocus('view'); /* …existing logic… */ }
onActivePresentationModeChanged: (mode) => { setActiveAuthoringFocus('presentationMode') }

// Threaded into viewerInput:
admin: { enabled: adminEnabled, activeAuthoringFocus }
```

`'all'` (or omitting the field entirely) puts the panel into a legacy two-tab fallback. The Viewer also exposes a debug toggle that overrides any value sent by the App and forces the legacy layout — used for testing only. Production-style apps should always pass a focus value.

---

## What The App Should Not Do

### 1. The App should not rely on `ViewerRoot`

The App should talk to:

- `Viewer`

not directly to:

- `ViewerRoot`

`ViewerRoot` is an internal implementation boundary and should be free to change.

### 2. The App should not rely on Viewer-internal implementation details

The Viewer's internal hooks and bridges are implementation details that can change.

The App should only interact with `Viewer` through:

- `input`
- `output`

Any internal modules below that boundary are not part of the host-app contract.

### 3. The App should not ask the Viewer to own business rules

The Viewer should not be the source of truth for:

- which option is valid
- what the product means
- what pricing should be
- what should be persisted

Those decisions belong to The App.

---

## Summary

- The App pushes instructions through `input` (`model`, `camera`, `scene`, `presentation`, `admin`); the Viewer pushes events back through `output` callbacks. The App does not "pull" — it receives.
- The App owns persisted truth (product structure, option/section logic, pricing, configuration intent).
- The Viewer owns runtime execution (rendering, animation, playback, transient state, authoring helpers).
- The integration boundary is exactly `<Viewer input={viewerInput} output={viewerOutput} />`. Anything below that surface is internal and may change.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
