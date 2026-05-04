# Capture & Replay

**Primary reader:** App or Viewer engineer
**Job-to-be-done:** Deep-dive on the capture lifecycle (sections, views, options, materials, presentation modes)
**Next doc:** [Viewer Contract v1.7](viewer_contract_v1_7.md)

---

## Purpose

This document describes the complete capture/replay lifecycle for **section captures**, **view captures**, and **presentation mode captures**, including how they interact with the Views Panel, the Space Menu, the overhead space-tile click (`SpaceTileClickNav`), and Admin vs User rendering modes.

---

## The Core Principle

> **The App stores presentation intent. The Viewer executes it.**

The Viewer never persists state on behalf of the App. Every capture produces a serialisable payload that the Viewer fires back through a `ViewerOutput` callback. The App stores the payload, then replays it later by passing the stored values back into `viewerInput`. The Viewer reacts to changed input — no sync, no dual state.

---

## Capture Types at a Glance

| Capture type | What it owns | Viewer callback | Replay path |
|---|---|---|---|
| **Section** | pose + cameraMode + presentationMode + visibility + ui flags | `onSectionCaptured` | App resolves `presentationModeCaptures[capture.presentationMode]` → `input.presentation`; writes `input.camera` + `input.scene.visibilityAssignments`; `capture.ui` takes precedence over the mode snapshot's ui flags |
| **View** | pose + viewMode + presentationMode + visibility + ui flags (per view slot) | `onViewCaptured` | App resolves mode → presentation and writes same fields when `onViewSelected` fires; `capture.ui` takes precedence over the mode snapshot's ui flags |
| **Presentation Mode** | full presentation snapshot (per named mode) | `onPresentationModeCaptured` | App stores keyed by mode name; Viewer applies at mode switch; App resolves at section/view replay time |
| **Option** | geometryIds + materialAssignments (per option) | `onOptionCaptured` | App writes `input.scene.materialAssignments` when that option is active |
| **Material Defaults** | model-level baseline materialAssignments | `onMaterialDefaultsCaptured` | App writes `input.scene.defaultMaterialAssignments` on every model load |

Section and View captures have identical payload shapes. The only difference is what triggers replay.

---

## Last-One-Wins

Presentation replay follows a **last-one-wins** rule:

- Activating a section tab → the section capture drives camera + presentation + visibility
- Pressing a View button → the view capture drives camera + presentation + visibility
- Whichever happened most recently is what the Viewer renders

There is no overlay or merge between the two. The App simply builds `viewerInput` from whichever capture is currently active.

---

## Section Captures

### What a section capture owns

A section capture is a stored package for one section:

- camera pose (`position`, `target`) — FOV is not stored; the Viewer derives it from `cameraMode` at replay
- camera mode (`'exterior'` | `'interior'` | `'overhead'`)
- presentation mode reference (a name like `'day'` — not the inline presentation values; the App resolves the full snapshot at replay time via `presentationModeCaptures[capture.presentationMode]`)
- visibility assignments (`hiddenGeometryIds`, `isolatedGeometryIds`)
- UI visibility flags (`showSolarSitePanel`, `showNorthArrow`, `showPresetViews`, `showPresentationPresets`, `showWinterPresets`, `showSpaceMenu`) — captured at the time of the section capture so each section can independently control which panels users see

### Capturing

In Admin Mode, the admin:

1. Activates the section
2. Moves the camera, adjusts presentation, hides geometry as needed
3. Sets the **Camera Mode** (Ext / Int / Ovh) in the authoring panel to label the mode — this does not move the camera, it tags which mode will be written into the payload
4. Clicks **Section Capture**

The Viewer fires:

```ts
onSectionCaptured(payload: ViewerSectionCapturePayload)
```

Payload shape:

```ts
{
  pose: { position, target },
  cameraMode: 'overhead',
  presentationMode: 'day',
  visibilityAssignments: { hiddenGeometryIds: ['roof-1', 'roof-2'] },
}
```

