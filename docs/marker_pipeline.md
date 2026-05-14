# Marker Pipeline

**Primary reader:** Engineer or advanced author tracing how a marker in a `.glb` becomes runtime behavior, and when (or whether) that behavior persists in a capture.
**Job-to-be-done:** Understand the end-to-end pipeline for each marker family on a single page — what the resolver extracts, which hook consumes it, and what survives a capture/replay.
**Next docs:** [Model Authoring Guide](model_authoring_guide.md) · [Capture & Replay](capture_and_replay.md) · [Architecture](architecture.md)

---

## Why this doc exists

The Viewer recognizes five marker families authored as substrings in node names: **Spaces** (`_RM` / `_DW`), **Lights** (`_PL` / `_SL[<degrees>]`), **Pivots** (`_<degrees><CW|CCW>`), and **Slides** (`_SD<mm>`). Each family has its own resolver, its own runtime consumer, and its own (or no) place in the capture/replay pipeline.

The authoring conventions are documented in the [Model Authoring Guide](model_authoring_guide.md) and the capture lifecycle is documented in [Capture & Replay](capture_and_replay.md), but the connecting view — *what happens between a node name and a stored capture payload* — lives spread across resolvers, runtime hooks, the visibility/material pipeline, and the Authoring Panel. This doc is that connecting view.

---

## The shared pipeline shape

Every marker family follows the same broad sequence:

```
.glb load                    runtime                       admin authoring
─────────                    ───────                       ───────────────
GLTF nodes                   React hooks /                 capture button →
   │                         components                    identity-free
   ▼                            │                          payload →
prepareLoadedModel()             ▼                         ViewerOutput callback →
   │  assignStableScenePaths    consume descriptors        App stores →
   ▼                            ▼                          ViewerInput replay
markerResolver.X()           render lights / animate       (or: session-only,
   │  produce descriptors     pivots / fade visibility /   never captured)
   ▼                          route clicks
ViewerRuntime memo
```

A few cross-cutting notes:

