# Viewer Integration Kit

Reference source files for CustomApps integrating the Viewer. **Mirrored from the BPViewer source repo on every push to main; this folder is read-only — edit upstream.**

## What's here

| File | Role |
|---|---|
| [DemoApp.jsx](DemoApp.jsx) | Canonical reference host App. Demonstrates every callback in the contract: section / option / material defaults / presentation mode capture + replay, batch image render, cross-section ownership enforcement, and an opt-in user-mode pMode override (Visual Override toggle). Copy as the starting template for your CustomApp. |
| [ViewerElementReactBridge.jsx](ViewerElementReactBridge.jsx) | **Required for any React host that consumes the Viewer bundle.** ~30-line React adapter that mounts the bundle's `<viewer-element>` custom element and exposes the same `{ input, output }` prop shape DemoApp uses. The bundle ships its own React internally (so Vue/Vanilla hosts don't need to install one); a React host can't `import { Viewer }` from the bundle directly because two-React-copies → "Invalid hook call" → blank page. The bridge sidesteps that by talking to the element via DOM property + DOM events. |
| [viewerOutputEventMap.js](viewerOutputEventMap.js) | Source-of-truth callback-name → DOM-event-name map (12 entries). Imported by `ViewerElementReactBridge.jsx`; available for non-React adapters (Vue, Svelte, Vanilla bridges) to iterate the same table programmatically rather than hardcoding. |
| [usePModeResolver.js](usePModeResolver.js) | Reusable hook for the three-source pMode merge (transient override → section pMode tag → sticky default). Used by `DemoApp.jsx` for both admin authoring and the user-mode override. CustomApps with a presentation-mode taxonomy of their own can drop this in by passing their own `defaultMode`. |
| [crossSectionConflicts.js](crossSectionConflicts.js) | Pure helpers for the two cross-section ownership rules (show/hide list, material assignments). `findOptionCaptureConflicts` validates an incoming `onOptionCaptured` payload against existing stored captures; `mergeOptionCapture` does the additive merge; `findExistingCrossSectionViolations` scans persisted state for pre-existing violations on load. Drop-in. |
| [CaptureConflictBanners.jsx](CaptureConflictBanners.jsx) | Red banner for "rejected, conflicts with section X" + amber banner for "pre-existing violations in your stored state." Pair with the helpers above. |
| [CaptureTooltip.jsx](CaptureTooltip.jsx) | The 3-second-hover payload-inspector tooltip wrapper used throughout DemoApp. Useful for any CustomApp surface that wants to reveal stored capture payloads on hover (admin-mode only). |
| [captureImageOverlay.js](captureImageOverlay.js) | Composites the footer text overlay onto batch-rendered JPEGs (section label, solar time, etc.). DemoApp's `onBatchCaptureComplete` calls this before triggering the download. |
| [solarFormatUtils.js](solarFormatUtils.js) | Date/time formatting helpers (decimal-hours ↔ time-string, day-of-year ↔ date-string). Imported by `captureImageOverlay.js`. Dependency-free. |
| [sectionDemoConfig.js](sectionDemoConfig.js) | DemoApp's demo section/option taxonomy — 6 sections, 4 options each (with two optionless sections for "view-like" stored moments). Replace with your CustomApp's product structure. |
| [modelManifest.js](modelManifest.js) | Stub with one placeholder entry. Real `modelManifest.js` in BPViewer is auto-generated and demo-specific (lists curated models in `public/models/`); the stub gives the kit DemoApp a resolvable import out-of-the-box. Either replace with your own model list or strip the model-dropdown UI from your DemoApp.jsx adaptation if your App has one project per session. |
| [viewerContractTypes.js](viewerContractTypes.js) | JSDoc type definitions for the contract surface (`ViewerInput`, `ViewerOutput`, capture payloads, etc.). Authoritative reference for what the Viewer accepts and emits. |

## Recommended workflow

These are **example files, meant to be copied into your project** — not a published library. Imports inside the kit files are sibling-relative (the BPViewer sync rewrites them on copy), so the kit is genuinely copy-paste-ready: dropping `DemoApp.jsx` and its sibling helpers into your CustomApp's source tree resolves cleanly.