### App storage

The App stores the payload keyed by section ID:

```ts
sectionCaptures[activeSectionId] = payload
```

### Replay <a id="presentation-resolution"></a>

When the user activates a section, the App builds `viewerInput` from the stored payload. The presentation field has two layers: the mode snapshot is the base, and the capture's own `ui` flags spread on top so they take precedence. This is the **canonical resolution path** — section captures, view captures, and `onSpaceTileWalkActivated` all use it:

```ts
const capture = sectionCaptures[activeSectionId]
const modeSnapshot = presentationModeCaptures[capture?.presentationMode] ?? defaultPresentation
const presentation = capture?.ui
  ? { ...modeSnapshot, ui: { ...modeSnapshot?.ui, ...capture.ui } }
  : modeSnapshot

viewerInput = {
  camera: {
    cameraMode: capture?.cameraMode ?? 'exterior',
    pose: capture?.pose ? { ...capture.pose } : undefined,
  },
  presentation,
  scene: {
    visibilityAssignments: capture?.visibilityAssignments,
    ...
  },
}
```

Why the two-layer ui spread: the mode snapshot stores the User Visibility flags that were active when the *mode* was captured, but each section / view can independently override them (e.g. hide the Solar panel for interior views, show it for exterior). The capture's `ui` field carries those per-capture overrides; spreading it on top of `modeSnapshot.ui` lets per-capture settings win without losing the mode-level baseline.

The Viewer sees updated `input.camera.pose` and `input.presentation` references and replays them.

### Clearing

Clicking **Clear Section Capture** fires `onSectionCaptureCleared()`. The App removes the stored capture for that section.

---

## View Captures

### What a view capture owns

A view capture has the same shape as a section capture, stored in one of three named slots (`'exterior'`, `'interior'`, `'overhead'`):

- camera pose
- camera mode
- presentation mode reference (resolved at replay time, same as section captures)
- visibility assignments
- UI visibility flags (same six flags as section captures)

This lets the user press a View button and consistently arrive at the right camera position, lighting, and visibility — regardless of which section is active.

### View captures are treated like section captures

The payload shape is identical to a section capture. The only difference is the trigger: view captures are replayed when the user presses a View button, not when a section tab is activated.

### Capturing

In Admin Mode, the admin:

1. Navigates to the desired view using the View buttons in the Views Panel
2. Sets the **Camera Mode** selector (Ext / Int / Ovh) in the authoring panel to label which mode this pose represents — this does not move the camera, it only tags the mode that will be stored in the payload
3. Adjusts lighting and visibility to the correct state for that view
4. Clicks **View Capture** in the authoring panel (top of the panel when `view` focus is active)

The Viewer fires:

```ts
onViewCaptured(payload: ViewerViewCapturePayload)
```

Payload shape:

```ts
{
  viewMode: 'interior',
  pose: { position, target },
  presentationMode: 'nightInt',
  visibilityAssignments: { hiddenGeometryIds: [] },
}
```

`viewMode` identifies the view slot. Today the values coincide with the cameraMode enum (`'exterior' | 'interior' | 'overhead'`), so a view's viewMode doubles as its replay cameraMode. They're separate concepts though — viewMode is allowed to extend later (e.g. multiple `'exterior'`-camera views via slots like `'frontExterior'`) without changing the cameraMode enum or section captures.

### App storage

The App stores the payload keyed by the view slot:

```ts
viewCaptures[payload.viewMode] = payload
```

### Replay — onViewSelected

When the user presses a View button, the Viewer fires:

```ts
onViewSelected(viewMode: ViewerViewMode)
```

The App looks up its stored view capture for that slot and rebuilds `viewerInput` exactly as it would for a section capture — full pose + presentation + visibility. The replay cameraMode is derived from `capture.viewMode` (1:1 with the cameraMode enum today). There is no separate passback mechanism; the App drives the replay directly through `viewerInput`.

