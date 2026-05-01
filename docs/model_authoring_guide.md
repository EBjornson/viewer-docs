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

Marker geometry under a top-level `Spaces` group describes rooms and the connections between them:

```
Spaces
├── Rooms       (walkable interior spaces — names like LivingDining, Hall)
└── Doorways    (connections — leaf names <RoomA>_<RoomB> or Exterior_<RoomName>)
```

Marker meshes are removed from the scene at load — only the marker node's transform/bounds are read. See [Navigation Marker Conventions](#navigation-marker-conventions).

### 4. Lighting markers

Marker geometry under a top-level `Lights` group places point and spot lights at specific positions:

```
Lights
├── PointLights   (each child becomes a Three.js point light)
└── SpotLights    (each child becomes a spot light; optional Spotlight_<degrees> in name)
```

The marker's world transform origin is the light position. Visible helper geometry inside the marker is for SketchUp authoring only. See [Lighting Marker Conventions](#lighting-marker-conventions).

### 5. Shadow behavior prefixes

These are **per-mesh** name prefixes (different from the container markers above) that adjust how individual meshes interact with the shadow system:

- `Glass_*` — transparent glazing; shadow casting disabled
- `Water_*` — water surfaces; shadow casting disabled
- `Fixture_*` — translucent fixture parts (shades, etc.); shadow casting disabled

