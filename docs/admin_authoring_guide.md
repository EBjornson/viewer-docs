# Admin Authoring Guide

**Primary reader:** Admin author preparing a model
**Job-to-be-done:** Author a model day-to-day — captures, options, materials, sections
**Next doc:** [Model Authoring Guide](model_authoring_guide.md)

---

## Purpose

This guide explains how to author a model — the camera moments, lighting, geometry visibility, and material choices that make up a configurable product experience. It is written for the person doing the authoring, not for developers integrating the system.

If you are working through this for the first time, the [Demo Walkthrough](demo_walkthrough.md) gets you to your first working configuration in about 20 minutes. This guide is the deeper reference once you are comfortable with the basics.

---

## Admin Mode

Click **Admin Mode** in the header to enter authoring. The button highlights when active. The **Authoring Panel** appears as a left-side overlay containing all capture and clear actions plus admin-only navigation/lighting helpers. Click it again to leave authoring and return to the clean customer-facing view.

Inside the Authoring Panel, two admin-only **helper rows** sit above the capture controls in their respective tabs:

- **Section tab — Quickviews row** (Exterior / Interior / Overhead): navigates the camera to the Viewer's built-in default pose for that camera mode.
- **pMode tab — pMode helper buttons** (Summer Day / Summer Night / Winter Day / Winter Night, four buttons in a 2×2 layout): loads the Viewer's built-in lighting defaults (and winter HDRI/terrain pair for the Winter row).

Both are pure Viewer-internal authoring conveniences — no public callbacks, no effect on App-stored state. The pMode helper count and labels are **independent** from any host App's pMode store: DemoApp's header pills are an App-side capture-slot taxonomy (currently 6 pills: Summer Day/Night/Interior + Winter Day/Night/Interior); the Viewer's helpers seed lighting starting points (currently 4: Summer/Winter × Day/Night). Helpers feed the admin → admin tweaks sliders → admin clicks Mode Capture → App routes to whichever pMode pill it currently has selected.

### The Authoring Panel uses internal tabs

The panel has three context tabs at the top — **Section / Option / pMode** — that you click to choose what you're authoring. Each tab shows exactly the controls relevant to its capture family.

| Tab | Panel surfaces |
|---|---|
| **Section** | Section Capture/Clear, geometry tools, User Visibility toggles, Camera Mode selector |
| **Option** | Option Capture / Capture Material Only / Clear, Material Defaults, geometry tools, Assembly Inspector, Materials picker |
| **pMode** | Mode Capture/Clear, Presentation sliders, HDR Environment, Terrain Preset, Light Source mode |

A section capture stores the **full presentation snapshot embedded** alongside camera and visibility, but the section tab itself exposes only camera/visibility controls — adjust lighting via the pMode tab and capture it there separately, or use the App-rendered pMode pills in the DemoApp header (admin-mode only) to load App-stored snapshots as starting points.

### Capture / clear pattern

The capture families share a Capture / Clear button pair at the top of each tab:

- **Section tab** → Section Capture / Section Clear
- **pMode tab** → Mode Capture / Mode Clear
- **Option tab** → Option Capture / Option Clear (plus the Capture Material Only variant)
- **Material Defaults** (always available in option tab) → Capture Material Defaults / Clear Material Defaults

Note: there is **no separate View capture family**. A "view-like" stored moment is an optionless Section — the App may have Sections with associated options or with no options. Authoring a "view" is the same workflow as authoring any other Section.

---

## What You Are Authoring

There are five kinds of authored state. The **recommended order** (next section) walks through them in the sequence that flows most smoothly — but they are largely independent and can be revisited in any order.

### 1. Presentation modes

A presentation mode is a complete visual environment — HDR sky, terrain, lighting, solar position, exposure, point lights, and User Visibility flags — saved under one of six named slots:

- Summer Day, Summer Night, Summer Night Interior
- Winter Day, Winter Night, Winter Night Interior

Sections and views *reference* a presentation mode by name. Capturing a mode once means every section that uses Summer Day always renders with the same sky and lighting.

The Summer and Winter rows can each be hidden from users via the User Visibility toggles. Use this when a product does not need a winter presentation.

### 2. Quickview navigation (admin-only)

