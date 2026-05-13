// Kit-only stub. Source-of-truth `modelManifest.js` in BPViewer is auto-
// generated from public/models/ contents and is intentionally NOT shipped to
// the integration kit (it lists demo-specific models that don't exist in a
// CustomApp's tree). This stub gives the kit's DemoApp.jsx a resolvable
// import + a single placeholder entry so the kit copy renders out-of-the-box
// without an undefined-import crash.
//
// `scripts/sync-viewer-docs.mjs` maps this file to `integration-kit/modelManifest.js`,
// preserving the import name DemoApp.jsx uses (`import { modelManifest } from
// '../config/modelManifest'` → sync-rewriter flips to `'./modelManifest'`).
//
// CustomApp consumption: either replace this file with your own model list
// (same shape — `[{ id, label, path }]`), or strip the model-dropdown UI from
// your DemoApp.jsx adaptation entirely if your App has one project per session
// (typical for CustomApps that aren't model-browsers).
export const modelManifest = [
  { id: 'sample', label: 'Sample Model', path: '/sample.glb' },
]
