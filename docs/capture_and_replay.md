# Capture & Replay

**Primary reader:** App or Viewer engineer
**Job-to-be-done:** Deep-dive on the capture lifecycle (sections, options, material defaults, presentation modes)
**Next doc:** [Viewer Contract](viewer_contract_v1_8.md)

---

## Purpose

This document describes the complete capture/replay lifecycle: **section captures**, **option captures**, **material default captures**, and **presentation mode captures** — including how they interact with the Space Menu, the overhead floor-tile-click navigation, and Admin vs User rendering modes.

---

## The Core Principle

> **The App stores intent. The Viewer executes it.**

The Viewer never persists state on behalf of the App. Every capture produces a serialisable payload that the Viewer fires back through a `ViewerOutput` callback. The App stores the payload, then replays it later by passing the stored values back into `viewerInput`. The Viewer reacts to changed input — no sync, no dual state.

The principle goes further: **the Viewer doesn't even know identity**. Capture callbacks fire identity-free payloads — the Viewer never knows which section, option, or pMode is "active." The App attaches identity from its own state at the moment of capture and routes the payload accordingly.

---

## Capture Types at a Glance

The contract has **3 capture families**. Presentation Mode captures exist as an App-side concept — DemoApp uses a 6-mode taxonomy, but other CustomApps may use any taxonomy or none.

| Capture type | What it owns | Viewer callback | Replay path |
|---|---|---|---|
| **Section** | pose + cameraMode + **embedded presentation snapshot** + visibility | `onSectionCaptured` | App spreads `capture.presentation` into `viewerInput.presentation`, plus `capture.pose` / `capture.cameraMode` / `capture.visibilityAssignments`. Self-contained — no external lookup. |
| **Option** | geometryIds + materialAssignments (per option) | `onOptionCaptured` | App writes `input.scene.materialAssignments` when that option is active |
| **Material Defaults** | model-level baseline materialAssignments | `onMaterialDefaultsCaptured` | App writes `input.scene.defaultMaterialAssignments` on every model load |
| **Presentation Mode** *(App-side)* | full presentation snapshot keyed by App's pMode taxonomy | `onPresentationModeCaptured` | When App tags section captures with a pMode key, replay can re-resolve via `presentationModeCaptures[capture.presentationMode]` for "re-skin" semantics — falls back to embedded snapshot when no pMode store exists. |

A Section may have associated options or no options. An optionless Section serves as a stored "view-like" moment. Single capture family, single replay path for both shapes.

---

## Identity-Free Payloads

All capture callbacks fire payloads with **no section / option / pMode identifier**. The App routes the payload to the correct storage location using its own current selection state at capture time:

- `onSectionCaptured(payload)` → App routes to its currently active section
- `onOptionCaptured(payload)` → App routes to its currently active section + currently active option
- `onMaterialDefaultsCaptured(payload)` → global, no identity needed
- `onPresentationModeCaptured(snapshot)` → App routes to its currently active pMode (if maintaining a pMode taxonomy)

The Viewer never knows which section/option/pMode is currently active. The App is the sole authority for routing. There is no App↔Viewer state sync on identity.

---

## Section Captures

### What a section capture owns

A section capture is a stored package for one section:

- camera pose (`position`, `target`) — FOV is not stored; the Viewer derives it from `cameraMode` at replay
- camera mode (`'exterior'` | `'interior'` | `'overhead'`)
- **embedded presentation snapshot** — full `ViewerPresentationInput` (HDR, terrain, lighting, exposure, solar, light source mode, ui flags) inlined into the payload
- visibility assignments (`hiddenGeometryIds`, `isolatedGeometryIds`)

### Capturing

In Admin Mode, the admin:

1. Activates the section (App-rendered tab)
2. Loads a starting state — either by clicking a pMode pill in the App header (loads App-stored snapshot if present) or by clicking a pMode helper button at the top of the AuthoringPanel's pMode tab (applies built-in lighting defaults)
3. Moves the camera, adjusts presentation, hides geometry as needed. The capture's `cameraMode` is set automatically from the active mode (changed via Quickview clicks at the top of the Section tab, or by replaying a captured pose).
4. Clicks **Section Capture**

The Viewer fires:

```ts
onSectionCaptured(payload: ViewerSectionCapturePayload)
```

Identity-free payload shape:

```ts
{
  pose: { position, target },
  cameraMode: 'overhead',
  presentation: {
    environmentId: '/hdri/meadow.exr',
    exposure: 0.6,
    sunIntensity: 1.0,
    // ...full ViewerPresentationInput snapshot
    ui: { showSolarSitePanel: true, showNorthArrow: true, showSpaceMenu: true },
  },
  visibilityAssignments: { hiddenGeometryIds: ['roof-1', 'roof-2'] },
}
```

