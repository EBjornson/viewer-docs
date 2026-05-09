# Thermal Marker Authoring Guide

## SketchUp Authoring Standards for Energy Snapshot System

---

# Purpose

This document defines the initial SketchUp authoring standards for the Energy Snapshot system under consideration.

The goal is to create a lightweight, deterministic, geometry-driven thermal takeoff workflow capable of supporting:

* gross annual space-heating demand estimates,
* peak design-day heat loss estimates,
* and future advanced energy analysis features.

These markers are intended exclusively for:

* energy geometry extraction,
* thermal boundary interpretation,
* and non-rendered metadata workflows.

They are NOT intended for visible rendering geometry.

---

# V1 Philosophy

The V1 system prioritizes:

* simplicity,
* consistency,
* deterministic geometry extraction,
* explainable calculations,
* and maintainable authoring workflows.

V1 is NOT intended to:

* replicate HOT2000,
* provide engineering certification,
* or replace formal energy modelling software.

---

# Core Authoring Principles

## 1. Thermal markers are dedicated hidden geometry

Thermal markers should:

* exist separately from visual model geometry,
* be hidden from rendering,
* and be used exclusively for thermal takeoff.

Recommended:

* place all thermal markers on dedicated hidden SketchUp tags/layers.

Example:

```text
THERMAL_MARKERS
```

---

## 2. Marker planes represent the warm-side thermal boundary

Thermal marker planes should generally be authored on the:

> interior / conditioned-side surface of the thermal boundary.

Examples:

| Building Component     | Marker Plane Location               |
| ---------------------- | ----------------------------------- |
| Exterior wall          | interior drywall face               |
| Attic ceiling          | ceiling drywall plane               |
| Cathedral ceiling      | interior finish plane               |
| Floor over crawlspace  | finished floor plane                |
| Basement wall          | conditioned-side basement wall face |
| Slab                   | top surface of slab / floor         |
| Garage separation wall | conditioned-side face               |

This standard:

* reduces double-counting,
* improves consistency,
* simplifies geometry extraction,
* and aligns naturally with conditioned space logic.

---

# Window and Door Standards

## Openings use separate markers

Windows and doors should be authored separately from wall markers.

Window and door markers represent:

> rough opening / unit opening area

NOT:

* visible glass area,
* door slab area,
* or frame-only area.

---

## Wall markers remain gross wall area

Wall markers should remain continuous gross wall boundary areas.

The application layer will calculate:

```text
Net Wall Area =
Gross Wall Area
- Window Openings
- Door Openings
```

This simplifies SketchUp authoring significantly.

---

# Marker Geometry Rules

## Marker geometry should be simple planar faces

Recommended:

* single rectangular faces where possible.

Avoid:

* highly subdivided geometry,
* curved faces,
* decorative geometry,
* nested boolean cutouts.

---

## Marker thickness

Markers should ideally be:

* infinitely thin planes,
* or extremely thin surfaces.

Thickness is ignored by the thermal extraction system.

---

## Marker orientation

Marker front-face direction should point:

* outward from conditioned space.

This allows orientation calculations later if needed.

---

# Marker Naming Convention

## Standard format

```text
thermal:<type>:<assemblyRef>
```

Examples:

```text
thermal:wall:wall_r24
thermal:roof:attic_r60
thermal:window:triple_lowe
thermal:door:insulated_door
thermal:slab:slab_edge_r10
thermal:garage-separation-wall:garage_r20
```

---

# Required V1 Marker Types

## Exterior envelope

```text
thermal:wall
thermal:roof
thermal:window
thermal:door
thermal:exposed-floor
```

---

## Foundation systems

```text
thermal:basement-wall-above-grade
thermal:basement-wall-below-grade
thermal:slab
thermal:crawlspace-wall
```

---

## Garage-adjacent boundaries

```text
thermal:garage-separation-wall
thermal:garage-separation-ceiling
```

---

## Space / orientation helpers

```text
thermal:conditioned-volume
thermal:north
```

---

# Conditioned Volume Markers

## Purpose

Conditioned volume markers define:

* heated interior volumes,
* approximate air volume,
* and conditioned floor area relationships.

---

## Recommended geometry

Use:

* simple closed box geometry,
* one box per conditioned zone or level.

Examples:

* main floor,
* basement,
* second floor.

---

## Naming examples

```text
thermal:conditioned-volume:main_floor
thermal:conditioned-volume:basement
```

---

# North Marker

## Purpose

Defines building orientation.

Used later for:

* solar analysis,
* orientation-aware reporting,
* and future shading systems.

---

## Recommended format

Use:

* a simple thin rectangular plane or arrow geometry.

Naming:

```text
thermal:north
```

Orientation:

* front face points toward true north.

---

# Recommended SketchUp Hierarchy

Example:

```text
House_Model
  ThermalMarkers_HIDDEN
    thermal:north

    thermal:conditioned-volume:main_floor
    thermal:conditioned-volume:basement

    thermal:wall:wall_r24
    thermal:wall:wall_r24

    thermal:window:triple_lowe
    thermal:window:triple_lowe

    thermal:door:insulated_door

    thermal:roof:attic_r60

    thermal:basement-wall-below-grade:basement_r20

    thermal:slab:slab_edge_r10

    thermal:garage-separation-wall:garage_r20
```

---

# Assembly Reference Philosophy

Markers should reference reusable assemblies.

Markers should NOT contain:

* U-values,
* R-values,
* climate data,
* or calculation logic.

Example:

```text
thermal:wall:wall_r24
```

The application layer determines what:

```text
wall_r24
```

means.

This allows:

* global assembly updates,
* reusable standards,
* admin editing,
* and future configurator flexibility.

---

# Visibility Rules

Thermal markers should:

* remain hidden during normal rendering,
* not cast shadows,
* not participate in collisions,
* not appear in buyer-facing views.

The viewer should still:

* detect,
* parse,
* and process them.

---

# Geometry Extraction Expectations

The viewer will eventually extract:

* marker type,
* assembly reference,
* area,
* orientation,
* center point,
* parent relationships,
* conditioned volume,
* and north orientation.

The viewer will NOT perform:

* energy calculations,
* climate logic,
* or thermal engineering.

---

# V1 Simplifications

V1 intentionally simplifies:

* thermal bridging,
* framing fractions,
* ventilation systems,
* HVAC efficiency,
* solar gains,
* occupant behavior,
* and moisture transport.

The goal is:

* consistent comparative estimates,
* not engineering-grade precision.

---

# Authoring Recommendations

## Recommended

* Keep markers simple.
* Keep markers planar.
* Use large clean surfaces.
* Use reusable assembly names.
* Keep hierarchy organized.
* Keep marker naming exact and consistent.

---

## Avoid

* overlapping markers,
* duplicated surfaces,
* decorative geometry,
* curved thermal markers,
* embedded thermal data,
* and inconsistent naming.

---

# Initial Development Test Model Recommendations

The first development model should include:

* simple rectangular home geometry,
* one attached garage,
* basement,
* multiple windows on different orientations,
* one crawlspace or exposed floor condition,
* multiple wall assembly types,
* conditioned volume markers,
* and a north marker.

The first test model should prioritize:

* clarity,
* debugging,
* and deterministic extraction,

NOT visual realism.

---

# Future Expansion Possibilities

Future versions may support:

* solar gains,
* monthly climate calculations,
* shading geometry,
* passive solar optimization,
* cooling loads,
* room-level zones,
* thermal bridges,
* window SHGC,
* and HVAC system modelling.

V1 authoring standards should remain simple enough that future features can layer on without requiring major re-authoring.