If no capture exists for the pressed slot, the App does not update `viewerInput` — nothing changes.

In **Admin Mode**, pressing a View button navigates the Viewer's camera internally (using the stored capture pose if available, or a default quick view as a fallback). The `onViewSelected` callback IS fired in Admin Mode (to allow the App to clear section tab highlighting), but the App should NOT trigger camera or presentation replay in response when admin is active — the Viewer handles navigation internally.

### Clearing

Clicking **Clear View Capture** fires `onViewCaptureCleared(viewMode)`. The App removes that entry from its stored captures.

---

## Option Captures

### What an option capture owns

An option capture defines what a chosen product option should look like:

- `geometryIds` — which geometry nodes belong to this option (used to hide non-active options)
- `materialAssignments` — material/texture overrides applied when this option is selected

### Intentionally context-free payloads

The Viewer fires `onOptionCaptured` with a payload that contains **no section or option identity**:

```ts
onOptionCaptured(payload: ViewerOptionCapturePayload)
// payload = { geometryIds, materialAssignments }
```

Section and option identity are App-level concepts. The Viewer has no knowledge of them. The App routes the payload to the correct storage location using its own current selection state — whatever section and option the admin has active at the moment the capture button is pressed.

The Viewer offers two capture buttons that produce different payload shapes:

- **Option Capture** — fires `onOptionCaptured` with both `geometryIds` (from current selection) and `materialAssignments` (from recent material changes). The standard "this option owns this geometry, possibly with this material" capture.
- **Capture Material Only** — fires `onOptionCaptured` with `materialAssignments` only — `geometryIds` is omitted. Used when the option's intent is to color geometry already owned for show/hide by another section, so Rule 1 (show/hide ownership) is not triggered for the selected geometry.