1. **Read the rendered docs first**: start at the [Viewer Documentation site](https://ebjornson.github.io/viewer-docs/). The Overview → Integration Guide → DemoApp Reference progression walks you through the integration model and the host-App pattern before you touch code. The [CustomApp patterns section](https://ebjornson.github.io/viewer-docs/integration/#customapp-patterns--pick-your-starting-shape) helps you pick which kit files apply to your shape (Build & Price vs. Walkthrough vs. Single-product configurator).
2. **Pin the Viewer bundle** in your CustomApp's HTML or JSX per the [Integration Guide's "Delivery" section](https://ebjornson.github.io/viewer-docs/integration/#delivery). The bundle URL is `https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1/viewer.js` (float — auto-upgrade on patch / minor releases) or `@v1.X.Y` (immutable exact pin). React, Three.js, and `@react-three/fiber` are bundled internally — your App doesn't need to install them.
3. **For React hosts: copy `ViewerElementReactBridge.jsx` and `viewerOutputEventMap.js`** into your project. The bridge is the load-bearing piece — it mounts the bundle's custom element with a React-friendly `{ input, output }` API. You can't skip it and import `Viewer` directly; the bundle's bundled React would clash with your host's React. See the [Integration Guide's "React" section](https://ebjornson.github.io/viewer-docs/integration/#react) for the full explanation. A skeleton entry-point looks like:
   ```jsx
   import 'https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1/viewer.js'  // side-effect: registers <viewer-element>
   import { ViewerElementReactBridge } from './ViewerElementReactBridge'
   import { App } from './App'
   import ReactDOM from 'react-dom/client'

   ReactDOM.createRoot(document.getElementById('root')).render(
     <App ViewerComponent={ViewerElementReactBridge} />
   )
   ```
4. **Copy `DemoApp.jsx` as your starting template.** It uses the same `<Viewer input={...} output={...} />` surface a CustomApp would. Adapt its UI to your product; the contract translation pattern (state → `viewerInput`, `viewerOutput` → state) is the load-bearing part to keep. The [Common patterns from DemoApp.jsx](https://ebjornson.github.io/viewer-docs/demoapp/#common-patterns-from-demoappjsx) section in the docs inlines the most-used snippets so you can scan before diving into the code.
5. **Pull in helpers as needed**: `crossSectionConflicts.js` for ownership enforcement, `usePModeResolver.js` if your App has a presentation mode taxonomy, `CaptureTooltip.jsx` for admin tooltip-on-hover, etc. Each file is independent — adopt only what you need.
6. **Replace `sectionDemoConfig.js` and `modelManifest.js`** with your own product structure. The shapes (`[{ id, label, options }]` and `[{ id, label, path }]`) are what `DemoApp.jsx` consumes; if your product structure differs, `DemoApp.jsx`'s rendering / state code is the surface to adapt.
7. **For persistence beyond DemoApp's localStorage demo**: see the [Persistence Patterns](https://ebjornson.github.io/viewer-docs/persistence_patterns/) doc. localStorage's ~5MB quota can't hold user-uploaded `.glb` files; the doc covers IndexedDB / OPFS / Supabase / Firebase / S3 options behind a small storage abstraction so v0.1 can swap to a backend without restructuring.

For runtime-fetching any of these files (uncommon), all are also served via jsDelivr at `https://cdn.jsdelivr.net/gh/EBjornson/viewer-docs/integration-kit/<file>`. Most CustomApps will copy + bundle locally instead.

## Default assets (HDRIs, terrains, materials)

Pinned to a separate CDN: `https://cdn.jsdelivr.net/gh/EBjornson/viewer-assets@v1` — your CustomApp doesn't need to host these. The Viewer bundle references them by default. See the [Integration Guide's "Default assets" section](https://ebjornson.github.io/viewer-docs/integration/#default-assets-hdris-terrain-textures-material-textures).

## Versioning

Both the Viewer bundle (`viewer-dist`) and the asset library (`viewer-assets`) follow semver. The `@v1` URL in the integration kit is the major-version float — patch / minor releases automatically apply. Pin to `@v1.X.Y` for an immutable exact version.
