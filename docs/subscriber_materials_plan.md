# Subscriber Materials Plan

**Primary reader:** Engineer planning the subscriber-materials feature
**Job-to-be-done:** Understand the Path A design (curated platform catalog + per-tenant private materials)
**Next doc:** [Admin Authoring Guide](admin_authoring_guide.md)

---

**Status:** Planning / not yet implemented
**Date drafted:** 2026-04-30
**Related docs:** [Viewer Contract](viewer_contract_v1_8.md), [Architecture](architecture.md), [Admin Authoring Guide](admin_authoring_guide.md), [Model Authoring Guide](model_authoring_guide.md)

## Overview

This plan moves the project from its current single-source PBR material library to a **curated platform catalog + subscriber private extension** model (Path A — curated set stays in-repo, private set lives per-tenant). The PoC is implemented in DemoApp using browser-local storage; the data shapes and resolver are designed so that migrating to a real backend in a future CustomApp is a storage-adapter swap rather than an architectural rewrite.

Reference systems using this dual-source model: Threekit, Roomle, Emersya, Combeenation. The single-picker-with-source-badge UX convention is borrowed from these and from non-3D analogues like Canva (stock + Brand Kit) and Figma (community + team libraries).

## Goals and non-goals

### Goals

- A single material picker in admin shows curated (platform) materials and subscriber-private (workspace) materials, both as first-class options, distinguished by a source badge and filterable.
- PoC works end-to-end in DemoApp without a backend: upload, parse, store, use in option captures, persist across reloads, replay from saved captures.
- Architecture and data shapes are designed so DemoApp's PoC can migrate to CustomApp by swapping the storage adapter, not by rewriting the App layer.
- Zero behavioral changes inside the Viewer. The only Viewer-touching change is a small contract addition (`viewerInput.materialCatalog`) that is pure data-flow plumbing.

### Non-goals (PoC scope)

- Real authentication, multi-account isolation, billing, or quotas. DemoApp uses one synthetic workspace.
- Cloud storage, presigned uploads, server-side workers.
- Procedural / Substance materials, marketplace, or external-CDN reference materials (out of scope; see Path B notes below).
- Resolution-variant selection UX (`2k` / `4k` are still separate manifest entries — revisit in a later phase).

## Target architecture

Two material catalogs flow through one App-side resolver into the Viewer:

```
            ┌──────────────────────┐
            │  Platform Manifest   │   build-time, in-repo
            │  src/config/         │   public/materials/ → manifest
            └──────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  App: MaterialCatalogResolver │
        │   - merge(platform, workspace)│
        │   - resolveUrls(materialRef)  │
        └──────────┬───────────────────┘
                   ▲
                   │
            ┌──────┴───────────────┐
            │  Workspace Manifest  │   runtime, per-tenant
            │  IndexedDB (DemoApp) │   API (CustomApp)
            └──────────────────────┘
                   │
                   ▼
        viewerInput.materialCatalog  +  resolved materialAssignments
                   │
                   ▼
                 Viewer
```

Key properties:

- **The Viewer doesn't know** about platform vs. workspace. It receives a merged catalog with `source` tags for the picker UI, and resolved URLs in material assignments.
- **The App owns the resolver.** Capture replay goes through the resolver to turn stable `materialRef` IDs into current URLs (Blob URLs in DemoApp, CDN URLs in CustomApp).
- **Material identity is by `(source, familyId, resolution)`.** URLs are an output of resolution, not an identity.

### Data shape additions

**Capture payload — material assignment (additive change):**

```js
{
  geometryIds: [...],

  // NEW — stable identity for catalog resolution
  materialRef: {
    source: 'platform' | 'workspace',
    workspaceId?: string,         // present when source === 'workspace'
    familyId: string,             // e.g. "oak", "concrete-floor-01"
    resolution: string            // e.g. "2k", "4k"
  },

  // EXISTING — scalar overrides and texture transforms
  color, roughness, metalness,
  textureScale, textureRotation, normalMapIntensity,
  restoreOriginalMaterial,

  // EXISTING — raw map URLs.
  // App's resolver populates these from materialRef before passing to Viewer.
  // Viewer continues to consume these as today; no Viewer change.
  maps: { color, normal, roughness, ao }
}
```