The AuthoringPanel's Section-tab **Quickviews row** (Exterior / Interior / Overhead, top of the Section tab) holds admin-only authoring conveniences. They navigate the camera to the Viewer's default pose for each camera mode — useful as a starting point when framing a section's hero shot. They do not store any state and do not fire callbacks. Future enhancement: per-session capture/clear of Quickview button defaults (deferred).

A "view-like" persistent stored moment is just an optionless Section. Author it via the Section workflow below.

### 3. Section captures

A section capture stores a camera pose, the camera mode, the **embedded presentation snapshot** (full lighting/HDR/terrain/solar/UI flags), and geometry visibility for one product section (Roof, Flooring, Solar Package, etc.). DemoApp also attaches the active pMode key as App-side metadata at receipt for optional re-skin support.

Activating a section in user mode replays the capture: the camera animates to the pose, the presentation switches to the referenced mode, and the geometry visibility updates.

### 4. Option captures

An option capture stores two kinds of intent for a chosen option within a section:

- **Geometry membership** — which parts of the model belong to this option (used to show the active option's parts and hide the other options' parts)
- **Material assignments** — what those parts should look like (color, roughness, metalness, textures)

An option can own one, the other, or both. The same option capture button can collect either intent or both at once.

### 5. Model default materials

The model as a whole can own a set of material assignments that replay automatically on every load, before any option assignments are applied. This is the baseline appearance — the colors, roughness, and textures the model should default to before the user makes any choices.

Option assignments always override model defaults for the same geometry. When an option is deactivated, the geometry falls back to the model default.

Model defaults are **optional**. If every option for a given piece of geometry assigns its own material (e.g. every siding color option captures its own material), the default appearance is never visible to the user, so capturing a default for that geometry is unnecessary.

---

## Recommended Authoring Order

Use this order when authoring a new model. Each step builds on the previous in a way that minimizes back-and-forth.