This is by design: the contract stays clean, and the App retains full ownership of its data model. The author's responsibility is to have the correct section and option selected before clicking Capture. The App is also expected to enforce two independent cross-section ownership rules — show/hide list ownership and material assignment ownership — each exclusive across sections. DemoApp's `onOptionCaptured` handler scans the existing captures and rejects any capture whose geometry IDs or material assignments would violate either rule, with a banner notification. See [Cross-Section Ownership Enforcement](integration_guide.md#cross-section-ownership-enforcement) in the integration guide.

### App storage

Option capture is **additive**: each capture merges into the existing stored payload for that option rather than replacing it entirely.

- **Geometry IDs** — unioned (deduplicated). New IDs are added; existing IDs are preserved.
- **Material assignments** — merged per `geometryId`. The incoming assignment wins for any geometry it targets; assignments for geometry not touched by the new capture are preserved unchanged.

```ts
onOptionCaptured: (payload) => {
  // App reads its own current selection to route the payload,
  // then merges the incoming payload into the existing stored capture.
  const existing = optionCaptures[activeSectionId]?.[activeOptionId]
  optionCaptures[activeSectionId][activeOptionId] = mergeOptionCapture(existing, payload)
  // mergeOptionCapture: union geometryIds; incoming wins per geometryId for materialAssignments
}
```

This means capturing twice for the same option accumulates geometry and material assignments across both captures. To replace the full stored payload from scratch, use **Clear Option Capture** first, then capture again.

### Replay

When the user selects an option, the App builds `input.scene.materialAssignments` from all active option captures:

```ts
const materialAssignments = activeSections.flatMap((section) => {
  const capture = optionCaptures[section.id]?.[selectedOptions[section.id]]
  return capture?.materialAssignments ?? []
})
```

Geometry visibility for non-active options is driven by `input.scene.visibilityAssignments.hiddenGeometryIds` — the App hides any `geometryIds` belonging to options that are not currently selected.

### Clearing

`onOptionCaptureCleared()` fires when the admin clears the active option's capture. The App removes or zeroes the stored entry for that section/option pair.

---

## Material Default Captures

### What a material default capture owns

A single model-level set of `defaultMaterialAssignments` — the baseline material state applied to the model on every load, before any option assignments. Option assignments always override defaults for the same geometry.

### App storage and replay

```ts
onMaterialDefaultsCaptured: (payload) => {
  materialDefaultCapture = payload
}
// replayed via:
input.scene.defaultMaterialAssignments = materialDefaultCapture?.defaultMaterialAssignments ?? []
```

The App passes `defaultMaterialAssignments` on every `viewerInput` build regardless of which section or option is active.

---

## Presentation Mode Captures

### What a presentation mode capture owns

A presentation mode capture is a **full `ViewerPresentationInput` snapshot** for one of six named modes. It owns everything — environment, terrain, HDR settings, exposure, lighting, point light, solar configuration, and UI flags.

This is intentionally broader than "just lighting." Different modes can use completely different HDR environments, terrain presets, north offsets, and solar times.

| Mode | Key | Intended use |
|---|---|---|
| Summer Day | `'day'` | Daytime exterior — bright sky, natural sun |
| Summer Night | `'nightExt'` | Night exterior — city/ambient night environment |
| Summer Night Interior | `'nightInt'` | Night interior — point lights, low ambient |
| Winter Day | `'winterDay'` | Winter daytime exterior — cooler sky, low winter sun |
| Winter Night | `'winterNight'` | Winter night exterior |
| Winter Night Interior | `'winterNightInt'` | Winter night interior |

Sections and view captures reference modes by name, so adding or removing modes does not require re-capturing those payloads. The Summer and Winter rows are each controlled by a separate User Visibility flag (`showPresentationPresets` and `showWinterPresets`).

### Viewer defaults before first capture

All six presentation modes have built-in defaults in the Viewer. The App does **not** need to pass a `presentation` payload on initial model load — if `input.presentation` is omitted, the Viewer renders using its built-in defaults for the active mode. Providing presentation input is only necessary once the App has stored captures to replay.

Winter modes have specific defaults that apply automatically when first selected without a stored capture:

- **HDRI:** Horn Koppe Snow
- **Terrain:** Snow

Switching to a winter mode with no capture sets only those two fields — all other presentation settings (lighting, exposure, solar, etc.) remain at their current values. Summer modes have no equivalent override; switching to an uncaptured summer mode leaves all settings unchanged.

### Capturing

In Admin Mode, the admin:

1. Selects the desired mode using the presentation mode buttons in the Views Panel (Summer Day / Summer Night / Summer Night Interior in the first row, Winter Day / Winter Night / Winter Night Interior in the second row)
2. Adjusts all presentation settings to the correct state for that mode
3. Clicks **Mode Capture** in the authoring panel (top of the panel when `presentationMode` focus is active)

The Viewer fires:

```ts
onPresentationModeCaptured(payload: ViewerPresentationModeCapturePayload)
```

Payload shape:

```ts
{
  mode: 'nightExt',
  presentation: { environmentId: '/hdri/city-night.exr', exposure: 0.3, ambientIntensity: 0.2, ... },
}
```

### App storage

```ts
presentationModeCaptures[payload.mode] = payload.presentation
```

The App stores the full `ViewerPresentationInput` snapshot keyed by mode name.

### Replay — two roles

Presentation mode captures serve two distinct roles:

**Role 1 — Mode switching.** When the user switches modes, the Viewer fires `onActivePresentationModeChanged(mode)`. The App can apply the stored snapshot for that mode to `input.presentation`. In Admin Mode the Viewer applies captures directly to `presentationState` when the mode changes, without going through the App.

**Role 2 — Section and view replay.** Section and view captures carry only a `presentationMode` name, not a full snapshot. At replay time the App resolves:

```ts
const presentation = presentationModeCaptures[capture.presentationMode] ?? defaultPresentation
```

This keeps section and view payloads small and ensures all captures that share a mode always render with the same environment and lighting.

### Clearing presentation mode captures

Individual presentation mode captures can be cleared using the **Mode Clear** button in the authoring panel (visible when `presentationMode` focus is active). This fires:

```ts
onPresentationModeCaptureCleared(mode: ViewerPresentationMode)
```

The App removes the stored entry for that mode:

```ts
onPresentationModeCaptureCleared: (mode) => {
  setPresentationModeCaptures((prev) => {
    const n = { ...prev }
    delete n[mode]
    return n
  })
}
```

Like all clear buttons, this fires even when the Viewer has no locally-cached capture for the current session — the App may hold a stored capture from a previous session that needs clearing.

**Bulk clear:** DemoApp's **Reset Model** button clears all captured payloads at once — section captures, view captures, material defaults, and all six presentation mode captures. It resets the App's full in-memory and persisted state for the current model.

Presentation mode captures can also be replaced in-place: capturing a mode again overwrites the previous snapshot without needing to clear first.

---

## Overhead Space-Tile Click (`SpaceTileClickNav`)

When the user is in **overhead view** and clicks a space tile:

1. The camera navigates into that interior space via pathNav (same routing logic as pressing a Space Menu button).
2. The Viewer fires:

```ts
onSpaceTileWalkActivated(viewMode: 'interior')
```

The App responds by applying **only the presentation and visibility** from the stored interior view capture — it does **not** set a new camera pose, since the Viewer is already navigating via pathNav.

```ts
onSpaceTileWalkActivated: (viewMode) => {
  // update presentation + visibility from viewCaptures[viewMode]
  // do NOT change requestedCameraPose
}
```

This is distinct from `onViewSelected`: view button presses update camera + presentation + visibility; the space-tile click updates presentation + visibility only.

**The Interior view capture is the shared source of truth** for both the Interior button press and overhead space-tile clicks. Authoring once covers both.

If no Interior view capture has been authored, the click still navigates the camera but leaves presentation state unchanged.

In **Admin Mode**, the Viewer applies the Interior view capture directly to its internal presentation and visibility state without firing the callback.

---

## Space Menu — Space / Entry Buttons

Clicking a **Space** or **Entry** button in the Space Menu navigates the camera to that location only. It does **not** change lighting, environment, exposure, material assignments, or geometry visibility.

This is intentional: the admin has explicit control over when presentation state should change (via view captures and section captures). Space Menu buttons are camera navigation only.

The exception is the overhead space-tile click (see above), which navigates and also fires `onSpaceTileWalkActivated`.

---

## View Button Highlight State

View button highlights in the Views Panel track which button was **last pressed**, not which camera mode the camera is currently in.

- Pressing a View button → that button highlights
- Activating a section → all View button highlights clear

This means: replaying a section capture that happens to use `cameraMode: 'exterior'` does not highlight the Exterior view button. The cameraMode (on a section) is an orbit behavior setting; the viewMode (the view button slot) is a user interaction state. They are independent — and even if a section's cameraMode value matches a viewMode slot value, that's a string-match coincidence, not a relationship.

---

## Admin Mode vs User Mode — Presentation Rendering Path

### User Mode (`input.admin.enabled = false`)

`ViewerRoot` renders from `input.presentation` directly. The App fully controls presentation by writing into `viewerInput`.

**Section replay** works by the App resolving `presentationModeCaptures[capture.presentationMode]` to a full snapshot, then writing it to `input.presentation`.

**View button replay** works by the Viewer firing `onViewSelected`, the App resolving the view capture's `presentationMode` reference to a full snapshot via `presentationModeCaptures`, updating `viewerInput.presentation`, and the Viewer rendering the new value.

There is no overlay or merge: the last capture the App applied is what renders.

### Admin Mode (`input.admin.enabled = true`)

`ViewerRoot` renders from `presentationState.snapshot` — the Viewer's internal mutable presentation state, owned by `useViewerPresentationState`. The Admin authoring panel edits this state directly.

`presentationState` syncs from `input.presentation` when the reference changes and the field values actually differ (guarded by `presentationsEqual`). This prevents spurious resets when `viewerInput` rebuilds for unrelated reasons.

**Section replay in Admin Mode** works by the App resolving `presentationModeCaptures[capture.presentationMode]` into a full snapshot, updating `input.presentation`, which triggers the sync effect in `useViewerPresentationState` and updates `presentationState.snapshot`. When this occurs, any active solar preview state is cleared and the Viewer reverts to the authoritative solar time from the replayed snapshot.

**Solar preview clearing:** Whenever a section or view change occurs (via `applyPresentation`), or when the App's `presentation` input reference changes with different values, the Viewer clears the `previewSolar` state and reverts to the authoritative solar time stored in the snapshot. This ensures the solar preview never persists across section/view transitions.

**View button replay in Admin Mode** works entirely inside the Viewer — `handleViewChange` resolves the capture's `presentationMode` reference via `viewerInput.presentationModeCaptures` (the App's persisted map, pushed each render), then applies the full snapshot directly to `presentationState`. `onViewSelected` **is** fired in Admin Mode, but its sole purpose is to signal the App to clear section tab highlighting. The App must not trigger camera or presentation replay in response — the Viewer handles all navigation and presentation updates internally.