**`viewerInput.materialCatalog` (new contract field):**

```js
viewerInput.materialCatalog = [
  {
    source: 'platform' | 'workspace',
    workspaceId?: string,
    familyId: string,
    resolution: string,
    displayName: string,
    color: '#ffffff',
    roughness: number,
    metalness: number,
    maps: { color, normal, roughness, ao }   // current resolved URLs
  },
  ...
]
```

This supersedes the Viewer's static import of [`materialManifest`](https://github.com/EBjornson/BPViewer/blob/main/src/config/materialManifest.js). The App constructs and supplies it on every render.

## Decisions

These were resolved during planning and should not be re-litigated without explicit reason:

1. **Merged catalog flows through `viewerInput.materialCatalog`** — the Viewer accepts the catalog as input rather than continuing to statically import it. Cleaner contract, no module-load-time patching.
2. **DemoApp gets a small dedicated header area** for the Materials surface — sibling to existing DemoApp header controls. Account-scoped, not model-scoped.
3. **No backfill of existing captures** — current localStorage captures that reference platform materials by raw URL will continue to work via legacy URL fallback during the transition; users will recapture at their leisure as they edit. We do not write a one-time migration script.
4. **Resolution variants stay as separate manifest entries for PoC.** A picker-side resolution selector is a follow-up phase.

## Phased implementation plan

### Phase 1 — Extract parsing as a shared module