1. **Capture at least one Presentation Mode.** Start with Summer Day — adjust HDR, terrain, exposure, sun, and ambient light until the daytime exterior looks right, then click **Mode Capture** with Summer Day active. You can return to capture additional modes (Summer Night, Winter Day, etc.) later.
2. **Capture Sections.** Section captures are the primary "stored moments" — they hold pose, cameraMode, embedded presentation snapshot, visibility, and User Visibility flags. For each section: click the section tab in the App, navigate (use the admin-only Quickviews row at the top of the AuthoringPanel's Section tab as quick starting points if useful), load a pMode pill in the App header to apply the right starting lighting, set the matching Camera Mode in the Authoring Panel, set User Visibility, hide any presentation-context geometry (e.g. roof for an overhead view), and click **Section Capture**. Optionless sections serve as "view-like" stored moments — author them the same way.
3. **Capture Option geometry membership.** Per section, per option: click the option, select the parts of the model that belong to that option, and click **Option Capture**.
4. **Capture Option material assignments.** Per option that needs custom materials: click the option, select the geometry, edit the material (color, roughness, metalness, or apply a library texture), and click **Option Capture**. If the geometry is already owned for show/hide by a different section, use **Capture Material Only** (see [Cross-section ownership](#cross-section-ownership) below).
5. **Capture Model Defaults — anytime, optionally.** Some models benefit from a baseline appearance (a default exterior color the user sees before choosing). Other models capture a material on every option, so the default is never visible and capturing one is unnecessary. There is no wrong time.

You do not have to work in this exact order, but it is the cleanest path on a fresh model.

---

## Presentation Mode Workflow

1. Click the presentation mode button you want to author (Summer Day, Summer Night, Winter Day, etc.). The panel switches to mode-authoring controls.
2. Adjust the presentation sliders — exposure, sun, ambient, HDR rotation, point lights, emissive intensity — and pick the HDR environment and terrain preset.
3. Set User Visibility toggles if this mode should hide certain panels from users (e.g. hide the Solar / Site panel for night modes).
4. Click **Mode Capture**.

To replace an existing capture, just capture again — it overwrites in place, no need to clear first.

To remove a stored mode, click **Mode Clear**.

**Winter mode defaults.** When you switch to a winter mode that has no capture yet, the HDR environment is automatically set to *Horn Koppe Snow* and the terrain preset to *Snow*. All other settings stay where they are. This gives a sensible winter starting point. Summer modes have no equivalent default — switching to an uncaptured summer mode leaves all settings as-is.

---

## Overhead floor-tile click navigation

When the user is in an Overhead-mode section and clicks a floor tile (a recognized `_RM` room marker face), the Viewer navigates the camera into that interior space via pathNav. **No callback fires** — the camera movement is purely Viewer-internal.

**The roof comes back automatically.** Sections captured at overhead typically hide the roof so the floor plan reads cleanly. The Viewer detects the dive and auto-suspends the section's hidden geometry for the duration of the dive — so the user sees inside a roofed building, not a roofless one. The hides reapply when the camera returns to overhead (re-click the section pill, or in admin mode click the Quickview Overhead button). The same behavior applies to Rooms-panel clicks while in overhead and (in admin mode) the Quickview Interior button.

Authoring guidance: presentation (lighting, environment, exposure, etc.) still persists across the dive — only the captured hidden geometry is suspended. If the lighting reads acceptably from interior poses, no further authoring is required. If you want lighting to change on this gesture, designate a separate interior optionless Section and have the App switch to it (see [Capture & Replay](capture_and_replay.md#overhead-floor-tile-click) for the App-side pattern).

---

## Section Workflow

### Step 1 — activate the section

Click the section tab to make it active.

If the section already has a captured preset, activating it replays that preset. If it does not, activating it leaves the current presentation alone.

### Step 2 — adjust the view

A common starting move is to press a Quickview button in the AuthoringPanel's Section tab (often Exterior or Overhead) to land at a default pose, then orbit / pan / zoom to the section's hero angle. Optionally click a pMode pill in the DemoApp header to load the App-stored pMode snapshot as the lighting starting point.

Adjust as needed:

- camera pose
- camera mode (Ext / Int / Ovh in the authoring panel — declarative, see View workflow)
- presentation mode (which mode this section should use)
- geometry to hide as presentation context (e.g. hide the roof for an overhead view)
- User Visibility toggles for what users should see when this section is active

### Step 3 — capture

Click **Section Capture**.

### Step 4 — test replay

Click between sections to confirm the camera animates to each captured pose with the right lighting and visibility. Switching to a section that has no capture leaves the current presentation unchanged.

### Step 5 — clear if needed

Click **Section Clear** to remove the active section's stored capture.

---

## Option Workflow

### Step 1 — choose the section, then the option

This sequence matters. The option capture button stores whatever is currently selected and changed *under whichever option is active*. If the wrong option is active when you capture, the work lands under the wrong key. Always select the section and option *first*, then make changes, then capture.

### Step 2 — capture geometry membership (if relevant)

Select the parts of the model that should belong to this option.

Click **Option Capture**. The selected geometry IDs are stored against the active option.

### Step 3 — capture material assignments (if relevant)

With the option still active:

1. Select the geometry to retexture
2. Adjust the color, roughness, metalness, or apply a library material
3. Click **Option Capture**

The material assignments are stored against the active option. They replay whenever this option is selected.

You can capture geometry and materials in the same click, or in separate clicks — Option Capture **additively merges** into the existing stored payload. New geometry is added to the option's set; materials for newly-touched geometry overwrite while materials for previously-stored geometry stay put. To replace from scratch, click **Option Clear** first.

### Replacing a texture material with a flat color

If an option already has a texture assigned and you want to replace it with a solid color:

1. Click the option to make it active (this replays its current material, including the texture)
2. Select the geometry
3. Click **Reset Selected Part**
4. Pick the new color and adjust roughness / metalness
5. Click **Option Capture**

The reset is necessary because the color picker preserves any existing texture maps when adjusting an active assignment. Without the reset, you get a color-tinted version of the texture instead of a flat face.

### Capture Material Only

The **Capture Material Only** button is a variant of Option Capture that fires *only* the material assignments — no geometry membership claim.

Use it when the active option's only intent is to *color* geometry that is already owned for show/hide by a different section. See [Cross-section ownership](#cross-section-ownership) below.

The button is enabled whenever there are pending material changes, regardless of whether geometry is selected.

### Clear Recent Material Changes

This is a local reset for pending material edits before they are captured. It clears the in-progress changes you have made but not yet stored. It does **not** affect already-captured option materials.

### Clear Option Capture

Removes both the geometry membership and the material assignments stored against the active option.

---

## Model Defaults Workflow

Model defaults are the baseline appearance of the model — applied on every load, before any option assignments. They are optional.

### When you might want them

- The exported model has no useful default colors and you want to set them once instead of re-exporting.
- One section assigns custom materials only on some options, and the other options should fall back to a polished default rather than the bare exported look.

### When you can skip them

- Every option for the relevant geometry already captures its own material. The default would never be seen by users, so there is no reason to set one.

### How to capture

1. Make sure no option is active that already has a captured material on the geometry you are about to edit (otherwise you will be working on top of an option assignment).
2. Select the geometry.
3. Adjust color, roughness, metalness, or apply a library material.
4. Click **Capture Material Defaults** (in the option focus panel).

The model defaults are stored at the model level and replay on every load, regardless of which section or option is active. Option assignments always override defaults for the same geometry.

### Clearing

Click **Clear Material Defaults** to remove the stored baseline. Even if the panel currently shows no captured value (e.g. after a page reload), the button is always enabled — clicking it clears any persisted default from a prior session.

The **"Mat. Defaults"** indicator in the header lights up blue when material defaults are stored. Hovering it after a 3-second delay shows the stored payload in a tooltip with a Copy button.

---

## Cross-section ownership

Replay needs to be deterministic — the same configuration always produces the same display. To guarantee that, two **independent** ownership rules apply across sections:

1. **Show/hide ownership.** A piece of geometry can appear in the geometry-membership list of options within only one section. (It can appear in multiple options *within* the same section — that's how combinatorial choices like "left light only / right light only / both lights" work.)
2. **Material assignment ownership.** A piece of geometry can be material-assigned by options within only one section.

The two rules are independent. The same geometry **may** be owned for show/hide by Section A *and* material-assigned by Section B — that combination is allowed. What is not allowed is the same geometry being on the show/hide list of options across multiple sections, or being material-assigned by options across multiple sections.

### What you'll see when you trip a rule

If you click Option Capture and the capture would violate either rule, the capture is **rejected** — nothing is stored — and a red banner appears at the top of the viewer:

> *Capture rejected — cross-section ownership conflict.*
> *Already in show/hide list of **Section 1 / Option 2**: G_roof_01, G_roof_02.*
> *Clear that capture first, or pick different geometry.*

### How to resolve

You have two options:

- **Pick different geometry.** Often the simplest fix.
- **Clear the conflicting option's capture first.** Switch to the named section and option, click Option Clear, then come back and capture.

### When you only want to color geometry that another section owns

A common case: Section A owns the roof's show/hide (which roof shapes appear), and you want Section B to control the roof's color. If you click Option Capture in Section B with roof geometry selected, Rule 1 fires (Section A already owns it).

The fix: use **Capture Material Only**. This fires the material assignment without claiming show/hide ownership, so Rule 1 is not triggered. Rule 2 still applies — only one section can assign materials to that roof geometry.

### Pre-existing conflicts

If an older saved model has cross-section conflicts from before the rules were enforced, an amber banner surfaces them on load. The banner lists show/hide and material conflicts in separate groups so each kind can be addressed independently.

---

## User Visibility toggles

The User Visibility section in the Section tab of the Authoring Panel controls which user-facing UI panels are visible in non-admin mode. **Three toggles**:

- **Solar** — Solar / Site panel
- **Rooms** — SpaceMenu / Rooms panel (scrollable list of navigable rooms)
- **North** — North Arrow overlay

In Admin Mode, the Solar and Rooms panels are always visible regardless of toggle state — so you can always author them. When a panel is toggled off (hidden from users), it shows a **dashed orange outline** in admin so you can tell it is hidden without losing readability. The North Arrow has no orange outline indicator; it shows or hides as-is in both modes.

User Visibility toggles are part of the section's embedded presentation snapshot. Each section capture independently controls which panels are visible when it is active — you can hide the Solar panel for interior sections and show it for exterior sections.

---

## Rooms panel (SpaceMenu)

The Rooms panel — implemented by the internal `SpaceMenu` component — is a scrollable list of navigable rooms displayed in the right column of the viewer, below the Solar panel. Each room is clickable to navigate to that location. In Admin Mode the panel is always visible; the **Rooms** User Visibility toggle controls whether users see it.

Two things to know about Rooms panel navigation:

- Clicking a room in the Rooms panel **only navigates the camera**. It does not change lighting, environment, exposure, materials, or geometry visibility.
- Clicking on a floor tile from an overhead-mode section also navigates the camera into that interior space (Viewer-internal pathNav, no callback). The section's hidden geometry is auto-suspended during the dive so the roof comes back; presentation persists. Same auto-suspension fires on a Rooms-panel click made while in overhead. See [Overhead floor-tile click](#overhead-floor-tile-click-navigation) above.

---

## Floor Nav debug tool

A **Floor Nav** button appears in the Admin Debug Panel. Toggling it on overlays a debug visualization showing:

- green rectangles on each room's floor indicating the walkable landing zone (inset by the wall margin)
- a green disc and ring at the clamped landing point when hovering a floor zone
- a white ring at the raw cursor position plus a yellow line to the clamped position when the cursor is near a wall and gets pushed inward
- a warm yellow frustum drape projected onto the visible room surfaces showing what the camera would frame after clicking that floor point

Useful for verifying that `_RM` (room) markers are sized and positioned correctly in the model, understanding how wall margin clamping affects landing positions near walls and doorways, and previewing the camera framing that results from a floor click before navigating.

---

## Testing replay

After authoring, simulate real use:

1. Activate each section and confirm the camera, lighting, and visibility match what you captured.
2. Click between options inside a section and confirm geometry and materials change correctly.
3. Press each Quickview button (admin AuthoringPanel's Section-tab Quickviews row) and confirm it navigates to the default pose for that camera mode.
4. Switch presentation modes and confirm each mode renders the captured environment.
5. Reload the page and confirm everything still works (persistence is browser-local — see below).

A useful diagnostic: hover any capture indicator in the header (section tabs, option buttons, view indicators, presentation mode indicators, Mat. Defaults). After a 3-second delay a tooltip appears showing the exact stored payload, with a Copy button. This is the easy way to verify what was captured without opening browser developer tools.

---

## Persistence

Authored work is saved automatically to your browser's local storage, keyed by model. Reload the page and your captures come back — for the built-in demo models.

What persists:

- Section captures, presentation mode captures (App-side), option captures, model defaults.
- Section/option label renames.

What does **not** persist:

- Work on uploaded ad-hoc `.glb` files. Reloading clears them.

### Reset Model

The **Reset Model** button in the header clears all captures for the current model in one action — section captures, presentation mode captures, option captures, and model defaults. It asks you to confirm before clearing.

### Capture indicators in the overlay vs. the header

Two sets of capture indicators exist:

- **Header indicators** (Summer Day, Summer Night, Exterior, Interior, etc., plus Mat. Defaults). These reflect what is actually stored in your saved state. They survive reloads and are the reliable source of truth for what has been captured. They light up blue when a capture is stored.
- **Authoring overlay indicators** (the highlighted state on individual capture buttons). These reflect the current session only. They reset on page reload because the system has no way to distinguish "this is a freshly captured value" from "this value was just loaded from storage." Use the header indicators for capture status.

### Clear buttons are always enabled

**Clear Material Defaults**, **Section Clear**, and **Mode Clear** are always clickable, even when the overlay shows no captured value for the current session. This is intentional — your saved state may hold a capture from a previous session that the overlay doesn't know about. Clicking the clear button always removes any persisted value.

---

## Renaming sections and options

Section and option labels are renameable. Click **Rename** beside any section or option in Admin Mode to give it a meaningful name. Label changes are display-only — they do not affect any captured data.

---

## Good habits

- **Name and structure your model cleanly.** Configurable parts should be selectable as discrete groups. See the [Model Authoring Guide](model_authoring_guide.md) for naming conventions and hierarchy guidance.
- **Capture sections intentionally.** Think "what visual moment belongs to this section?" rather than "where was the camera sitting when I clicked?".
- **Test after each meaningful capture.** Catching a problem at one section is much easier than catching it after fifteen.
- **Keep option meaning clean.** Options that represent understandable user choices (Metal Roof / Shingle Roof, Standard Lighting / Premium Lighting) make later authoring and customer use much easier than options that mix unrelated changes.

---

## Short summary

- **Sections own presentation** — pose, cameraMode, embedded presentation snapshot, visibility. Sections may have associated options or no options (an optionless Section serves as a stored "view-like" moment).
- **Presentation modes own the full visual environment** — HDR, terrain, lighting, solar, point lights, exposure
- **Options own configuration effects** — geometry membership and material assignments per option
- **Model defaults own the baseline appearance** — material assignments applied before any option assignments

Recommended order for a new model: Presentation Mode → Views → Sections → Options (geometry then materials) → Model Defaults (anytime, optional).

Admin Mode is for authoring; turn it off to enter display mode.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