### App-side metadata (optional)

DemoApp attaches a `presentationMode` tag from its own currently-active pMode state at capture time, **as App metadata layered on top of the contract payload**:

```js
onSectionCaptured: (payload) => {
  setSectionCaptures((prev) => ({
    ...prev,
    [activeSectionId]: { ...payload, presentationMode: currentPModeRef.current },
  }))
}
```

The tag enables the optional re-skin replay path (see below). It is **App metadata**, not contract data — the Viewer never reads it back. CustomApps that don't maintain a pMode taxonomy can skip this entirely.

### Replay <a id="presentation-resolution"></a>

When the user activates a section, the App reads its stored capture and spreads it into `viewerInput`. Two replay strategies:

**Strategy A — Frozen-at-author-time (no pMode storage):**

```js
const capture = sectionCaptures[activeSectionId]
viewerInput = {
  camera: { cameraMode: capture?.cameraMode, pose: capture?.pose },
  presentation: capture?.presentation,
  scene: { visibilityAssignments: capture?.visibilityAssignments, ... },
}
```

The embedded snapshot is replayed verbatim. No external lookup. CustomApps without a pMode taxonomy use this path automatically — there's nothing else to resolve against.

**Strategy B — Re-skin via pMode lookup (DemoApp default):**

```js
const capture = sectionCaptures[activeSectionId]
const presentation = presentationModeCaptures?.[capture?.presentationMode] ?? capture?.presentation
viewerInput = {
  camera: { cameraMode: capture?.cameraMode, pose: capture?.pose },
  presentation,
  scene: { visibilityAssignments: capture?.visibilityAssignments, ... },
}
```

The App-side `presentationModeCaptures` lookup wins when a pMode store entry exists for the section's tag — so updating one pMode automatically propagates to all sections that share it ("re-skin" semantics). The embedded snapshot serves as the fallback when the lookup misses.

DemoApp uses Strategy B by default. Sections needing per-section variation should be tagged with their own dedicated pMode rather than diverging from a shared one — this keeps the App's structure consistent and avoids accidental drift.

### Clearing

Clicking **Section Clear** fires `onSectionCaptureCleared()`. The App removes the stored capture for the currently active section.

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

This is by design: the contract stays clean, and the App retains full ownership of its data model. The author's responsibility is to have the correct section and option selected before clicking Capture. The App is also expected to enforce two independent cross-section ownership rules — show/hide list ownership and material assignment ownership — each exclusive across sections. DemoApp's `onOptionCaptured` handler scans the existing captures and rejects any capture whose geometry IDs or material assignments would violate either rule, with a banner notification. See [Cross-Section Ownership Enforcement](integration.md#cross-section-ownership-enforcement) in the integration guide.

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

## Presentation Mode Captures (App-side)

Presentation Mode is **not a contract concept** — it's a useful App-side convention for organizing presentation snapshots and enabling re-skin semantics. DemoApp uses a 6-mode taxonomy as the reference example; other CustomApps may use any taxonomy or none.

### What a presentation mode capture owns

A presentation mode capture is a **full `ViewerPresentationInput` snapshot** stored by the App under one of its pMode keys. It owns everything — environment, terrain, HDR settings, exposure, lighting, point light, solar configuration, light source mode, and UI flags.

### DemoApp's 6-mode taxonomy

| Mode | Key | Intended use |
|---|---|---|
| Summer Day | `'day'` | Daytime exterior — bright sky, natural sun |
| Summer Night | `'nightExt'` | Night exterior — city/ambient night environment |
| Summer Night Interior | `'nightInt'` | Night interior — point lights, low ambient |
| Winter Day | `'winterDay'` | Winter daytime exterior — cooler sky, low winter sun |
| Winter Night | `'winterNight'` | Winter night exterior |
| Winter Night Interior | `'winterNightInt'` | Winter night interior |

DemoApp renders these as 2 rows of 3 clickable pills in the App header. In admin mode, clicking a pill loads the App-stored snapshot for that pMode via `viewerInput.presentation` (or shows nothing if not yet captured). In user mode, the pills are pure read-only "blue when captured" status indicators.

### Capturing

In Admin Mode, the admin:

1. Selects the desired pMode by clicking a pill in DemoApp's header (loads any App-stored snapshot for that mode)
2. Optionally clicks a pMode helper button at the top of the AuthoringPanel's pMode tab (applies Viewer's built-in lighting defaults — useful starting point if no stored snapshot). The helper set (Summer/Winter × Day/Night, four buttons) is **independent** from DemoApp's 6-pill taxonomy; helpers seed defaults, the App's pill state determines where the next Mode Capture is routed.
3. Adjusts all presentation settings to the desired state
4. Clicks **Mode Capture** in the Viewer's Authoring Panel

