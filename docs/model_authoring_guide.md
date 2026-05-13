# Model Authoring Guide

**Primary reader:** 3D modeler (typically a SketchUp user) preparing a `.glb`
**Job-to-be-done:** Prepare a model that behaves predictably in the Viewer
**Next doc:** [Admin Authoring Guide](admin_authoring_guide.md)

---

## Purpose

This guide is for the people preparing `.glb` files for the Viewer.

It explains:

- how to name navigation markers
- what hierarchy patterns help the Viewer work well
- how stable geometry targeting works
- what makes a model easier to configure, replay, and persist

The goal is not to force one artistic workflow. The goal is to help exported models behave predictably in the Viewer.

---

## The Big Idea

The Viewer works best when the model is:

- clearly structured
- consistently named
- exported in a stable hierarchy
- prepared with simple helper geometry for navigation markers

You do **not** have to author every product the same way visually.

But you **do** want the exported scene graph to be disciplined.

---

## What The Viewer Uses From The Model

The current stable viewer relies on these kinds of model information:

### 1. Renderable geometry

This is the actual product geometry that users see.

Examples:

- roof parts
- walls
- siding
- doors
- cabinetry
- solar panels

### 2. Stable geometry identity

At load time, the Viewer assigns each mesh a stable `geometryId` based on its scene hierarchy path.

That means:

- hierarchy order matters
- object names matter
- repeatable exports matter

If the exported hierarchy changes significantly, the generated `geometryId` values may also change.

That can affect:

- saved visibility mappings
- saved material mappings
- option associations
- persistence across reloads

### 3. Navigation markers

A node whose name contains `_RM` (room) or `_DW` (doorway) — followed by `_` or end-of-name — describes a walkable space or a connection between spaces. Markers can sit anywhere in the scene tree.

```
LivingDining_RM             (walkable interior space)
Hall_FrontBedroom_DW        (connection between two rooms)
Exterior_LivingDining_DW    (entry from outside into the named room)
```

Marker meshes are removed from the scene at load — only the marker node's transform/bounds are read. See [Navigation Marker Conventions](#navigation-marker-conventions).

### 4. Lighting markers

A node whose name contains `_PL` (point) or `_SL[<degrees>]` (spot) — followed by `_` or end-of-name — spawns a light at its world position. The suffix can sit anywhere in the name; authors typically put it at the end.

```
EntranceUpBulbs_SL90        (spot, 90° beam)
KitchenAccent_SL45          (spot, 45° beam)
RoomLights_PL               (point light)
```

The marker's world transform origin is the light position; for spots, local −Z is the beam direction. Visible helper geometry inside the marker is for SketchUp authoring only.