**Status:** Shipped 2026-05-06 — see [`src/utils/materialPackageParser.js`](https://github.com/EBjornson/BPViewer/blob/main/src/utils/materialPackageParser.js) and its test suite. Build script is now a thin I/O wrapper; manifest output is byte-identical to pre-refactor. Map values use `{ filename, source }` (not `blob`) so the same parser serves Buffer (Node) and Blob (browser) callers without renaming.

Pull the filename-pattern logic and manifest-record construction out of [`scripts/generate-material-manifest.mjs`](https://github.com/EBjornson/BPViewer/blob/main/scripts/generate-material-manifest.mjs) into a runtime-callable module, e.g. `src/utils/materialPackageParser.js`.

**Inputs:** `Map<filename, Blob>` (or `Map<filename, Buffer>` server-side).
**Outputs:** manifest record `{ familyId, resolution, color, roughness, metalness, maps: { color, normal, roughness, ao } }` with map values as `{ filename, blob }` pairs (URL construction happens in the caller).

Build script becomes a thin wrapper that walks the filesystem, reads files into Buffers, calls the parser, then writes URLs into the static manifest.

**CustomApp note:** the same module is imported by the server-side upload worker. One source of truth for filename conventions across build-time, browser-upload, and server-upload.

**Risk:** low. Pure refactor with no behavior change.

### Phase 2 — Capture schema: add `materialRef` (preferred), keep raw URLs (fallback)

Update the option-capture material assignment payload to populate `materialRef` whenever the assignment came from a catalog material. Material picker selections in admin produce `materialRef`; manual color/roughness-only edits without a catalog material leave `materialRef` undefined.

Update App-side replay (in [`DemoApp.jsx`](https://github.com/EBjornson/BPViewer/blob/main/src/DemoApp/DemoApp.jsx) and any helpers under [`src/DemoApp/`](https://github.com/EBjornson/BPViewer/blob/main/src/DemoApp/)) to:

1. If `materialRef` present → resolve current URLs via the catalog resolver and populate `maps`.
2. If `materialRef` absent → use existing `maps` URLs as today (legacy path, supports old captures).
3. If `materialRef` present but unresolvable (deleted material, missing workspace data) → render a magenta placeholder material and surface a warning in the admin overlay. Do not silently drop.

**No code in this phase touches the Viewer.** This is purely capture/replay schema and resolver scaffolding.

### Phase 3 — Workspace storage adapter (DemoApp: IndexedDB)

Introduce a `WorkspaceMaterialStore` interface with a single DemoApp implementation backed by IndexedDB. Suggested API:

```js
listMaterials(workspaceId)             // → metadata records
getMaterialBlobs(workspaceId, familyId, resolution)  // → Map<mapType, Blob>
putMaterial(workspaceId, manifestRecord, blobs)      // store record + texture blobs
deleteMaterial(workspaceId, familyId, resolution)
```

**Storage layout:**
- Object store `material_metadata` keyed by `${workspaceId}/${familyId}/${resolution}`.
- Object store `material_blobs` keyed by `${workspaceId}/${familyId}/${resolution}/${mapType}`, value is `Blob`.

**Runtime URL handling:**
- On App init, scan metadata, read all blobs, create Blob URLs via `URL.createObjectURL`, hold a `Map<materialKey, { metadata, urls }>` in App state.
- Revoke Blob URLs on App teardown or when a material is deleted.
- Workspace ID for DemoApp: hardcoded `'demo-workspace'`. The field exists in stored data and in `materialRef` so CustomApp captures will be properly scoped without schema change.

**CustomApp swap:** the same `WorkspaceMaterialStore` interface is reimplemented over an authenticated REST or RPC backend. Returned URLs are CDN-stable; no Blob URL lifecycle. The App-side resolver code is unchanged.

### Phase 4 — Upload pipeline (DemoApp header surface)

Add a small dedicated area in the DemoApp header — e.g. a "Materials" button that opens a panel or modal. Initially minimal: a list of workspace materials, a drag-drop zone, an inline status area.

**Upload flow:**

1. User drops one or more `.zip` files (or a folder of loose textures).
2. JSZip unpacks each archive into `Map<filename, Blob>`.
3. Phase 1 parser produces a manifest record.
4. Validation:
   - Required: at least a diffuse map (`_diff_`).
   - Recognized maps: `_diff_`, `_nor_gl_`, `_rough_`, `_ao_` (matches build-time convention).
   - Family ID and resolution parsed from archive filename `{familyId}_{resolution}.zip`.
5. Per-archive parse-status row in the panel: which maps were detected, what's missing, family/resolution detected, action button if invalid.
6. On success → `WorkspaceMaterialStore.putMaterial()` → catalog refresh.

**Library:** [JSZip](https://stuk.github.io/jszip/) for in-browser unpacking.

**CustomApp swap:** the upload UI stays mostly the same; the destination becomes a presigned URL → S3 / R2 / Supabase Storage, with an upload-complete webhook triggering a server-side worker that runs the same Phase 1 parser. Browser-side validation (Phase 4 step 4) is repeated server-side as the source of truth.

### Phase 5 — Merged picker in the Viewer admin overlay

Two changes:

1. **Contract:** add `viewerInput.materialCatalog` per the data shape above. Update [`Viewer.jsx`](https://github.com/EBjornson/BPViewer/blob/main/src/public/Viewer.jsx) and runtime in [`ViewerRuntime.jsx`](https://github.com/EBjornson/BPViewer/blob/main/src/viewer/ViewerRuntime.jsx) to thread the catalog through. Document in [Viewer Contract](viewer_contract_v1_8.md).
2. **Picker UI:** update the material picker (currently in [`ViewerAuthoringDemoPanel.jsx`](https://github.com/EBjornson/BPViewer/blob/main/src/viewer/components/ViewerAuthoringDemoPanel.jsx)) to:
   - Consume the catalog from input rather than static import.
   - Render entries grouped or filterable by source: `All` / `Platform` / `Yours`.
   - Show a `Platform` / `Yours` badge per entry.
   - Surface a "Manage materials" link that returns focus to the DemoApp header Materials panel (App-handled — Viewer fires a callback).

The static import of [`materialManifest`](https://github.com/EBjornson/BPViewer/blob/main/src/config/materialManifest.js) inside the Viewer is removed in this phase; the manifest still exists in the codebase as the platform catalog source, just consumed by the App now, not the Viewer.

### Phase 6 — Lifecycle UX

- **Delete:** before deletion, count captures referencing this `materialRef` (a one-pass scan of stored captures in DemoApp localStorage). If > 0, require confirmation and offer "soft delete" (hide from picker, keep blobs for resolver). If 0, hard delete and revoke Blob URLs.
- **Replace / re-upload:** dropping a new zip with the same `(familyId, resolution)` overwrites; existing captures auto-pick up new textures via the resolver.
- **Missing material on replay:** Phase 2's magenta-placeholder + admin warning is the user-visible surface here; this phase polishes the warning UX.
- **Storage usage display:** show approximate IndexedDB usage in the Materials panel via `navigator.storage.estimate()`. Informational in DemoApp; becomes the per-account quota indicator in CustomApp.

### Phase 7 (follow-up, deferred) — Resolution-variant selector

Today the manifest exposes `2k` and `4k` as separate entries. A future phase introduces a per-assignment resolution selector (or auto-select based on viewport / device pixel ratio), with the resolver picking the appropriate variant at replay time. Defer until performance or UX pressure justifies the work.

## CustomApp evolution path

Everything in this plan is structured so the DemoApp PoC isn't throwaway. The migration to CustomApp is:

| Concern | DemoApp (PoC) | CustomApp |
|---|---|---|
| Workspace identity | Hardcoded `'demo-workspace'` | Authenticated account/tenant ID |
| Material storage | IndexedDB blobs | S3 / R2 / Supabase Storage objects |
| Material metadata | IndexedDB records | Postgres rows |
| Texture URLs | Blob URLs (session-scoped) | CDN URLs (stable) |
| Upload destination | Browser-local | Presigned URL → cloud bucket |
| Parser invocation | Browser at upload time | Server-side worker on upload-complete |
| Catalog fetch | IndexedDB scan at App init | Authenticated API call |
| Resolver indirection | Required (Blob URLs are session-scoped) | Still useful (protects against CDN moves, environment variation) |

The only code that gets rewritten in the migration is the `WorkspaceMaterialStore` implementation and the catalog-fetch logic in App init. The resolver, picker, capture schema, upload UI shell, and Viewer contract all stay as-is.

## Path B as future opportunity

This plan keeps the curated catalog in-repo (Path A). When the curated catalog grows past what's comfortable to ship in a deploy, or when a non-engineer needs to add curated materials without engineering involvement, the platform catalog migrates to the same cloud storage as workspace materials, served through the same API with `source: 'platform'`. The App-side resolver doesn't change. The static [`materialManifest.js`](https://github.com/EBjornson/BPViewer/blob/main/src/config/materialManifest.js) and [`generate-material-manifest.mjs`](https://github.com/EBjornson/BPViewer/blob/main/scripts/generate-material-manifest.mjs) are retired or repurposed as a CLI for seeding the platform bucket.

## Suggested commit / PR sequence

1. **Phase 1** — parser extraction. Pure refactor; build script unchanged in behavior.
2. **Phase 2** — `materialRef` schema + App-side resolver scaffolding (with platform-only resolution; workspace returns empty until Phase 3). New captures populate `materialRef`; old captures still replay via legacy URL fallback.
3. **Phase 3** — `WorkspaceMaterialStore` IndexedDB implementation. No UI yet; testable via console.
4. **Phase 4** — upload UI in DemoApp header.
5. **Phase 5** — merged picker + `viewerInput.materialCatalog` contract change. Update [Viewer Contract](viewer_contract_v1_8.md) doc in the same PR.
6. **Phase 6** — lifecycle UX polish.
7. **Phase 7** (deferred) — resolution-variant selector.

## Open considerations for implementation time

These didn't need decisions during planning but should be revisited when implementing:

- **Texture validation depth.** Beyond filename pattern matching, do we validate image dimensions / power-of-two / max file size? Probably yes for CustomApp; minimal for DemoApp PoC.
- **Naming conflicts.** What happens when a workspace material's `familyId` collides with a platform `familyId`? Source-tagged identity already disambiguates internally; UI-side, surface a "(Yours)" suffix to avoid user confusion in the picker.
- **Texture format.** Today the build-time script accepts `.jpg` / `.png` (whatever the zips contain). Worth deciding before CustomApp whether to standardize on a format and/or transcode to KTX2 for GPU compression. Out of scope for PoC.
- **Audit trail.** CustomApp will likely want createdBy/createdAt/updatedAt on workspace materials. Schema-add these to the metadata record now (DemoApp populates trivially) so the shape is correct from day one.