The Viewer fires:

```ts
onPresentationModeCaptured(snapshot: ViewerPresentationInput)
```

The payload is the **bare snapshot** — no `mode` argument. The App routes by attaching its own currently-active pMode key:

```js
onPresentationModeCaptured: (snapshot) => {
  const mode = currentPModeRef.current
  setPresentationModeCaptures((prev) => ({ ...prev, [mode]: snapshot }))
}
```

### Two roles

Presentation mode captures serve two distinct App-side roles:

**Role 1 — Admin authoring starting point.** Admin clicks a pill → App pushes the stored snapshot via `viewerInput.presentation`. The Viewer renders. Admin can then tweak and re-capture.

**Role 2 — Re-skin at section replay time.** When section captures are tagged with a pMode key (DemoApp's optional pattern), App replay re-resolves `presentationModeCaptures[capture.presentationMode]`. Updating a pMode automatically propagates to all sections that share it.

### Clearing

Clicking **Mode Clear** in the Viewer's Authoring Panel fires:

```ts
onPresentationModeCaptureCleared()
```

The payload is empty — no `mode` argument. The App removes the entry under its currently-active pMode key:

```js
onPresentationModeCaptureCleared: () => {
  const mode = currentPModeRef.current
  setPresentationModeCaptures((prev) => {
    const next = { ...prev }
    delete next[mode]
    return next
  })
}
```

Like all clear buttons, this fires even when the Viewer has no locally-cached capture for the current session — the App may hold a stored capture from a previous session that needs clearing.

**Bulk clear:** DemoApp's **Reset Model** button clears all captured payloads at once — section captures, material defaults, and all presentation mode captures. It resets the App's full in-memory and persisted state for the current model.

---

## Overhead Floor-Tile Click

When the user is in **overhead view** (a section captured with `cameraMode: 'overhead'`) and clicks a floor tile (a recognized `_RM` room marker face), the Viewer navigates the camera into that interior space via pathNav. **No callback fires** — the camera movement is purely Viewer-internal navigation.

**Overhead-nav suspension.** Sections captured at overhead typically hide the roof (or similar overhead-only obstructions) so the floor plan reads cleanly — those hides come through `sectionHiddenGeometryIds` per the App-side capture pattern. Without intervention, the user would dive into a roofless interior. To prevent this, the Viewer auto-suspends the section's `sectionHiddenGeometryIds` for the duration of the dive — the roof comes back as the camera descends. Suspension resets when the camera returns to overhead (Section pill re-click, admin Quickview Overhead button) or when the App expresses fresh navigation intent (`selectionKey` bump on a different section).

The same suspension fires on Rooms-panel clicks while in overhead, and on the admin Quickview Interior button. Other visibility fields — the option-visibility pool (`hiddenGeometryIds`), `shownGeometryIds`, and `isolatedGeometryIds` — pass through untouched, so option visibility continues to behave correctly during the dive.

Presentation (lighting, environment, exposure, etc.) still persists across the dive — only the captured hidden geometry is suspended. If the section's presentation reads acceptably from interior poses, no further authoring is required. If you want lighting to change on this gesture, designate a separate interior optionless Section and have the App switch to it.

---

## Space Menu — Space / Entry Buttons

Clicking a **Space** or **Entry** button in the Space Menu (right column, controlled by `ui.showSpaceMenu`) navigates the camera to that location only. It does **not** change lighting, environment, exposure, material assignments, or geometry visibility. Pure camera navigation.

---

## Admin Mode vs User Mode — Presentation Rendering Path

### User Mode (`input.admin.enabled = false`)

`ViewerRoot` renders from `input.presentation` directly. The App fully controls presentation by writing into `viewerInput`.

**Section replay** works by the App reading its stored section capture and pushing the resolved presentation snapshot (per the strategy chosen — frozen embedded vs. re-resolved via pMode lookup) into `input.presentation`.

**No user-mode pMode toggle in DemoApp.** DemoApp omits user-facing pMode buttons by design. Users navigate by section tabs only. CustomApps can opt in to a user-mode pMode toggle by rendering their own buttons that swap `viewerInput.presentation` while leaving camera/visibility alone — this is App-side wiring with no contract change.

### Admin Mode (`input.admin.enabled = true`)

`ViewerRoot` renders from `presentationState.snapshot` — the Viewer's internal mutable presentation state, owned by `useViewerPresentationState`. The Admin authoring panel edits this state directly.

`presentationState` syncs from `input.presentation` when:
- the reference changes AND values differ (typical section-click path), or
- `selectionKey` bumps (force re-sync — for the "Viewer's internal admin state diverged from App's pushed state" case), or
- `hasLightMarkers` flips (smart default re-evaluation on model load)

When `input.presentation` is `undefined` (uncaptured-section navigation), the Viewer **preserves its current state** regardless of `selectionKey` — admin tweaks aren't stomped. The same preserve-on-undefined rule applies to `input.scene.visibilityAssignments.sectionHiddenGeometryIds` (so a captured section's hides — typically the roof in overhead views — survive navigation to an uncaptured section). Together with the camera-pose no-op on falsy `input.camera.pose`, uncaptured-section navigation is a universal scene no-op: the camera doesn't move, lighting doesn't change, visibility stays as it was.

