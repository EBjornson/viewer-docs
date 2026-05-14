# DemoApp Reference

**Primary reader:** App-side developer
**Job-to-be-done:** See what a reference host App looks like and how it surfaces Viewer events
**Next doc:** [Integration Guide](integration.md)

---

## What DemoApp Is

DemoApp is the canonical reference host App in this repo. Source: [DemoApp.jsx](https://github.com/EBjornson/viewer-docs/blob/main/integration-kit/DemoApp.jsx).

It demonstrates the full capture/replay pattern in a minimal host. It is **not** a published API and **not** the production target — pricing, product catalogs, multi-user workflows, backend persistence, and other production concerns are intentionally minimal or absent. **Build & Price** is one planned future host App (a *CustomApp*) that will consume the Viewer; DemoApp is the integration example any future CustomApp can mirror.

It integrates the Viewer through the public contract only:

```jsx
<Viewer input={viewerInput} output={viewerOutput} />
```

All capture payloads are received via `viewerOutput` callbacks. All replay intent flows back in via `viewerInput`. DemoApp does not reach inside the Viewer.

---

## What DemoApp Owns

- demo model selection (manifest models + ad-hoc file upload)
- section and option state, label renames
- capture/replay orchestration for all 3 contract capture families plus App-side pMode storage
- App-side pMode taxonomy (6-mode convention: `'day'` / `'nightExt'` / `'nightInt'` / `'winterDay'` / `'winterNight'` / `'winterNightInt'`) and `currentPModeRef` tracking for identity-free capture routing
- admin mode toggle
- cross-section ownership enforcement (`findOptionCaptureConflicts`)
- per-model persistence in `localStorage` keyed by model ID (`demoapp_v3_${modelId}`)

---

## Header UI

The DemoApp header surfaces a compact set of integrator-facing controls and indicators:

- **Model selector** — dropdown listing manifest models plus an **Upload .glb** button for ad-hoc uploads (uploaded files do not persist).
- **Admin Mode toggle** — flips `input.admin.enabled`. When on, the Viewer renders its built-in Authoring Panel.
- **Reset Model** — clears the entire saved snapshot for the active model (with confirm). Removes section captures, presentation mode captures (App-side), option captures, and material defaults.
- **Complete Build** — triggers batch capture. Blue when at least one section has a captured pose, neutral otherwise. Shows "Capturing…" and is disabled while the batch is in progress. When `onBatchCaptureComplete` fires, DemoApp downloads one JPEG per captured section, named by the section label.
- **Loading / Ready indicator** — status badge that shows "Loading…" until `onViewerReady` fires, then turns green and shows "Ready". Resets on every model switch.
- **pMode pills** — 2 rows of 3 pills (Summer Day / Night / Interior + Winter Day / Night / Interior). Each turns blue when its `presentationModeCaptures[modeKey]` payload exists in App state. **In admin mode, the pills are always live** — clicking sets `currentPMode` and pushes the App-stored snapshot via `viewerInput.presentation`. The currently-active pMode shows a white border ring. **In user mode, the pills are hidden by default**; the opt-in **Visual Override** toggle (below) reveals captured pills as clickable runtime preset switchers. These are the **persistent source of truth** for what pMode is captured — distinct from the session-only highlights inside the Viewer's AuthoringPanel pMode helper buttons. The DemoApp pill set (6 pills) and the AuthoringPanel pMode helper set (4 buttons) are intentionally **independent surfaces**: pills = App-side capture-slot taxonomy; helpers = Viewer-internal lighting-defaults seeders. Counts and labels need not match.
- **Visual Override toggle** — opt-in user-facing switch in the header that exposes the pMode pills in user mode. Hidden when admin mode is on (admin's pills are always live for capture authoring). When off (default), pMode pills are hidden in user mode and section replays use each section's authored presentation. When on, captured pills become clickable; the active pill's snapshot replaces every section's `viewerInput.presentation` and the override **persists across section clicks** (the conceptual model is "show me all sections under this preset"). Camera and visibility still come from the section's capture; only presentation is overridden. Powered by the same [`usePModeResolver`](https://github.com/EBjornson/BPViewer/blob/main/integration-kit/usePModeResolver.js) hook that handles admin authoring — DemoApp's section-click handler skips the hook's `onSectionSelected` call when the override is active, keeping the override locked.
- **Mat. Defaults pill** — read-only indicator (always); blue when `materialDefaultCapture` is stored.

---

## Developer-Oriented Visual Aids

DemoApp deliberately surfaces several aids to help developers integrating the Viewer inspect what the contract actually delivers:

- **Loading / Ready indicator** *(also listed above)* — hovering the badge shows the full `onViewerReady` payload in a floating panel with a Copy button. Lets integrators inspect the readiness event data without opening DevTools.
- **pMode + Mat. Defaults pills** *(also listed above)* — hovering any pill (after a 3-second delay) shows the stored JSON payload in a floating panel with a Copy button. Same pattern is applied to section tabs and option buttons — the payload tooltip surfaces the exact data that flowed back through the corresponding `viewerOutput` callback.
- **Payload inspector tooltips** — the unifying name for the hover-and-copy pattern above. Useful for verifying the shape of any capture payload during integration without instrumenting your own logging.
- **Error banner** — a dismissable red banner overlaid on the viewer panel when `onError` fires, showing the error code and message. Clears on dismiss or model switch.
- **Capture conflict banners** — a red banner when `onOptionCaptured` is rejected by cross-section ownership enforcement (names the conflicting geometry IDs and the owning section/option), and a separate amber banner for pre-existing conflicts surfaced from persisted state on load. See [Cross-Section Ownership Enforcement](integration.md#cross-section-ownership-enforcement) for the rules and the rejection pattern.

The Viewer's own capture indicators (highlighted state on individual capture buttons inside the admin overlay) are session-only and reset on reload — they reflect the current authoring session, not stored state. Use the DemoApp header pills for stored-capture status.

---

## Persistence

- **Storage:** browser `localStorage`.
- **Key:** `demoapp_v3_${modelId}` — one snapshot per model ID.
- **Models that persist:** manifest models (stable model ID).
- **Models that do NOT persist:** ad-hoc uploaded `.glb` files. Reload clears them.

Persisted snapshot contents:

- section captures (`pose`, `cameraMode`, **embedded** `presentation` snapshot, `visibilityAssignments`; plus optional App-side `presentationMode` tag for re-skin support)
- chosen options by section
- option captures (`geometryIds`, `materialAssignments`)
- model default material capture
- presentation mode captures (keyed by mode; full `ViewerPresentationInput` snapshot; six modes: `day` / `nightExt` / `nightInt` / `winterDay` / `winterNight` / `winterNightInt`)
- section/option label renames

(No separate view captures — optionless Sections serve as "view-like" stored moments.)

A production CustomApp would persist these to its backend instead of `localStorage`, but the data shapes are the same.

---

## Common patterns from DemoApp.jsx

The full file is the reference, but a few load-bearing patterns deserve a quick read here so you can scan before diving into the code.

### State shape

DemoApp organizes its persistent state around six concerns. Recreating this shape (or a subset) in your CustomApp gives you a clean place to load from / save to whatever backend you choose:

```js
// Capture storage (populated by ViewerOutput callbacks)
const [sectionCaptures, setSectionCaptures] = useState({})       // { [sectionId]: ViewerSectionCapturePayload + optional .presentationMode tag }
const [optionCaptures, setOptionCaptures] = useState({})         // { [sectionId]: { [optionId]: { geometryIds, materialAssignments } } }
const [materialDefaultCapture, setMaterialDefaultCapture] = useState(null)
const [presentationModeCaptures, setPresentationModeCaptures] = useState({})

// Per-session selection state
const [selectedSectionId, setSelectedSectionId] = useState(SECTION_DEMO_ITEMS[0]?.id)
const [selectedOptions, setSelectedOptions] = useState({ /* sectionId → optionId */ })

// Selection-key signal (App's "fresh apply" trigger — bumped on every section/pMode click)
const [selectionKey, setSelectionKey] = useState(0)
```

### `viewerInput` memo — translating App state into the contract

The single most important pattern in DemoApp: a `useMemo` that derives `viewerInput` from App state. Triggers a fresh push to the Viewer whenever any input changes:

```js
const viewerInput = useMemo(() => ({
  model: { modelUrl },
  camera: {
    cameraMode: sectionCapture?.cameraMode,
    pose: requestedCameraPose,             // freshens on every selectionKey bump
  },
  scene: {
    visibilityAssignments,                 // hide pool + active option's shown set
    defaultMaterialAssignments: materialDefaultCapture?.defaultMaterialAssignments,
    materialAssignments: optionMaterialAssignments,
  },
  presentation: resolvedPresentation,      // from usePModeResolver
  admin: { enabled: adminEnabled, ...(batchCaptureRequest.nonce > 0 ? { batchCapture: batchCaptureRequest } : {}) },
  selectionKey,
}), [/* deps */])
```

`requestedCameraPose` is itself a `useMemo` keyed on both `sectionCapture?.pose` and `selectionKey` so re-clicking the same section produces a new pose reference and re-fires the camera animation.

### Identity-free capture routing — `onSectionCaptured`

Every capture callback fires identity-free; the App attaches identity from its own selection state. Use stable refs (not state) inside callbacks so they don't stale-close:

```js
const selectedSectionIdRef = useRef(selectedSectionId)
selectedSectionIdRef.current = selectedSectionId

// inside viewerOutput memo
onSectionCaptured: (payload) => {
  const sectionId = selectedSectionIdRef.current
  setSectionCaptures((prev) => ({
    ...prev,
    [sectionId]: { ...payload, presentationMode: currentPModeRef.current },  // optional pMode tag for re-skin
  }))
}
```

### Section click → bump selectionKey

Section pill clicks bump `selectionKey` so the Viewer re-fires both camera animation and presentation re-sync — even when the underlying values haven't changed:

```js
const handleSectionClick = useCallback((sectionId) => {
  setSelectedSectionId(sectionId)
  pModeOnSectionSelected(sectionCaptures[sectionId])
  setSelectionKey((n) => n + 1)
}, [sectionCaptures, pModeOnSectionSelected])
```

Option clicks **don't** bump `selectionKey` — they change material/visibility intent (App pushes via different state), not camera or presentation intent.

### Visibility assignments — combinatorial ownership

Two flat lists; the Viewer resolves `shownGeometryIds` wins over `hiddenGeometryIds`:

```js
const visibilityAssignments = useMemo(() => {
  const hasCapture = !!sectionCapture
  const captureHidden = sectionCapture?.visibilityAssignments?.hiddenGeometryIds ?? []
  if (!hasCapture && !inactiveOptionGeometryIds.length) return undefined  // uncaptured-section nav: preserve-on-undefined
  return {
    hiddenGeometryIds: inactiveOptionGeometryIds,    // per-section union of inactive options' geometry
    shownGeometryIds: activeOptionGeometryIds,        // active option's geometry per section
    sectionHiddenGeometryIds: hasCapture ? captureHidden : undefined,  // section-level hides (typically the roof)
  }
}, [sectionCapture, inactiveOptionGeometryIds, activeOptionGeometryIds])
```

Critical detail: when the section has a capture but no hides, push `sectionHiddenGeometryIds: []` (not `undefined`) so the prior section's hides clear. Returning `undefined` for the whole assignments object only when truly nothing to express AND no capture exists. See [Capture & Replay → Section captures](capture_and_replay.md#section-captures) for the preserve-on-undefined contract.

### Cross-section ownership enforcement — `onOptionCaptured`

Two independent rules: show/hide ownership and material-assignment ownership. DemoApp validates incoming captures via `findOptionCaptureConflicts` and rejects with a banner on either rule:

```js
onOptionCaptured: (payload) => {
  const sectionId = selectedSectionIdRef.current
  const chosenOption = selectedOptionsRef.current[sectionId]
  const conflicts = findOptionCaptureConflicts(optionCapturesRef.current, sectionId, payload)
  if (conflicts.geometry.length || conflicts.material.length) {
    setCaptureConflict({ sectionId, optionId: chosenOption, conflicts })
    return  // do not store
  }
  setOptionCaptures((prev) => ({
    ...prev,
    [sectionId]: { ...prev[sectionId], [chosenOption]: mergeOptionCapture(prev[sectionId]?.[chosenOption], payload) },
  }))
}
```

If your CustomApp has only one option per section (or no options), the conflict-detection machinery isn't needed — skip [`crossSectionConflicts.js`](https://github.com/EBjornson/viewer-docs/blob/main/integration-kit/crossSectionConflicts.js) and [`CaptureConflictBanners.jsx`](https://github.com/EBjornson/viewer-docs/blob/main/integration-kit/CaptureConflictBanners.jsx).

### Capture confirmation feedback

When admin clicks a Capture button in the Viewer's Authoring Panel, the Viewer fires the corresponding `onXCaptured` callback. The button's own visual state acknowledges the click, but a brief App-side flash over the viewer panel gives stronger "capture succeeded and the App stored it" feedback — useful when the admin is rapidly authoring multiple sections and wants confirmation each one landed. DemoApp implements this in ~10 lines:

```jsx
const [showCaptureFlash, setShowCaptureFlash] = useState(false)
const captureFlashTimerRef = useRef(null)
const triggerCaptureFlash = useCallback(() => {
  if (captureFlashTimerRef.current) clearTimeout(captureFlashTimerRef.current)
  setShowCaptureFlash(true)
  captureFlashTimerRef.current = setTimeout(() => setShowCaptureFlash(false), 180)
}, [])

// inside viewerOutput, call from each capture callback that should pulse:
onSectionCaptured: (payload) => { /* store… */; triggerCaptureFlash() }
onOptionCaptured: (payload) => { /* store… */; triggerCaptureFlash() }
onMaterialDefaultsCaptured: (payload) => { /* store… */; triggerCaptureFlash() }
onPresentationModeCaptured: (snapshot) => { /* store… */; triggerCaptureFlash() }

// in the JSX, render the overlay above the Viewer mount when active:
{showCaptureFlash && (
  <div style={{
    position: 'absolute', inset: 0,
    background: 'rgba(72,127,255,0.22)',
    pointerEvents: 'none', zIndex: 10,
  }} />
)}
<ViewerComponent input={viewerInput} output={viewerOutput} />  // sibling, inside a position:relative parent
```

The 180ms duration and blue tint are DemoApp's choice — adjust to taste. The pattern itself (boolean + 180ms timer + absolute-positioned overlay sibling to the Viewer mount, parent with `position: relative` so `inset: 0` works) is what's recommended; the visual styling is yours.

---

## Source

- [DemoApp.jsx](https://github.com/EBjornson/viewer-docs/blob/main/integration-kit/DemoApp.jsx) — the full reference component.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