See the [Shadow Naming Conventions](#shadow-naming-conventions) section for full details.

---

## Minimum Good Model Checklist

For a model to behave well in the current stable viewer, try to satisfy these:

- exported as `.glb`
- hierarchy is stable across exports
- meaningful object names where possible
- if using navigation markers: a `Spaces` root with `Rooms` and `Doorways` sub-groups
- if using lighting markers: a `Lights` root with `PointLights` and/or `SpotLights` sub-groups
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

### Root marker container

Use an object named exactly `Spaces` at the top of the scene. Inside it, group markers by type:

```
Spaces
├── Rooms       (walkable interior spaces)
└── Doorways    (connections between spaces)
```

All matching is **case-insensitive**, but capitalised PascalCase is the recommended convention for readability. The resolver also tolerates SketchUp's auto-disambiguation suffix on the type containers (`Rooms_1`, `Doorways_2`).

### Rooms

Each child of the `Rooms` group is a walkable space. The marker's bounding box represents the volume of that room.

```
Rooms
├── LivingDining
├── Hall
├── FrontBedroom
├── RearBedroom
└── Bathroom
```

Room names are free-form, but **PascalCase with no underscores** keeps Doorway parsing unambiguous (see below). `LivingDining` works; `Living_Dining` does not.

### Doorways

Each child of the `Doorways` group encodes a connection between two spaces in its name:

| Pattern | Meaning | Example |
|---|---|---|
| `<RoomA>_<RoomB>` | Interior connection between two rooms | `Hall_FrontBedroom` |
| `Exterior_<RoomName>` | Entry from outside into the named room | `Exterior_LivingDining` |

The single `_` separates either two rooms, or the reserved word `Exterior` and a room. Both rooms named in a doorway leaf must match (case-insensitively, after normalization) a child of `Rooms`.

```
Doorways
├── LivingDining_Hall
├── Hall_FrontBedroom
├── Hall_RearBedroom
├── Hall_Bathroom
├── LivingDining_RearHall
├── RearHall_UtilityRoom
└── Exterior_LivingDining
```

**Multiple entries to the same room** (e.g. front and back doors both into `LivingDining`): use the same SketchUp definition for both instances. The exporter auto-disambiguates the second to `Exterior_LivingDining_1`. The resolver strips trailing `_<digits>` before parsing, so both instances connect to the same room.

### Marker placement guidance

Markers should be simple and practical, not beautiful. A good marker:

- sits where traversal should happen
- roughly matches the opening or walkable zone
- is big enough to be reliably detected
- does not need to be visible in the final experience (its mesh is removed at runtime)

Box geometry is often ideal. The **Floor Nav** debug toggle in Admin Mode visualizes the actual walkable landing zone derived from each `Rooms` marker, and the **NavPath** toggle shows the path-graph segments. Use these to verify markers produce sensible navigation.

---

## Lighting Marker Conventions

### Root marker container

Use an object named exactly `Lights` at the top of the scene. Inside it, group markers by type:

```
Lights
├── PointLights
└── SpotLights
```

Same matching rules as `Spaces`: case-insensitive, with tolerance for SketchUp auto-disambiguation suffix on the type containers (`PointLights_1`, `SpotLights_2`).

### PointLights and SpotLights

Each child of `PointLights` or `SpotLights` is a single light marker. **Names below the type container are free-form** — the resolver classifies by the parent container name, not the leaf name.

```
Lights
├── PointLights
│   ├── BedroomCeiling_01     (any name works)
│   ├── BedroomCeiling_02
│   └── …
└── SpotLights
    ├── EntryLamp_Spotlight_45
    ├── KitchenAccent_Spotlight_30
    └── …
```

Visible authoring helpers (a sphere or cone mesh inside the marker component) are for SketchUp orientation only. They're removed from the scene at load and never rendered.

### Per-marker spot beam angle

Spot light beam angle is read from a `Spotlight_<degrees>` substring anywhere in the marker's component name *or* the name of any descendant Object3D. `<degrees>` is the **full beam angle** in degrees:

```
test_Spotlight_30                     →  30° beam (narrow)
test_Spotlight_45                     →  45° beam
test_Spotlight_60                     →  60° beam
test_Spotlight_90                     →  90° beam (wide / default)
test#1_Spotlight_60 > Spotlight_60    →  60° beam (also matched on a child)
```

Default if no substring is found: **90°** full beam.

The cyan **SpotLightHelper** cone (visible when the "Spot Cones" toggle in the admin debug panel is on) reflects each marker's actual angle — useful for verifying the substring was parsed correctly.

### Light marker placement

The system places each light at the marker NODE's **world transform origin** — i.e., the SketchUp component's insertion point. Not the bounding-box centre of any visible helper inside the marker.

Practical implications:

- To move just the light without touching the visual representation: drag the marker component in SketchUp (changes the instance transform → moves the origin).
- To move just the visible helper without changing the light: edit the geometry inside the component definition (changes mesh-local positions, doesn't affect the origin).
- The visible sphere/cone helper inside the marker can be any shape or size — its only job is to make the marker locatable and orientable in SketchUp.

For spot lights, the **aim direction** is the marker's local `+Z` transformed to world space. Orient the marker component so its local `+Z` points where you want the cone to shine. The visible cone helper inside the component should be authored to match this orientation as a sanity check, but only the marker node's transform actually drives the light.

### Spot housing occlusion authoring rule

Marker-driven spot lights cast shadows; their cone is occluded by mesh geometry it intersects. Authoring rule:

> **The spot cone must clear the housing geometry.**

For wide-beam spots (~60°+) inside a fixture housing, the marker apex (= bulb position) needs to be outside the housing's open opening so the lateral cone spread doesn't interact with the housing walls. For narrow-beam spots (~30°), the bulb can sit deeper inside without issue — the tight cone barely spreads laterally.

When the bulb is inside a fixture housing AND the spot cone has meaningful lateral spread inside the walls, shadow occlusion silently fails. The mechanism isn't fully understood (extensive elimination history is in the project memory `project_spot_marker_authoring`); the practical fixes are either to narrow the beam angle or to move the marker apex outside the housing opening.

### Light Source Mode

The viewer's authoring panel offers a three-way toggle for how to source interior lights:

- **Import** — use the markers under `Lights > PointLights / SpotLights` (the convention this section describes).
- **Auto** — auto-place a single point light at the centre of each `Spaces > Rooms` marker. Useful for models without authored light markers.
- **None** — no interior lights at all.

The toggle is **captured per presentation mode** (Day, Night, Night Interior, etc.). When loading a model that has authored light markers, uncaptured modes default to `Import`; when the model has no markers, they default to `Auto`. A captured value always wins over the smart default, so capture any mode you want to override.

---

## Authoring Debug Tools

Admin Mode exposes several debug tools in the bottom-right toolbar to verify your model authoring against the conventions in this guide.

### Hierarchy popup

Click **Hierarchy** in the admin debug toolbar to inspect the loaded scene's tree. The popup shows an indented hierarchy with two filters:

- **Markers only** (default ON) — narrows the view to subtrees rooted at recognized container markers (`Spaces`, `Lights`). Visible product geometry, per-mesh shadow prefixes, and other authoring noise are hidden, so you see *just* your marker structure for verification.
- **Show meshes** (default OFF) — when off, mesh leaves are collapsed to a `… (N meshes)` summary. When on, every mesh is shown by name.

A **Refresh** button re-walks the live scene graph (handy if you load a different model with the popup open). A **Copy** button puts the formatted hierarchy on your clipboard — useful for sharing during authoring iteration.

### Spot Cones (cyan helpers + frustum)

Toggle **Spot Cones** in the admin debug toolbar to visualize each marker-driven spot light:

- A **cyan SpotLightHelper cone** shows the light's beam shape based on its position, aim direction, and angle (parsed from the marker's `Spotlight_<degrees>` substring or the 90° default).
- A **wireframe CameraHelper pyramid** shows the spot's shadow camera frustum, including the near and far clip planes.

Use this to verify each spot is positioned and aimed correctly, that the beam angle matches what you intended, and that occluders (e.g., fixture housings) sit inside the frustum where you expect them. The Spot Cones toggle only takes effect when **Light Source Mode** is `Import`.

### Floor Nav and NavPath

Toggle **Floor Nav** to visualize the actual walkable landing zone derived from each `Spaces > Rooms` marker (with the wall-margin buffer applied, so you see what users will actually click on, not the raw marker bounds). Toggle **NavPath** to visualize the path-graph segments pathfinding uses for camera routing between rooms via Doorways.

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
- missing `Spaces` root when using navigation markers, or missing the `Rooms` / `Doorways` sub-groups
- missing `Lights` root when using authored lighting markers, or missing the `PointLights` / `SpotLights` sub-groups
- room names containing underscores (`Front_Bedroom`) — they make `<RoomA>_<RoomB>` doorway parsing ambiguous; use PascalCase (`FrontBedroom`) instead
- doorway markers that do not actually sit in openings
- exterior entry (`Exterior_<RoomName>`) markers that sit well inside or well outside the building instead of at the opening
- spot light marker apexes (= bulb positions) inside a fixture housing when the cone has wide lateral spread — see [Spot Housing Occlusion Authoring Rule](#spot-housing-occlusion-authoring-rule)
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
- **navigation markers**: `Spaces > Rooms / Doorways > <name>`. Doorway leaves are `<RoomA>_<RoomB>` for interior or `Exterior_<RoomName>` for entries. Room names: PascalCase, no underscores.
- **lighting markers**: `Lights > PointLights / SpotLights > <name>`. Spot beam angle via `Spotlight_<degrees>` substring anywhere in the marker subtree (default 90°).
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