**Section replay in Admin Mode** triggers the sync effect by either changing the presentation reference or bumping `selectionKey`. Any active solar preview state is cleared and the Viewer reverts to the authoritative solar time from the replayed snapshot.

**Solar preview clearing:** Whenever a section change occurs (via `applyPresentation`), or when the App's `presentation` input reference changes with different values, the Viewer clears the `previewSolar` state and reverts to the authoritative solar time stored in the snapshot.

**App-rendered pMode pill click in Admin Mode** loads the App-stored pMode snapshot via `viewerInput.presentation` and bumps `selectionKey`. The Viewer's presentation hook re-syncs (force-resync layer triggers because of the bump even when values match prior state).

**Viewer-rendered pMode helper button click in Admin Mode** (top of the AuthoringPanel's pMode tab — Summer/Winter × Day/Night) applies the Viewer's built-in lighting defaults (`DAY_LIGHTING_DEFAULTS` / `NIGHT_LIGHTING_DEFAULTS`, plus seasonal HDRI/terrain for winter buttons) directly to `presentationState`. No callback to App — pure Viewer-internal authoring convenience for "start fresh from defaults." Helper set is independent from any host App's pMode taxonomy.

---

## Authoring Interaction Summary

```
Section Capture         → Identity-free payload: pose + cameraMode + embedded
                          presentation snapshot + visibility. App routes to its
                          currently active section. Optional App-side metadata:
                          attach presentationMode tag for re-skin support.
                          Replay: spread into viewerInput.camera + .presentation
                          + .scene.visibilityAssignments. Use Strategy A or B.

Option Capture          → Identity-free payload: geometryIds + materialAssignments.
                          App routes to its current section + current option.
                          Additive merge (union geometry, incoming wins per
                          geometryId for materials).

Material Defaults       → Identity-free payload: defaultMaterialAssignments.
                          Global; App stores once per model, replays via
                          input.scene.defaultMaterialAssignments on every load.

Presentation Mode       → Identity-free payload: bare presentation snapshot.
Capture (App-side)        App routes to its currently active pMode key.
                          Optional — Apps without pMode taxonomy skip entirely
                          and rely on section captures' embedded snapshots.

Overhead floor click    → Viewer-internal camera navigation only. No callback.
                          The section's `sectionHiddenGeometryIds` (typically
                          the roof) auto-suspend during the dive so the user
                          can see what they've dived into. Same applies to
                          Rooms-panel clicks and admin Quickview Interior while
                          in overhead. Reapplies on return to overhead.
```

---

## Summary

- **3 contract capture families**: Section, Option, Material Defaults — plus App-side **Presentation Mode** as an optional convention.
- **All capture payloads are identity-free** — App attaches identity (active section / option / pMode tag) from its own state on receipt.
- **Section captures embed the full presentation snapshot** — self-contained replay; no external lookup required. Optional App-attached `presentationMode` tag enables re-skin via `presentationModeCaptures[tag] ?? capture.presentation`.
- **Sections may have options or no options** — an optionless Section serves as a stored "view-like" moment.
- **Presentation Mode taxonomy is App-side** — DemoApp uses 6 modes, other CustomApps may use any taxonomy or none. The Viewer has no built-in pMode awareness.
- **Two admin-mode pMode UI surfaces serve different purposes** and are **independent**: DemoApp header pills (App-side capture-slot taxonomy, currently 6) load App-stored snapshots; the AuthoringPanel's pMode-tab helper buttons (Viewer-internal lighting-defaults seeders, 4) apply Viewer's built-in lighting defaults. Counts and labels are not required to match.
- **`selectionKey`** is the App's "selection changed" signal — bump on section / pill clicks. Two Viewer responses: camera animation re-fire AND presentation re-sync (each gated on the corresponding input being provided).

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