**Mode tile click in Admin Mode** is a Viewer-internal flow — `handlePresentationModeSelect` reads `viewerInput.presentationModeCaptures[mode]` directly. If a capture exists, it's applied; otherwise the Viewer applies its built-in `DAY_LIGHTING_DEFAULTS` / `NIGHT_LIGHTING_DEFAULTS` (and seasonal HDRI/terrain for winter modes). The App is notified via `onActivePresentationModeChanged` for authoring-focus updates only — it does not need to push anything in response.

---

## Authoring Interaction Summary

```
Section capture          → stores pose + cameraMode + presentationMode + visibility for that section
                           App resolves presentationModeCaptures[capture.presentationMode] at replay time
                           Replays via input.camera + input.presentation + input.scene

View capture             → stores pose + viewMode + presentationMode + visibility for a named slot
                           App resolves mode → presentation and replays via same path when onViewSelected fires
                           The replay cameraMode is derived from capture.viewMode (1:1 with the cameraMode enum today)

Presentation mode capture → stores full ViewerPresentationInput snapshot per named mode
                           App stores keyed by mode name; Viewer applies at mode switch;
                           App resolves at section/view replay time

onSpaceTileWalkActivated      → App applies presentation + visibility only (no camera pose)
                           Same interior view capture as the Interior button press
```