Wrapping a marker as a sibling of a fixture's geometry inside a dedicated parent component **binds** the spawned light to that fixture: the light hides automatically when the fixture's geometry is hidden by a section/option capture. Loose markers placed at structural top levels are unbound and stay on regardless. See [Lighting Marker Conventions](#lighting-marker-conventions).

### 5. Shadow behavior prefixes

These are **per-mesh** name prefixes (different from the container markers above) that adjust how individual meshes interact with the shadow system:

- `Glass_*` — transparent glazing; shadow casting disabled
- `Water_*` — water surfaces; shadow casting disabled
- `Fixture_*` — translucent fixture parts (shades, etc.); shadow casting disabled

See the [Shadow Naming Conventions](#shadow-naming-conventions) section for full details.

### 6. Pivot markers (click-to-rotate)

Any group whose name contains a `_<degrees><CW|CCW>` substring becomes a click-to-rotate pivot — useful for doors, casement windows, lids, and similar hinged geometry. The marker's local axis origin is the hinge; rotation happens around the SketchUp blue (vertical) axis. State is session-only — pivots open or close in response to user clicks but the open/closed state is not captured or persisted across reloads.

See [Pivot Marker Conventions](#pivot-marker-conventions) for full details.

### 7. Slide markers (click-to-slide)

Any group whose name contains a `_SD<distance>` substring becomes a click-to-slide group — useful for pocket doors, sliding sashes, drawers, sliding car/casement windows, and similar geometry that translates rather than rotates. The marker's local axis origin is the closed-state position; the local **+X axis** is the open direction; distance is in **millimeters** (integer). State is session-only.

See [Slide Marker Conventions](#slide-marker-conventions) for full details.

---

## Minimum Good Model Checklist

For a model to behave well in the current stable viewer, try to satisfy these:

- exported as `.glb`
- hierarchy is stable across exports
- meaningful object names where possible
- if using navigation markers: each room named with `_RM` suffix; each connection named with `_DW` suffix (and the `<RoomA>_<RoomB>` or `Exterior_<RoomName>` form)
- if using lighting markers: marker components named with `_PL` (point) or `_SL[<degrees>]` (spot) suffix; for fixture-bound lights, wrap the markers and the fixture geometry under a shared parent component
- if using pivot markers: each marker group's axes set with origin at the hinge edge and the blue axis pointing up
- if using slide markers: each marker group's axes set with origin at the closed-state reference point and the **red (+X) axis** pointing in the open direction
- room/doorway/entry/light marker names follow the conventions in this guide
- helper markers roughly match the physical walkable/opening volumes they represent

---

## Hierarchy Guidance

### Keep the hierarchy stable

This matters a lot.

Because stable `geometryId` values are derived from hierarchy path, the Viewer is happiest when:

- sibling order is stable
- names are stable
- the product is exported consistently from version to version

If a mesh moves to a different branch or gets renamed casually, its stable `geometryId` may change.

### Use meaningful names when practical

Good names help:

- debugging
- authoring
- hierarchy inspection
- communication between modeling and app teams

Examples of good names:

- `Roof_Assembly`
- `Siding_Panels`
- `Solar_Array`
- `Front_Entry_Door`

The system can still function with weaker names, but meaningful names reduce friction.

### Avoid unnecessary randomization

If the exporter or modeling workflow produces:

- unstable naming
- unstable grouping
- unstable object order

then persistence and mapping become harder.

---

## Navigation Marker Conventions

Adds room navigation, doorway connections, and exterior entries to the model. The viewer surfaces these as a clickable Rooms panel for end users and uses the connection graph to route the camera between rooms via doorways.

> **No markers? Quickview Interior and floor-click still work.** When a model has zero `_RM` / `_DW` markers the camera-routing pathNav cells fall back to a direct lerp at standing height — bbox center for Quickview Interior, the clicked point for floor-click (a bbox-wide floor hotspot replaces the per-room hotspots). Target heading preserves the camera's current view direction (same math as authored floor-click), so the camera doesn't snap on every navigation. Authored markers always win; this fallback is for quick / unauthored models intended for internal use. See [marker_pipeline.md → Fallback when no markers are authored](marker_pipeline.md#fallback-when-no-markers-are-authored).

### Marker name suffix

A node whose name contains `_RM` (room) or `_DW` (doorway) — preceded by `_` and followed by `_` or end-of-name — is a navigation marker. Markers can live anywhere in the scene tree; there is no top-level container.

| Example name | Meaning |
|---|---|
| `LivingDining_RM` | walkable interior space (room) |
| `Hall_FrontBedroom_DW` | interior connection between two rooms |
| `Exterior_LivingDining_DW` | entry from outside into the named room |
| `LivingDining_RM_1` | SketchUp auto-suffixed duplicate of the above room |
| `Hall_FrontBedroom_DW_2` | SketchUp auto-suffixed duplicate doorway |

Matching is case-insensitive and the suffix can appear anywhere in the name; authors typically place it at the end. The first matching ancestor wins — once a node is identified as a marker, its descendants are not re-considered. SketchUp's instance-of-definition wrapper nodes inside a marker component are silently absorbed.

Marker meshes are SketchUp authoring helpers — they're hidden at load (`visible = false`, tagged `userData.isHiddenMarker = true`) and never rendered. Only the marker node's transform/bounding box drives runtime behavior.

**The substring is required.** A node without it is not a navigation marker, regardless of name or hierarchy position. This is also how you opt OUT — leave the substring off and the node is invisible to the navigation system.

> **Authoring caution:** avoid `_RM` / `_DW` substrings (with the leading-`_` / trailing-`_`-or-end boundary) on non-marker node names — those would be picked up as markers. Names like `DW_Glass_Door` (no leading `_`) or `FARM_Workshop` (no `_RM_` boundary) are safe.

### Rooms (`_RM`)

Each `_RM` node is a walkable space. The marker's bounding box represents the volume of that room.

```
LivingDining_RM
Hall_RM
FrontBedroom_RM
RearBedroom_RM
Bathroom_RM
```

Room names are free-form, but **PascalCase with no underscores in the room portion** keeps doorway parsing unambiguous (see below). `LivingDining_RM` works; `Living_Dining_RM` does not.

### Doorways (`_DW`)

Each `_DW` node encodes a connection. The portion of the name preceding `_DW` follows one of two patterns:

| Pattern | Meaning | Example |
|---|---|---|
| `<RoomA>_<RoomB>_DW` | Interior connection between two rooms | `Hall_FrontBedroom_DW` |
| `Exterior_<RoomName>_DW` | Entry from outside into the named room | `Exterior_LivingDining_DW` |

The single `_` between the two rooms (or between `Exterior` and the room) is what makes PascalCase room names a hard requirement. Both rooms named in a doorway must match (case-insensitively, after normalization) some `_RM` marker.

```
LivingDining_Hall_DW
Hall_FrontBedroom_DW
Hall_RearBedroom_DW
Hall_Bathroom_DW
LivingDining_RearHall_DW
RearHall_UtilityRoom_DW
Exterior_LivingDining_DW
```

**Multiple entries to the same room** (e.g. front and back doors both into `LivingDining`): use the same SketchUp definition for both instances. The exporter auto-disambiguates the second to `Exterior_LivingDining_DW_1`. The resolver strips the `_DW` suffix and any chained `_<digits>` duplicates before parsing, so both instances connect to the same room.

### Marker placement guidance

Markers should be simple and practical, not beautiful. A good marker:

- sits where traversal should happen
- roughly matches the opening or walkable zone
- is big enough to be reliably detected
- does not need to be visible in the final experience (its mesh is removed at runtime)

Box geometry is often ideal. The **Floor Nav** debug toggle in Admin Mode visualizes the actual walkable landing zone derived from each `_RM` marker, and the **NavPath** toggle shows the path-graph segments. Use these to verify markers produce sensible navigation.

---

## Lighting Marker Conventions

Adds point and spot lights to the scene at runtime. The viewer surfaces a Light Source Mode toggle (Import / Auto / None) so authored markers can be on, replaced with auto-placed point lights, or disabled.

### Marker name suffix

A node whose name contains `_PL` (point) or `_SL[<degrees>]` (spot) — preceded by `_` and followed by `_` or end-of-name — spawns a light at its world position. Markers can live anywhere in the scene tree; there is no top-level container.

| Example name | Meaning |
|---|---|
| `RoomLights_PL` | point light |
| `EntranceUpBulbs_SL90` | spot light, 90° full beam |
| `KitchenAccent_SL45` | spot light, 45° full beam |
| `EntranceUpBulbs_SL` | spot light, default 90° (degrees omitted) |
| `EntranceUpBulbs_SL90_1` | SketchUp auto-suffixed duplicate of the above |
| `modelskp_RoomLights_PL_1_6` | chained SketchUp duplicates; matches as point |

The `<degrees>` value (when present) is the **full beam angle**; default is 90° when omitted. The cyan **SpotLightHelper** cone (visible when the "Spot Cones" toggle in the admin debug panel is on) reflects each marker's actual angle — useful for verifying the suffix was parsed correctly.

Matching is case-insensitive and the suffix can appear anywhere in the name; authors typically place it at the end. The first matching ancestor wins — once a node is identified as a marker, its descendants are not re-considered. SketchUp's instance-of-definition wrapper nodes inside a marker component are silently absorbed.

Visible authoring helpers (a sphere or cone mesh inside the marker component) are for SketchUp orientation only. They're hidden at load (`visible = false`, tagged `userData.isHiddenMarker = true`) and never rendered.

**The substring is required.** A node without it is not a light marker, regardless of name or hierarchy position. This is also how you opt OUT — leave the substring off and the node is invisible to the lighting system.

> **Authoring caution:** avoid `_SL` / `_PL` substrings (preceded by `_` and followed by `_` or end of name) on non-marker nodes — those would be picked up as markers. Per-mesh prefixes like `Fixture_*`, `Glass_*` are safe (no trailing `_SL` / `_PL`).

### Bound vs. unbound lights

A marker is **bound to a fixture** when its parent container also holds the fixture's geometry as siblings — i.e., the parent is a dedicated wrapper around the markers + that fixture's meshes. The spawned light is automatically hidden when every fixture mesh is in the active hide set (e.g. when a section/option capture hides the housing). This is what you want for sconces, lamps, chandeliers — anything visible.

A marker is **unbound** (always-on) when its parent is a structural top-level container holding lots of unrelated geometry — the "all hidden" condition is never satisfied, so the light stays on. This is what you want for ambient room-fill point lights with no visible fixture.

The rule is structural: the resolver collects the marker's parent's mesh descendants outside any sibling marker subtrees. If every one of those mesh ids is hidden, the light hides too. No special naming on the binding container is required.

#### Pattern A — bound (sconce with two lights)

```
Component#6_ExteriorRightLight                ← per-fixture wrapper
├── Component#1_EntranceDownBulbs_SL90        ← marker (rotated to point down)
├── Component#1_EntranceUpBulbs_SL90          ← marker (rotated to point up)
└── ExteriorFixture                            ← visible housing
    ├── Wall_Support
    └── Lamp
```

Hide `Wall_Support` + `Lamp` in a section/option → both spotlights hide.

#### Pattern B — unbound (ambient room point lights)

```
Assembly-277                                   ← top-level structural root
├── modelskp_RoomLights_PL                     ← marker (no per-fixture wrapper)
├── modelskp_RoomLights_PL_1
└── … (whole rest of the model alongside)
```

The parent has hundreds of mesh descendants outside the markers; in practice they're never all hidden together, so the lights stay on.

#### Authoring rule for binding

> **Wrap markers and only that fixture's geometry under a dedicated parent component.**

If you put unrelated geometry under the same parent, hide-propagation won't fire because the unrelated meshes will still be visible.

### Light marker placement

The system places each light at the marker NODE's **world transform origin** — i.e., the SketchUp component's insertion point. Not the bounding-box centre of any visible helper inside the marker.

Practical implications:

- To move just the light without touching the visual representation: drag the marker component in SketchUp (changes the instance transform → moves the origin).
- To move just the visible helper without changing the light: edit the geometry inside the component definition (changes mesh-local positions, doesn't affect the origin).
- The visible sphere/cone helper inside the marker can be any shape or size — its only job is to make the marker locatable and orientable in SketchUp.

For spot lights, the **aim direction** is the marker's local `−Z` transformed to world space (Three.js "forward"). Orient the marker component so its local `−Z` points where you want the cone to shine. The visible cone helper inside the component should be authored to match this orientation as a sanity check, but only the marker node's transform actually drives the light.

### Spot housing occlusion authoring rule

Marker-driven spot lights cast shadows; their cone is occluded by mesh geometry it intersects. Authoring rule:

> **The spot cone must clear the housing geometry.**

For wide-beam spots (~60°+) inside a fixture housing, the marker apex (= bulb position) needs to be outside the housing's open opening so the lateral cone spread doesn't interact with the housing walls. For narrow-beam spots (~30°), the bulb can sit deeper inside without issue — the tight cone barely spreads laterally.

When the bulb is inside a fixture housing AND the spot cone has meaningful lateral spread inside the walls, shadow occlusion silently fails. The mechanism isn't fully understood (extensive elimination history is in the project memory `project_spot_marker_authoring`); the practical fixes are either to narrow the beam angle or to move the marker apex outside the housing opening.

### Light Source Mode

The viewer's authoring panel offers a three-way toggle for how to source interior lights:

- **Import** — use the markers discovered by the `_PL` / `_SL` suffix convention (the rule this section describes).
- **Auto** — auto-place a single point light at the centre of each `_RM` (room) marker. Useful for models without authored light markers.
- **None** — no interior lights at all.

The toggle is **captured per presentation mode** (Day, Night, Night Interior, etc.). When loading a model that has authored light markers, uncaptured modes default to `Import`; when the model has no markers, they default to `Auto`. A captured value always wins over the smart default, so capture any mode you want to override.

---

## Pivot Marker Conventions

Adds click-to-rotate behavior to any group in the model — doors, casement windows, gates, lids, drawer pulls, hinged anything. The end user clicks the marker geometry; it swings open. Click again; it swings closed. Animation is ~0.45 s with eased motion.

State is **session-only**: pivots return to closed on page reload, are not stored in any capture, and do not affect navigation (the camera passes through closed doors regardless).

### Marker name suffix

A node whose name contains `_<degrees><CW|CCW>` (e.g. `_90CCW`, `_45CW`) — preceded by `_` and followed by `_` or end-of-name — is a click-to-rotate pivot. Markers can live anywhere in the scene tree; there is no top-level container.

| Example name | Meaning |
|---|---|
| `BedroomDoor_90CCW` | swings 90° counter-clockwise (viewed from above) |
| `KitchenWindow_45CW` | swings 45° clockwise |
| `FrenchDoor_120CW` | swings 120° clockwise |
| `30"_door_Bathroom_90CCW` | descriptive prefix + parameters; same behavior |

Matching is case-insensitive and the suffix can appear anywhere in the name; authors typically place it at the end. The first matching ancestor wins — once a node is identified as a pivot, its descendants are not re-considered. SketchUp's instance-of-definition wrapper nodes inside a marker component are silently absorbed.

Unlike navigation and lighting markers (whose helper meshes are hidden at load), pivot markers — like slide markers — wrap **visible geometry**: the door slab, the window pane, plus any handle/trim/frame children. The whole group swings as a unit when the rotation applies to the marker group's transform.

**The substring is required.** A group without it is not a pivot, regardless of name or hierarchy position. This is also how you opt OUT — leave the substring off and the group stays as static geometry.

> **Authoring caution:** the `_<degrees><CW|CCW>` substring is specific enough that accidental collisions with non-marker names are essentially impossible — but be aware that any group name matching this pattern (including unintended ones like `Section_30CW_View`) will be opted into pivot behavior.

### Hinge placement: SketchUp group axes

The marker's **local axis origin is the hinge position**, and rotation happens around the SketchUp blue (vertical) axis. SketchUp's glTF exporter preserves leaf-level Z-up, so a vertical blue axis at authoring time becomes the correct vertical hinge axis in the rendered scene.

Authoring steps:

1. In SketchUp, right-click the group/component → **Change Axes**.
2. Place the axis origin at the **hinge edge** — the side of the door/window that should remain stationary while the rest swings.
3. Keep the **blue axis pointing up**. This is SketchUp's default vertical orientation.
4. The red and green axes can point in whatever directions are natural for the geometry — only the origin position and blue-up matter for rotation.

Misplaced axes are the most common authoring mistake: the door swings around its centre or the wrong edge. Visually inspecting the group axes in SketchUp before exporting is the surest way to catch this.

### Direction: CW vs CCW

`CW` and `CCW` are interpreted **as viewed looking down from above** the model. CW rotates clockwise from that viewpoint; CCW rotates counter-clockwise. If a door swings into a wall instead of into the room after export, swap CW↔CCW in the name and re-export.

### Multi-panel pairs

A single pivot marker rotates as one rigid unit. For double-doors, French windows, or bi-fold panels that should swing independently, **promote each panel to its own marker** with the substring suffix and its own axis at its own hinge edge:

```
PatioDoor_LeftPanel_90CW
PatioDoor_RightPanel_90CCW
```

Each panel needs the **Change Axes** step done individually so its own hinge edge is the origin.

### What's not currently supported

- Open/closed state is not captured or persisted; pivots return to closed on every reload.
- Pivot state does not affect path navigation — the camera passes through doors regardless of pose.
- Reversing direction mid-swing is ignored (clicks during animation are dropped).
- Sound effects, latch animations, queued click chains, and hover affordances are not implemented.

---

## Slide Marker Conventions

Adds click-to-slide behavior to any group in the model — pocket doors, sliding sashes, drawers, sliding car/casement windows, and anything else that translates rather than rotates. The end user clicks the marker geometry; it slides open. Click again; it slides closed. Animation is ~0.45 s with eased motion.

State is **session-only**: slides return to closed on page reload, are not stored in any capture, and do not affect navigation (the camera passes through closed doors regardless).

### Marker name suffix

A node whose name contains `_SD<distance>` (e.g. `_SD800`, `_SD1200`) — preceded by `_` and followed by `_` or end-of-name — is a click-to-slide group. Distance is in **millimeters** (integer). Markers can live anywhere in the scene tree; there is no top-level container.

| Example name | Meaning |
|---|---|
| `PocketDoor_Bedroom_SD800` | slides 800 mm (0.8 m) along the group's local +X |
| `KitchenWindow_Sash_SD450` | sash slides 450 mm; +X authored as "up" |
| `CarDoor_Window_SD400` | sliding car window, 400 mm of travel |
| `PocketDoor_SD800_1` | SketchUp auto-suffixed duplicate; same behavior |

Matching is case-insensitive and the suffix can appear anywhere in the name; authors typically place it at the end. The first matching ancestor wins — once a node is identified as a slide, its descendants are not re-considered. SketchUp's instance-of-definition wrapper nodes inside a marker component are silently absorbed.

Unlike navigation and lighting markers (whose helper meshes are hidden at load), slide markers — like pivot markers — wrap **visible geometry**: the door panel, the sash, plus any handle/trim/hardware children. The whole group translates as a unit when the position update applies to the marker group's transform.

**The substring is required.** A group without it is not a slide, regardless of name or hierarchy position. This is also how you opt OUT — leave the substring off and the group stays as static geometry.

> **Authoring caution:** the `_SD<digits>` substring is specific enough that accidental collisions are unlikely, but be aware that any group name matching this pattern (e.g. `Brand_SD2024`) will be opted into slide behavior.

> **Why millimeters, not meters with decimals?** SketchUp and many glTF exporters strip periods from component/group names, so `ClosetDoor_SD0.58` becomes `ClosetDoor_SD058` at export time and silently changes meaning (58 m of slide instead of 0.58 m). Integer mm authoring is exporter-proof and matches typical architectural conventions. Decimals *are* still accepted by the regex if your toolchain happens to preserve them.

### Origin and direction: SketchUp group axes

The marker's **local axis origin is the closed-state reference point**, and motion happens along the SketchUp **red (+X) axis**. The author re-orients the group's axes so that +X points the way the panel slides open. SketchUp's glTF exporter preserves the group's local frame, so the +X direction at authoring time becomes the slide direction in the rendered scene.

Authoring steps:

1. In SketchUp, right-click the group/component → **Change Axes**.
2. Place the axis origin at any visually-obvious reference point on the panel — a corner is easiest. The slide is a rigid translation of the whole group, so origin location only affects which point you'll mentally track to verify travel; it does not change how the panel slides.
3. Aim the **red axis (+X) along the open direction**. For a pocket door that slides left into the wall, the red axis points left. For a car window that drops down, the red axis points down. For an upward-sliding sash, the red axis points up.
4. The green and blue axes can point in whatever directions are natural for the geometry — only the origin position and red-direction matter for sliding.

Misplaced or misoriented axes are the most common authoring mistake: the panel slides into the wrong place or the wrong way. Visually inspecting the group axes in SketchUp before exporting is the surest way to catch this.

### Distance units

`<distance>` is in **millimeters**, integer — `_SD800` slides 800 mm (0.8 m), `_SD1200` slides 1200 mm (1.2 m). Round mm values cover every practical architectural slide. Authors using SketchUp with imperial units should convert: a 24" travel ≈ `_SD610`, a 30" travel ≈ `_SD762`.

### Multi-panel slides

A single slide marker translates as one rigid unit. For double pocket doors, biparting sashes, or other geometry where panels move independently, **promote each panel to its own marker** with its own axis origin and own +X direction:

```
PocketDoor_LeftPanel_SD800
PocketDoor_RightPanel_SD800
```

Each panel needs the **Change Axes** step done individually so its own +X aims the right way.

### What's not currently supported

- Open/closed state is not captured or persisted; slides return to closed on every reload.
- Slide state does not affect path navigation — the camera passes through closed sliding doors regardless of pose.
- Reversing direction mid-slide is ignored (clicks during animation are dropped).
- Non-linear paths (e.g. a curved track) are not supported — motion is always a straight line along local +X.

---

## Authoring Debug Tools

Admin Mode exposes several debug tools in the bottom-right toolbar to verify your model authoring against the conventions in this guide.

### Hierarchy popup

Click **Hierarchy** in the admin debug toolbar to inspect the loaded scene's tree. The popup shows an indented hierarchy with two filters:

- **Markers only** (default ON) — narrows the view to ancestor paths leading to authored marker nodes (`_RM`, `_DW`, `_PL`, `_SL`, `_<deg>(CW|CCW)`, `_SD<distance>`). Visible product geometry, per-mesh shadow prefixes, and other authoring noise are hidden, so you see *just* your marker structure for verification. Inside each marker subtree the full hierarchy is shown verbatim so authors can sanity-check helper geometry and SketchUp wrapper structure.
- **Show meshes** (default OFF) — when off, mesh leaves are collapsed to a `… (N meshes)` summary. When on, every mesh is shown by name.

A **Refresh** button re-walks the live scene graph (handy if you load a different model with the popup open). A **Copy** button puts the formatted hierarchy on your clipboard — useful for sharing during authoring iteration.

### Spot Cones (cyan helpers + frustum)

Toggle **Spot Cones** in the admin debug toolbar to visualize each marker-driven spot light:

- A **cyan SpotLightHelper cone** shows the light's beam shape based on its position, aim direction, and angle (parsed from the marker name's `_SL<degrees>` suffix or the 90° default).
- A **wireframe CameraHelper pyramid** shows the spot's shadow camera frustum, including the near and far clip planes.

Use this to verify each spot is positioned and aimed correctly, that the beam angle matches what you intended, and that occluders (e.g., fixture housings) sit inside the frustum where you expect them. The Spot Cones toggle only takes effect when **Light Source Mode** is `Import`.

### Floor Nav and NavPath

Toggle **Floor Nav** to visualize the actual walkable landing zone derived from each `_RM` (room) marker (with the wall-margin buffer applied, so you see what users will actually click on, not the raw marker bounds). Toggle **NavPath** to visualize the path-graph segments pathfinding uses for camera routing between rooms via `_DW` doorways.

Both are useful for verifying the navigation graph the resolver builds matches your authoring intent — wrong-sized markers, missing doorways, and broken connections all show up immediately.

---

## Shadow Naming Conventions

The Viewer automatically controls shadow casting at load time based on object name prefixes.

### Objects that cast shadows (default)

All meshes cast shadows by default. No special naming required.

### Objects that do not cast shadows (automatic)

The following prefixes disable shadow casting automatically:

| Prefix | Intended use |
|---|---|
| `Glass_` | Window panes, skylights, glass doors, any transparent glazing |
| `Water_` | Water features, pools, reflective water surfaces |
| `Fixture_` | Translucent fixture parts (glass shades, frosted globes) where solid shadow casting would look wrong. Generic opaque fixture housings should NOT use this prefix — they'll cast shadow correctly by default and let you see the housing's silhouette in the spot light shadow. |

**Why this matters:**

Three.js shadow maps render geometry as fully opaque in the shadow pass regardless of material transparency settings. A window mesh named without `Glass_` will block sunlight as if it were a solid wall. Naming it `Glass_Window_Front` (or any `Glass_*` name) tells the Viewer to let light pass through.

All three types still **receive** shadows — only shadow casting is disabled.

### Naming rules

- Prefixes are **case-insensitive** — `Glass_`, `glass_`, and `GLASS_` all match. The recommended casing is the documented form (e.g. `Glass_*`) for readability across team members and exports.
- The prefix must be at the start of the mesh name, not a parent group name
- Anything after the prefix is free-form: `Glass_SlidingDoor`, `Water_Pool`, `Fixture_PorchLight` all work

### Example names

```
Glass_Window_Front
Glass_Window_Side_Left
Glass_Skylight
Water_Pool
Water_Feature_Rear
Fixture_PorchLight
Fixture_RecessedCeiling_01
```

---

## Geometry Grouping Guidance

The current stable authoring model lets admins associate geometry with options.

That is easier when configurable parts are logically grouped.

Helpful examples:

- all roof shingles grouped together
- solar panels grouped together
- siding panels grouped by side or system
- lights grouped by fixture or side

Less helpful examples:

- one configuration feature spread across many unrelated mesh fragments
- merged geometry that prevents selective association

You do not need to over-fragment the model, but configurable features should be targetable.

---

## Materials Guidance

At load time, the Viewer captures each mesh’s original material state.

That is used later for:

- restoring original appearance
- removing captured material associations

This means the export should start from a sensible “default look.”

Best practice:

- make the exported model’s base materials the true default presentation

That gives the restore path something meaningful to go back to.

### Model default material capture

The authoring workflow also supports an additional material layer: the admin can adjust any mesh’s material using the material tools and then click **Capture Material Defaults**. Those changes are stored as the model's baseline appearance and replayed automatically on every subsequent load, before any option assignments are applied.

This lets you fix or fine-tune the baseline appearance of the model — colour, texture, roughness — without re-exporting from SketchUp. Option assignments always override model defaults for the same geometry. When an option is deactivated, the mesh falls back to the model default (not the baked original) if a default exists.

---

## Texture UV Authoring

The Viewer’s material library lets admins apply real-world texture materials (wood, concrete, etc.) to any mesh. For those textures to display correctly, the mesh must have UV texture coordinates (`TEXCOORD_0`) in its GLTF export.

### The problem with flat-colour faces

When a face in SketchUp is painted with a solid colour and no texture, SketchUp’s GLTF exporter omits UV coordinates for that face entirely. When the Viewer tries to apply a texture library material to such a mesh, it has no UV data to work from and the texture cannot be sampled correctly.

### The fix: apply a placeholder texture in SketchUp

Any face you intend to retexture in the Viewer should have a texture applied to it in SketchUp — even a rough placeholder. The UV coordinates that SketchUp exports are determined by how that texture is scaled and positioned on the face, not by which texture image you used. The Viewer’s material library replaces the texture at runtime; it keeps the UV layout from SketchUp.

**Workflow:**

1. In SketchUp, paint the face with any texture (a solid-colour texture at 1 × 1 px is fine as a placeholder)
2. Adjust the texture scale on the face to set how large you want the pattern to tile in the final viewer — e.g. scale a wood grain placeholder to roughly the size of a real board
3. Export to `.glb`
4. In the Viewer, apply the real library material — it tiles at the scale you defined in step 2

### Fallback behaviour

If UV coordinates are missing, the Viewer auto-generates them using a world-space box projection (one texture tile per 4 world units, roughly one tile per 4 metres). This makes textures visible and gives a rough sense of the material, but the scale and alignment will rarely be correct for a finished look. Treat it as a preview aid, not an authoring target.

### Emissive materials

Meshes intended to glow (light bulbs, LED strips, illuminated panels) should have their material name prefixed with `Emissive_` in SketchUp:

```
Emissive_Bulb
Emissive_LedStrip_01
Emissive_CeilingLight
```

The Viewer detects this prefix at load time and enables emissive rendering for those materials. The `Emissive Intensity` slider in the authoring panel controls glow strength globally across all emissive materials. The emissive colour is derived from the material’s diffuse colour, so a warm-white bulb material produces a warm glow.

**Note:** the `Emissive_` prefix applies to the **material name** in SketchUp, not the object name.

---

## What To Avoid

Try to avoid:

- renaming objects casually between exports
- changing hierarchy structure without reason
- hiding important configurability inside huge merged meshes
- inconsistent marker naming
- navigation marker nodes named without the `_RM` / `_DW` suffix, or with the suffix in a position that doesn't satisfy the leading-`_` / trailing-`_`-or-end boundary
- light marker components named without the `_PL` / `_SL[<degrees>]` suffix, or with the suffix mid-name where it isn't followed by `_` or end-of-name
- bound-light markers placed in a parent container that also holds unrelated geometry — hide-propagation won't fire because the unrelated meshes stay visible
- room names containing underscores (`Front_Bedroom`) — they make `<RoomA>_<RoomB>` doorway parsing ambiguous; use PascalCase (`FrontBedroom`) instead
- doorway markers that do not actually sit in openings
- exterior entry (`Exterior_<RoomName>_DW`) markers that sit well inside or well outside the building instead of at the opening
- spot light marker apexes (= bulb positions) inside a fixture housing when the cone has wide lateral spread — see [Spot Housing Occlusion Authoring Rule](#spot-housing-occlusion-authoring-rule)
- pivot marker groups whose axis origin is the geometry's centre or some arbitrary edge instead of the actual hinge edge — the door will swing around the wrong pivot point
- transparent glass meshes without a `Glass_` prefix — they will block sunlight as solid walls
- leaving faces as solid-colour only when they will be retextured in the Viewer — apply a placeholder texture in SketchUp so UV coordinates are exported
- relying on the fallback box-projection UVs for finished work — they are a preview aid only

---

## Recommended Working Process

### For modelers

1. build the product cleanly
2. group configurable features logically
3. add marker geometry if interior navigation/authoring aids are needed
4. name markers consistently
5. export `.glb`

### For technical validation

After export, check:

- printed hierarchy
- whether stable geometry IDs remain consistent across reloads/exports
- whether markers resolve correctly
- whether configurable parts are easy to select and capture

---

## Short Practical Rules

If you want the shortest version:

- keep hierarchy stable
- name things clearly
- **navigation markers**: include `_RM` (room) or `_DW` (doorway) suffix anywhere in any node's name (e.g. `LivingDining_RM`, `Hall_FrontBedroom_DW`, `Exterior_LivingDining_DW`). Room names: PascalCase, no underscores. Markers can sit anywhere in the scene tree.
- **lighting markers**: include `_PL` (point) or `_SL[<degrees>]` (spot, default 90°) suffix anywhere in any node's name (e.g. `RoomLights_PL`, `EntranceUpBulbs_SL90`). For fixture-bound lights, wrap markers + only that fixture's geometry under a shared parent component — the spawned light hides automatically when every fixture mesh is in the active hide set. Loose markers under structural top-level containers stay always-on.
- **pivot markers** (click-to-rotate): include `_<degrees><CW|CCW>` substring anywhere in any group's name (e.g. `BedroomDoor_90CCW`). Set the SketchUp group axes with the origin at the hinge edge and the blue axis pointing up.
- **slide markers** (click-to-slide): include `_SD<mm>` substring anywhere in any group's name (e.g. `PocketDoor_SD800` slides 800 mm). Set the SketchUp group axes with the **red (+X) axis** aimed in the open direction. State is session-only — same as pivots.
- **per-mesh shadow prefixes**: `Glass_*`, `Water_*`, `Fixture_*` (translucent fixture parts only) disable shadow casting for that mesh.
- **emissive materials**: prefix the **material name** with `Emissive_` for bulbs / LED strips / glowing panels.
- all matching is **case-insensitive** — capitalised PascalCase is the recommended convention for readability.
- make configurable geometry easy to target
- export with a sensible default material state
- apply a placeholder texture in SketchUp to any face you plan to retexture in the Viewer — this exports UV coordinates and lets you control tiling scale

That will take you a long way.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
