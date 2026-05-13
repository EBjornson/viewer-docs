# Viewer Integration Kit

Reference source files for CustomApps integrating the Viewer. **Mirrored from the BPViewer source repo on every push to main; this folder is read-only — edit upstream.**

## What's here

| File | Role |
|---|---|
| [DemoApp.jsx](DemoApp.jsx) | Canonical reference host App. Demonstrates every callback in the contract: section / option / material defaults / presentation mode capture + replay, batch image render, cross-section ownership enforcement, and an opt-in user-mode pMode override (Visual Override toggle). Copy as the starting template for your CustomApp. |
| [usePModeResolver.js](usePModeResolver.js) | Reusable hook for the three-source pMode merge (transient override → section pMode tag → sticky default). Used by `DemoApp.jsx` for both admin authoring and the user-mode override. CustomApps with a presentation-mode taxonomy of their own can drop this in by passing their own `defaultMode`. |
| [crossSectionConflicts.js](crossSectionConflicts.js) | Pure helpers for the two cross-section ownership rules (show/hide list, material assignments). `findOptionCaptureConflicts` validates an incoming `onOptionCaptured` payload against existing stored captures; `mergeOptionCapture` does the additive merge; `findExistingCrossSectionViolations` scans persisted state for pre-existing violations on load. Drop-in. |
| [CaptureConflictBanners.jsx](CaptureConflictBanners.jsx) | Red banner for "rejected, conflicts with section X" + amber banner for "pre-existing violations in your stored state." Pair with the helpers above. |
| [CaptureTooltip.jsx](CaptureTooltip.jsx) | The 3-second-hover payload-inspector tooltip wrapper used throughout DemoApp. Useful for any CustomApp surface that wants to reveal stored capture payloads on hover (admin-mode only). |
| [captureImageOverlay.js](captureImageOverlay.js) | Composites the footer text overlay onto batch-rendered JPEGs (section label, solar time, etc.). DemoApp's `onBatchCaptureComplete` calls this before triggering the download. |
| [sectionDemoConfig.js](sectionDemoConfig.js) | DemoApp's demo section/option taxonomy — 6 sections, 4 options each (with two optionless sections for "view-like" stored moments). Replace with your CustomApp's product structure. |
| [viewerContractTypes.js](viewerContractTypes.js) | JSDoc type definitions for the contract surface (`ViewerInput`, `ViewerOutput`, capture payloads, etc.). Authoritative reference for what the Viewer accepts and emits. |

## Recommended workflow

These are **example files, meant to be copied into your project** — not a published library. None of them are runtime-loaded from this URL by DemoApp itself.

1. **Read the rendered docs first**: start at the [Viewer Documentation site](https://ebjornson.github.io/viewer-docs/). The Overview → Integration Guide → DemoApp Reference progression walks you through the integration model and the host-App pattern before you touch code.
2. **Pin the Viewer bundle** in your CustomApp's HTML or JSX per the [Integration Guide's "Delivery" section](https://ebjornson.github.io/viewer-docs/integration/#delivery). The bundle URL is `https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1/viewer.js` (float — auto-upgrade on patch / minor releases) or `@v1.X.Y` (immutable exact pin). React, Three.js, and `@react-three/fiber` are bundled internally — your App doesn't need to install them.
3. **Copy `DemoApp.jsx` as your starting template.** It uses the same `<Viewer input={...} output={...} />` surface a CustomApp would. Adapt its UI to your product; the contract translation pattern (state → `viewerInput`, `viewerOutput` → state) is the load-bearing part to keep.
4. **Pull in helpers as needed**: `crossSectionConflicts.js` for ownership enforcement, `usePModeResolver.js` if your App has a presentation mode taxonomy, `CaptureTooltip.jsx` for admin tooltip-on-hover, etc. Each file is independent — adopt only what you need.
5. **Replace `sectionDemoConfig.js`** with your own product structure. The shape (`{ id, label, options: string[] }[]`) is what `DemoApp.jsx` consumes; if your product structure differs, `DemoApp.jsx`'s rendering / state code is the surface to adapt.

For runtime-fetching any of these files (uncommon), all are also served via jsDelivr at `https://cdn.jsdelivr.net/gh/EBjornson/viewer-docs/integration-kit/<file>`. Most CustomApps will copy + bundle locally instead.

## Default assets (HDRIs, terrains, materials)

Pinned to a separate CDN: `https://cdn.jsdelivr.net/gh/EBjornson/viewer-assets@v1` — your CustomApp doesn't need to host these. The Viewer bundle references them by default. See the [Integration Guide's "Default assets" section](https://ebjornson.github.io/viewer-docs/integration/#default-assets-hdris-terrain-textures-material-textures).

## Versioning

Both the Viewer bundle (`viewer-dist`) and the asset library (`viewer-assets`) follow semver. The `@v1` URL in the integration kit is the major-version float — patch / minor releases automatically apply. Pin to `@v1.X.Y` for an immutable exact version.
