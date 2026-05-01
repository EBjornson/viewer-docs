# DemoApp

**Primary reader:** App-side developer
**Job-to-be-done:** See what a reference host App looks like and how it surfaces Viewer events
**Next doc:** [Integration Guide](integration_guide.md)

---

## What DemoApp Is

DemoApp is the canonical reference host App in this repo. Source: [src/DemoApp/DemoApp.jsx](../src/DemoApp/DemoApp.jsx).

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
- capture/replay orchestration for all five capture families
- admin mode toggle
- cross-section ownership enforcement (`findOptionCaptureConflicts`)
- per-model persistence in `localStorage` keyed by model ID (`demoapp_v2_${modelId}`)

---

## Header UI

The DemoApp header surfaces a compact set of integrator-facing controls and indicators:

- **Model selector** — dropdown listing manifest models plus an **Upload .glb** button for ad-hoc uploads (uploaded files do not persist).
- **Admin Mode toggle** — flips `input.admin.enabled`. When on, the Viewer renders its built-in Authoring Panel.
- **Reset Model** — clears the entire saved snapshot for the active model (with confirm). Removes section captures, view captures, presentation mode captures, option captures, and material defaults.
- **Complete Build** — triggers batch capture. Blue when at least one section has a captured pose, neutral otherwise. Shows "Capturing…" and is disabled while the batch is in progress. When `onBatchCaptureComplete` fires, DemoApp downloads one JPEG per captured section, named by the section label.
- **Loading / Ready indicator** — status badge that shows "Loading…" until `onViewerReady` fires, then turns green and shows "Ready". Resets on every model switch.
- **Capture status pills** — read-only indicators for Summer Day, Summer Night, Summer Night Interior, Winter Day, Winter Night, Winter Night Interior, Exterior, Interior, Overhead, and Mat. Defaults. Each turns blue when the corresponding capture payload exists in App state. These are the **persistent source of truth** for what has been captured — distinct from the session-only highlights inside the Viewer's authoring overlay.

---

## Developer-Oriented Visual Aids

DemoApp deliberately surfaces several aids to help developers integrating the Viewer inspect what the contract actually delivers:

- **Loading / Ready indicator** *(also listed above)* — hovering the badge shows the full `onViewerReady` payload in a floating panel with a Copy button. Lets integrators inspect the readiness event data without opening DevTools.
- **Capture status pills** *(also listed above)* — hovering any pill (after a 3-second delay) shows the stored JSON payload in a floating panel with a Copy button. Same pattern is applied to section tabs and option buttons — the payload tooltip surfaces the exact data that flowed back through the corresponding `viewerOutput` callback.
- **Payload inspector tooltips** — the unifying name for the hover-and-copy pattern above. Useful for verifying the shape of any capture payload during integration without instrumenting your own logging.
- **Error banner** — a dismissable red banner overlaid on the viewer panel when `onError` fires, showing the error code and message. Clears on dismiss or model switch.
- **Capture conflict banners** — a red banner when `onOptionCaptured` is rejected by cross-section ownership enforcement (names the conflicting geometry IDs and the owning section/option), and a separate amber banner for pre-existing conflicts surfaced from persisted state on load. See [Cross-Section Ownership Enforcement](integration_guide.md#cross-section-ownership-enforcement) for the rules and the rejection pattern.

The Viewer's own capture indicators (highlighted state on individual capture buttons inside the admin overlay) are session-only and reset on reload — they reflect the current authoring session, not stored state. Use the DemoApp header pills for stored-capture status.

---

## Persistence

- **Storage:** browser `localStorage`.
- **Key:** `demoapp_v2_${modelId}` — one snapshot per model ID.
- **Models that persist:** manifest models (stable model ID).
- **Models that do NOT persist:** ad-hoc uploaded `.glb` files. Reload clears them.

Persisted snapshot contents:

- section captures (`pose`, `cameraMode`, `presentationMode` reference, `visibilityAssignments`, `ui` flags)
- chosen options by section
- option captures (`geometryIds`, `materialAssignments`)
- model default material capture
- view captures (keyed by camera mode; same shape as section captures)
- presentation mode captures (keyed by mode; full `ViewerPresentationInput` snapshot; six modes: day / nightExt / nightInt / winterDay / winterNight / winterNightInt)
- section/option label renames

A production CustomApp would persist these to its backend instead of `localStorage`, but the data shapes are the same.

---

## Source

- [src/DemoApp/DemoApp.jsx](../src/DemoApp/DemoApp.jsx) — the full reference component.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