- **First-matching-ancestor-wins.** All resolvers walk the scene with the same primitive in markerUtils.js:49 (`walkFirstMatchAncestors`); once a node matches, descendants are not re-considered. SketchUp's instance-of-definition wrappers inside a marker component are absorbed transparently.
- **Geometry IDs are upstream of all of this.** During model preparation, `assignStableScenePaths` writes a stable scene-graph path into `userData.geometryId` for every mesh. Captures (visibility lists, material assignments, light hide-propagation) all key off these IDs. **Re-exporting a model with renames, regroupings, or reordering inside a marker container can change the IDs and invalidate existing captures** — there is no auto-migration.
- **Visible vs. helper-only marker subtrees.** Space and Light markers wrap *authoring helpers* (boxes, cones, spheres) that exist only so the SketchUp author can locate the marker; their meshes are hidden at load via `hideMarkerSubtree` and tagged `userData.isHiddenMarker = true` so `useSceneVisibility` skips them. Pivot and Slide markers wrap *visible product geometry* (the swinging door slab, the sliding sash) — their descendants stay rendered and animate as a rigid unit.
- **Captured vs. session-only.** Of the four families, only **Spaces** and **Lights** appear in capture payloads (indirectly — see each family's section). **Pivots** and **Slides** are session-only: clicking opens or closes them, page reload returns to closed, no payload field carries their state.

---

## Marker ownership: Viewer vs CustomApp

The marker conventions documented in this file — Spaces, Doorways, Entries, light markers, pivot/slide markers, and the per-mesh property prefixes (`Glass_*`, `Water_*`, `Fixture_*`, `Emissive_*`) — are **the Viewer's slice**: every one drives the Viewer's own runtime behavior (rendering, navigation, lighting, click-to-toggle interactions, shadow/visibility decisions). The Viewer parses these and only these.

**Anything else in the scene-graph passes through untouched.** Author-defined containers, custom naming conventions, arbitrary `userData` fields — none of it is read by the Viewer, none of it conflicts with the Viewer's parsing, and none of it requires a Viewer-side feature to be useful. CustomApps own this territory: they define their own SketchUp authoring rules for App-specific concerns and parse them on the loaded model directly.

This split has practical consequences worth knowing up front:

- **CustomApps don't need Viewer changes to add new markers.** Want a `BOM` container that groups all bill-of-materials components for client-side extraction? A `THERMAL_*` family for energy-takeoff? Per-mesh metadata for asset tagging? All entirely App-side. Author the SketchUp convention, parse it in your CustomApp, done. The Viewer doesn't need to know.

- **CustomApps access model contents by parsing the `.glb` themselves.** The Viewer doesn't currently expose a handle to its parsed `Object3D` tree. Two extraction options, each cheaper than the other for different use cases:
  - **Lightweight: parse the GLB binary's JSON chunk directly.** A `.glb` file is a 12-byte header + JSON chunk + BIN chunk. The JSON chunk is a flat `nodes` array where each entry has `name` and `children` (indexes into the same array). For *name-based marker extraction* — finding all nodes named `BOM`, all nodes whose name matches `THERMAL_*`, etc. — a `DataView` walk of the header + `JSON.parse` of the chunk + a single pass over `nodes` is sufficient. Zero deps, no `three-stdlib`, no `GLTFLoader`. ~100 lines of code total. Use this for any marker convention that's just "find named nodes and roll up by base name."
  - **Full: load via `GLTFLoader` (`three-stdlib` or `three.js`).** Needed when the CustomApp's marker convention requires geometry traversal, material introspection, transform math, or any other scene-graph query that the JSON chunk's structural metadata doesn't expose. Heavier (pulls in three.js if not already present) but the right answer for richer use cases.

  Either way, two parses of the same `.glb` file (one for App-side marker extraction, one for the Viewer's rendering) costs a few milliseconds at load time — cheap compared to the architectural simplicity.

- **The Viewer's marker surface stays small and stable.** Additions to the conventions in this doc require Viewer code changes, are subject to the same backward-compat care as the rest of the contract, and stay focused on rendering/navigation needs. If a new marker idea doesn't fit that scope, it belongs in the CustomApp's authoring conventions, not here.

- **SketchUp's `#`-suffix copy convention applies.** When a SketchUp author duplicates a component inside their model, the duplicates get a `#N` suffix on their name (`DWV_4in_Pipe`, `DWV_4in_Pipe#2`, `DWV_4in_Pipe#2_1`, etc.). CustomApps parsing model nodes for marker-name matching should strip everything from the first `#` to roll up duplicates by base name (`name.split('#')[0]`). The Viewer's resolvers already handle this for marker types they consume; CustomApp parsers should too.

The boundary keeps the Viewer's authoring complexity bounded while opening unbounded space for App-specific marker conventions per CustomApp. **Worked example**: a real walkthrough/inspection CustomApp groups all BOM-relevant components inside a single SketchUp container named `BOM` at authoring time. The CustomApp parses the uploaded `.glb`'s JSON chunk directly (lightweight option above), scans the `nodes` array for nodes literally named `BOM`, takes their direct children, strips `#`-suffix copy markers, and rolls up by base name — entirely client-side, ~100 lines of code, no Viewer-side parser/contract field/callback involved.

---

## Spaces — `_RM` / `_DW`

Author rooms (`_RM`) and connections (`_DW`) — the runtime turns these into a navigation graph used by camera routing, the Rooms panel, the floor-tile-click in overhead view, and the Floor Nav debug tools.

```
_RM / _DW node ─► resolveSpaces ─► useViewerNavigation ─► (no capture)
                  → spaces[]       graph routing,         camera pose IS
                  → entries[]      walkToLocation,        captured (in
                  → doorways[]     walkToFloorPoint,      section captures);
                                   walkToCapturedPose     graph itself is not
```

### Author writes

A node whose name contains `_RM` (room) or `_DW` (doorway), with the boundary rule (preceded by `_`, followed by `_` or end-of-name). Doorway leaves are `<RoomA>_<RoomB>` for interior connections or `Exterior_<RoomName>` for entries. PascalCase room names — see [Navigation Marker Conventions](model_authoring_guide.md#navigation-marker-conventions) for full authoring rules and edge cases.

### Resolver extracts

`resolveSpaces` walks the scene and returns `{ spaces, entries, doorways }`. Each descriptor carries:

- `id`, `label` (humanized), `type` (`'space' | 'entry' | 'doorway'`)
- `node`, `meshes`, `meshIds`
- `box`, `center`, `size` (world-space bounds — `prepareLoadedModel` recenters the model before this runs)
- `connectedLocationId` / connection metadata, populated by `resolveDoorwayConnections` and `resolveEntryConnections`

The resolver also calls `hideSpaceMarkerMeshes`, hiding visible authoring helpers under each marker subtree.

### Runtime consumes

The descriptors flow into `ViewerRuntime.jsx:360` (`interiorConstraintData`) and from there into:

- `useViewerNavigation` — builds a `buildNavigationGraph` and exposes `walkToLocation`, `walkToCapturedPose`, `walkToFloorPoint`, `walkToExteriorPoint`, `walkToDefaultInterior`, `directNavTo`. Camera routing through doorways uses `findNavigationPath` over this graph.
- The **Rooms panel** (`SpaceMenu`) — renders a clickable list of spaces and entries. Clicks call `walkToLocation` and only move the camera (no presentation/visibility change).
- **Overhead floor-tile click** — when a section is captured with `cameraMode: 'overhead'` and the user clicks a recognized `_RM` room face, `walkToFloorPoint` routes the camera into the interior space. **No callback fires.** During the dive, the Viewer auto-suspends the section's `sectionHiddenGeometryIds` (typically the roof) so the user can see what they've dived into; reapplies when the camera returns to overhead. See [Overhead Floor-Tile Click](capture_and_replay.md#overhead-floor-tile-click) for details.
- **Floor Nav / NavPath debug overlays** — visualize the walkable landing zones derived from `_RM` bounds and the path-graph segments between rooms.
- **Auto-mode lights** — when `lightSourceMode === 'auto'`, `SceneLights` places one point light per resolved `space`.

### Fallback when no markers are authored

When a model has no `_RM` / `_DW` markers, the navigation graph is empty and pathNav has no route to build. In that state the camera-routing table's three `pathNav` cells swap to a `directInterior` strategy:

- **Quickview Interior** → camera lerps to bbox center at standing height.
- **Floor-click** (interior or overhead) → camera lerps to the clicked point at standing height.

Target heading preserves the camera's current view direction (leveled to horizontal, with the canonical interior down-tilt applied) — same as authored floor-click via `buildFloorPointDestinationPose`. Looking-straight-down sources (overhead → interior) fall back to facing the model's south side. No entry-approach orbit, no doorway choreography — pure direct lerp. A bbox-wide floor hotspot is rendered in place of the missing per-room hotspots so floor-click has something to receive the click. Authored markers always win; this fallback only fires on quick / unauthored models. See `buildDirectInteriorPose` and `pickStrategy`.

### Captures interact

**No payload field references space markers directly.** The graph is rebuilt from the model on every load.

What *is* captured is camera state that *resulted from* navigating the graph: the `pose` and `cameraMode` in a section capture record where the camera ended up, regardless of whether the author got there by clicking a room, walking through a doorway, or dragging the orbit. Replay restores the pose without re-running graph navigation — `walkToCapturedPose` is used when the App wants to animate through the graph to a captured pose, but a direct pose set works too.

### Replay

On model load, the graph rebuilds from the scene. Section replay restores `pose` / `cameraMode` / `presentation` / `visibilityAssignments` from the section capture; the graph is whatever the current model produces. If markers were renamed or restructured between authoring and replay, the graph differs but the captured pose still applies — the camera just doesn't know which "room" it is in until the user moves.

---

## Lights — `_PL` / `_SL[<degrees>]`

Spawn point and spot lights at marker world positions. Unique among the marker families because the runtime output is **gated by capture-driven visibility**: a light bound to a fixture hides automatically when the fixture's geometry is hidden.

```
_PL / _SL node ─► resolveLightMarkers ─► visibleLightMarkers ─► SceneLights ─► (no light-marker capture;
                  → point[]              filter against         renders          but visibility & lightSourceMode
                  → spot[]               hiddenGeometryIds       point/spot       ARE captured — see below)
                  + boundGeometryIds                            lights
```

### Author writes

A node whose name contains `_PL` (point) or `_SL[<degrees>]` (spot, default 90° full beam if degrees omitted). Bound vs. unbound rule: wrap markers and only that fixture's geometry under a dedicated parent component to make the light hide-propagate; loose markers under structural top-level containers stay always-on. Full rules and the spot-housing-occlusion authoring caveat are in [Lighting Marker Conventions](model_authoring_guide.md#lighting-marker-conventions).

### Resolver extracts

`resolveLightMarkers` returns `{ point: [...], spot: [...] }`. Each descriptor carries:

- `id`, `type`, `node`, `position` (world)
- For spots: `direction` (world, marker's local −Z), `angleDegrees` (parsed from `_SL<n>` or `null` → defaults to 90° at render time)
- `boundGeometryIds` — geometry IDs of mesh descendants of the marker's *parent* that are not inside any sibling marker subtree. Empty array means unbound (always-on).

The resolver also hides visible authoring helpers (sphere/cone meshes) inside each marker subtree.

### Runtime consumes

Resolution happens in `ViewerRuntime.jsx:163`. The `boundGeometryIds` field is then consumed by the **`visibleLightMarkers` filter** at `ViewerRuntime.jsx:328`:

- A marker passes through if `boundGeometryIds` is empty (unbound) **or** at least one bound mesh is *not* in the active hide set computed from `effectiveInput.scene.visibilityAssignments`.
- This is the only place where capture state (visibility) gates a marker family's runtime output. `useSceneVisibility` applies the same hide rule to the meshes themselves; this filter is the parallel rule for the spawned lights.

The filtered set flows into `SceneLights` which renders point/spot lights based on `lightSourceMode`:

- `'import'` — render the resolved `_PL` / `_SL` markers, with `boundGeometryIds`-based hide-propagation.
- `'auto'` — ignore markers; place one point light per resolved `_RM` space (via `navigationSpaces`).
- `'none'` — render nothing.

A `hasLightMarkers` boolean (`point.length > 0 || spot.length > 0`) is also passed to `useViewerPresentationState` to drive the smart default for an uncaptured `lightSourceMode` — see *Replay* below.

### Captures interact

Light markers themselves are **not** captured (they're a property of the loaded model). What *is* captured and affects which lights render:

- `presentation.lightSourceMode` (`'import' | 'auto' | 'none'`) — captured per presentation mode (and embedded in section captures via the presentation snapshot).
- `scene.visibilityAssignments` (`hiddenGeometryIds` / `sectionHiddenGeometryIds` / `shownGeometryIds` / `isolatedGeometryIds`) — section-captured. The `visibleLightMarkers` filter consumes this to decide which fixture-bound lights stay on.

So a section that hides a light's fixture geometry will *also* hide its bound lights at replay; that's the whole point of binding.

### Replay

On replay, the App pushes `viewerInput.presentation.lightSourceMode` and `viewerInput.scene.visibilityAssignments`. The Viewer re-resolves markers from the model, then filters them against the new visibility set, then renders. The `lightSourceMode` smart default fires only when the captured value is missing (`'import'` if markers are detected, `'auto'` otherwise) — captured values always win. See `useViewerPresentationState.js`.

---

## Pivots — `_<degrees><CW|CCW>`

Click-to-rotate hinged geometry — doors, casement windows, lids. **Session-only**: state is not captured, not persisted, and does not affect path navigation.

```
_<deg><CW|CCW> node ─► resolvePivotMarkers ─► useScenePivots ─► PivotAnimationController ─► (NOT captured)
                       → pivots[]             pivotStateRef     useFrame rotates              clicks open/close
                       (visible meshes        + togglePivot     state.node.rotation.z         until reload
                       stay rendered)         + meshIdToPivotId
                                                ▲
                                                └─ Model.jsx onClick (consumer mode only)
```

### Author writes

A group whose name contains `_<degrees><CW|CCW>` (e.g. `BedroomDoor_90CCW`). Authoring requirements: SketchUp **Change Axes** so the local origin sits at the hinge edge and blue (Z) axis points up. CW/CCW is "as viewed from above." Full authoring rules in [Pivot Marker Conventions](model_authoring_guide.md#pivot-marker-conventions).

### Resolver extracts

`resolvePivotMarkers` returns one descriptor per pivot:

- `id`, `node`
- `descendantMeshes` — used to build the click-routing map
- `closedZRotation` (the authored Z rotation, treated as "closed")
- `openDelta` (signed radians; sign comes from CW/CCW direction)
- `degrees`, `direction`
- `closedBoundsCenter`, `closedBoundsRadius` — world-space bounds of the closed-pose geometry, used by the proximity auto-trigger

Unlike Spaces/Lights, descendant meshes are **not** hidden — they're the visible swinging geometry.

### Runtime consumes

`useScenePivots` owns per-pivot runtime state in a `pivotStateRef` map (`isOpen`, in-flight `anim`, references to `node` / `closedZRotation` / `openDelta`). It exposes:

- `togglePivot(pivotId)` — schedules an animation if the pivot isn't already animating
- `openPivot(pivotId)` / `closePivot(pivotId)` — state-aware variants used by the proximity auto-trigger; idempotent (no-op if already in the target state or mid-animation)
- `meshIdToPivotId` — `Map<meshUuid, pivotId>` used for click routing

Click routing in `Model.jsx:175` walks the picked mesh's ancestor chain looking up both `meshIdToPivotId` and `meshIdToSlideId`. **Pivot toggle fires only in consumer mode (`!adminEnabled`)** — in Admin Mode the toggle is suppressed so clicks on pivot geometry route to selection (for material assignment, hide/show, etc.) like any other mesh.

The frame-by-frame rotation update lives in `PivotAnimationController` so `useFrame` runs inside the Canvas. Animation duration and easing are shared with Slides via `MARKER_ANIMATION_DURATION` and `applyMarkerEasing` (cosine ease-in-out, 450 ms).

**Proximity auto-trigger.** Alongside click-to-toggle, `PivotProximityController` auto-opens pivots as the camera approaches and auto-closes them as the camera recedes — a small navigation pizazz that makes doors feel responsive when walking through interiors. Each frame, it measures the camera's distance to each pivot's `closedBoundsCenter` and fires `openPivot` / `closePivot` when the (hysteretic) thresholds are crossed. Constants live at the top of that file (`PIVOT_PROXIMITY_OPEN_DISTANCE`, `PIVOT_PROXIMITY_CLOSE_DISTANCE`); CLOSE > OPEN prevents oscillation; setting CLOSE to `Infinity` disables auto-close. Suppressed entirely in Admin Mode (admin clicks already route to selection — auto-open during inspection would be disorienting). Runs on the demand-loop only: a stationary camera produces no frames, so no work and no state change. Mid-animation events are dropped naturally by the existing reversal-ignore in `setPivotState`.

State resets to closed when the `pivots` array identity changes (i.e., a new model is loaded).

### Captures interact

**No.** Open/closed state is intentionally session-only:

- Section captures do not include pivot state.
- Option captures do not include pivot state.
- Path navigation ignores pivot state — the camera passes through closed doors regardless.

This is a deliberate design choice. Pivots are a runtime affordance for the user, not part of the configurable product state.

### Replay

There is nothing to replay. On every model load, every pivot starts closed. If admin authored a section while a door was open, the screenshot in `onRenderCaptured` reflects the open door; the section capture itself doesn't.

---

## Slides — `_SD<mm>`

Click-to-translate panels — pocket doors, sliding sashes, drawers. Same architecture as Pivots, including the session-only treatment.

```
_SD<mm> node ─► resolveSlideMarkers ─► useSceneSlides ─► SlideAnimationController ─► (NOT captured)
                → slides[]             slideStateRef    useFrame moves                clicks open/close
                (visible meshes        + toggleSlide    state.node.position           until reload
                stay rendered)         + meshIdToSlideId
                                         ▲
                                         └─ Model.jsx onClick (consumer mode only)
```

### Author writes

A group whose name contains `_SD<mm>` (integer millimeters; `_SD800` slides 800 mm). Authoring requirements: SketchUp **Change Axes** so the local +X axis points the way the panel slides open. Why integer mm — exporters strip periods from component names. Full rules in [Slide Marker Conventions](model_authoring_guide.md#slide-marker-conventions).

### Resolver extracts

`resolveSlideMarkers` returns one descriptor per slide:

- `id`, `node`, `descendantMeshes`
- `closedPosition` — the authored local position (the "closed" pose)
- `distance` — slide distance in **meters** (parsed from mm)
- `distanceMillimeters` — original parsed value for logging

### Runtime consumes

`useSceneSlides` parallels `useScenePivots` exactly: per-slide state in a `slideStateRef` map, `toggleSlide`, `meshIdToSlideId`. The frame-by-frame position update lives in `SlideAnimationController`.

The non-obvious bit is the open-position computation:

- The marker's local +X is converted to a **world-space** direction via `getWorldQuaternion`.
- The world open position is `closedWorld + worldDir * distance` (in meters).
- That world position is then converted back to **parent-local** space so it can drive `node.position` directly during animation.

This survives any parent scale baked into the SketchUp glTF export (typical exports have a 0.0254 inch→meter scale on a wrapper node) — `_SD800` always means 800 mm in the rendered scene.

Click routing in `Model.jsx:175` walks ancestors checking both pivot and slide maps; **pivot wins ties** when both match the same ancestor. As with pivots, the toggle fires only in consumer mode.

### Captures interact

**No.** Same as Pivots: open/closed state is session-only, ignored by path navigation, never captured.

### Replay

Nothing to replay. Every model load starts every slide closed.

---

## Quick reference

| Family | Pattern | Resolver | Runtime | In capture payload? |
|---|---|---|---|---|
| Space (room) | `_RM` | spaceResolver.js | useViewerNavigation, `SpaceMenu`, `SceneLights` (auto mode), Floor Nav debug | No (re-derived from model). Captured camera pose may *result from* navigating the graph. |
| Doorway | `_DW` | spaceResolver.js | Same — feeds the navigation graph | No |
| Point light | `_PL` | lightMarkerResolver.js | SceneLights (import mode), `visibleLightMarkers` filter in ViewerRuntime | No (markers re-resolved from model). `presentation.lightSourceMode` and `scene.visibilityAssignments` *are* captured and gate which lights render. |
| Spot light | `_SL[<degrees>]` | lightMarkerResolver.js | Same as point | Same as point |
| Pivot | `_<degrees><CW|CCW>` | pivotMarkerResolver.js | useScenePivots, PivotAnimationController, click routing in Model.jsx | **No — session-only.** Open/closed never persists. |
| Slide | `_SD<mm>` | slideMarkerResolver.js | useSceneSlides, SlideAnimationController, click routing in Model.jsx | **No — session-only.** Same as pivot. |

---

## What this doc deliberately omits

- **Authoring conventions** (substring rules, hierarchy patterns, axis placement) — those are in [Model Authoring Guide](model_authoring_guide.md).
- **Capture payload shapes and replay strategies** — those are in [Capture & Replay](capture_and_replay.md) and [Viewer Contract](viewer_contract_v1_8.md).
- **Per-mesh shadow prefixes** (`Glass_*`, `Water_*`, `Fixture_*`) and **emissive material prefixes** (`Emissive_*`) — these are not marker families; they apply to individual meshes/materials at load time and are documented in the model authoring guide.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