---

## Summary

- **Section captures** and **View captures** use identical payload shapes, carrying a `presentationMode` name rather than inline presentation values. Section replay is triggered by the App (section tab click). View replay is triggered by the Viewer firing `onViewSelected`.
- **Last-one-wins**: whichever capture was activated most recently determines the current presentation. No overlay.
- **Presentation Mode captures** own a full `ViewerPresentationInput` snapshot per named mode (`'day'`, `'nightExt'`, `'nightInt'`, `'winterDay'`, `'winterNight'`, `'winterNightInt'`). The App resolves the active mode's snapshot at section/view replay time. The Viewer also applies captures directly when the mode switches in Admin Mode.
- **Space Menu / Entry buttons** navigate the camera only — no presentation change.
- **Overhead space-tile click** (`SpaceTileClickNav`) fires `onSpaceTileWalkActivated` — App applies presentation + visibility from the interior view capture (resolving its `presentationMode` reference) but does not override the camera pose.
- **View button highlight** tracks which button was last pressed, not the camera mode. Activating a section clears the highlight.
- **In User Mode**, presentation renders from `input.presentation` — App-owned, last-one-wins.
- **In Admin Mode**, presentation renders from `presentationState.snapshot`, which the admin edits live. View button presses and mode switches apply captures directly to this internal state.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
