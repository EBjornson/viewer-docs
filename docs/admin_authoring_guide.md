# Admin Authoring Guide

**Primary reader:** Admin author preparing a model
**Job-to-be-done:** Author a model day-to-day — captures, options, materials, sections
**Next doc:** [Model Authoring Guide](model_authoring_guide.md)

---

## Purpose

This guide explains how to author a model — the camera moments, lighting, geometry visibility, and material choices that make up a configurable product experience. It is written for the person doing the authoring, not for developers integrating the system.

If you are working through this for the first time, the [Tester Quickstart](tester_quickstart.md) gets you to your first working configuration in about 15 minutes. This guide is the deeper reference once you are comfortable with the basics.

---

## Admin Mode

Click **Admin Mode** in the header to enter authoring. The button highlights when active. The **Authoring Panel** appears as a left-side overlay containing all capture and clear actions. Click it again to leave authoring and return to the clean customer-facing view.

The bottom **Navigation Panel** (View buttons + Summer / Winter presentation mode buttons) renders the same in admin and user modes — it is for navigation only.

### The Authoring Panel is context-aware

The panel adapts to whatever you most recently clicked. You don't need to switch tabs.

| Last click | Panel surfaces |
|---|---|
| **Section tab** | Section Capture/Clear, geometry tools, User Visibility toggles, Camera Mode selector |
| **Option button** | Option Capture / Capture Material Only / Clear, Material Defaults, geometry tools, Assembly Inspector, Materials picker |
| **View button** (Exterior / Interior / Overhead) | View Capture/Clear, geometry tools, User Visibility toggles, Camera Mode selector |
| **Presentation Mode button** (Summer Day, Winter Night, etc.) | Mode Capture/Clear, User Visibility toggles, Presentation sliders, HDR Environment, Terrain Preset |

Each focus shows exactly the controls that belong to its capture. For example, a presentation mode capture stores the full visual environment (HDR, terrain, lighting, solar) so its panel exposes those sliders. A section capture stores a *reference* to a presentation mode rather than the raw values, so its panel exposes camera and visibility controls but not the lighting sliders.

### Capture / clear pattern

All five capture families share the same shape — a Capture / Clear button pair at the top of the focus context, styled consistently:

- **Section focus** → Section Capture / Section Clear
- **View focus** → View Capture / View Clear
- **Presentation Mode focus** → Mode Capture / Mode Clear
- **Option focus** → Option Capture / Option Clear (plus the Capture Material Only variant)
- **Model defaults** (always available in option focus) → Capture Material Defaults / Clear Material Defaults

---

## What You Are Authoring

There are five kinds of authored state. The **recommended order** (next section) walks through them in the sequence that flows most smoothly — but they are largely independent and can be revisited in any order.

### 1. Presentation modes

A presentation mode is a complete visual environment — HDR sky, terrain, lighting, solar position, exposure, point lights, and User Visibility flags — saved under one of six named slots:

- Summer Day, Summer Night, Summer Night Interior
- Winter Day, Winter Night, Winter Night Interior

Sections and views *reference* a presentation mode by name. Capturing a mode once means every section that uses Summer Day always renders with the same sky and lighting.

The Summer and Winter rows can each be hidden from users via the User Visibility toggles. Use this when a product does not need a winter presentation.

### 2. Views

A view capture stores a camera pose, a presentation mode reference, geometry visibility, and User Visibility flags under one of three named slots: **Exterior**, **Interior**, **Overhead**. Pressing a View button replays the capture.

Views give you reusable basepoints. They are especially useful as starting positions when authoring sections — you can return to a known good Exterior pose and then frame each section's hero shot from there.

### 3. Section captures

A section capture stores a camera pose, a presentation mode reference, geometry visibility, User Visibility flags, and the camera mode for one product section (Roof, Flooring, Solar Package, etc.).

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
2. **Capture the three Views** (Exterior, Interior, Overhead). For each one: navigate to the position you want, set the matching Camera Mode in the panel, choose the Presentation Mode you want for that view, set the User Visibility toggles for that view, and click **View Capture**. Views give you reliable basepoints to return to before each section capture.
3. **Capture Sections.** For each section: click the section tab, navigate (often by pressing a View button first to land at a basepoint, then adjusting), confirm the Presentation Mode is what you want for the section, set User Visibility for the section, hide any presentation-context geometry (e.g. roof for an overhead view), and click **Section Capture**.
4. **Capture Option geometry membership.** Per section, per option: click the option, select the parts of the model that belong to that option, and click **Option Capture**.
5. **Capture Option material assignments.** Per option that needs custom materials: click the option, select the geometry, edit the material (color, roughness, metalness, or apply a library texture), and click **Option Capture**. If the geometry is already owned for show/hide by a different section, use **Capture Material Only** (see [Cross-section ownership](#cross-section-ownership) below).
6. **Capture Model Defaults — anytime, optionally.** Some models benefit from a baseline appearance (a default exterior color the user sees before choosing). Other models capture a material on every option, so the default is never visible and capturing one is unnecessary. Some authors prefer to do this immediately after Views; others leave it to the end. There is no wrong time.

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

## View Workflow

1. Click the view button (Exterior, Interior, or Overhead). The panel switches to view-authoring controls.
2. Position the camera. Orbit, pan, zoom freely.
3. Set the **Camera Mode** in the panel (Ext / Int / Ovh) to match the view you are capturing. **This is purely declarative** — clicking Camera Mode does not move the camera. It only tags which mode the capture stores. Set it to label the pose correctly before capturing.
4. Choose the Presentation Mode you want for this view (e.g. Summer Day for Exterior, Summer Night Interior for Interior).
5. Set User Visibility toggles for what users should see when in this view (e.g. hide the Solar panel for interior views, hide the Rooms panel for exterior views).
6. Click **View Capture**.

To remove a stored view, click **View Clear**.

### Overhead space-tile click (`SpaceTileClickNav`)

When in Overhead view, clicking a space tile navigates the camera into that interior space and **also applies the Interior view capture** — including its presentation and geometry visibility. This means the user lands inside with the correct interior lighting already applied, instead of arriving with overhead lighting still active.

The Interior view capture is the shared source of truth for both the Interior button press and overhead space-tile clicks. Authoring once covers both.

If no Interior view capture has been authored, the click still navigates the camera but leaves the lighting unchanged.

> *Engineering details (callback wiring, Admin vs User behavior):* see [Capture & Replay → Overhead Space-Tile Click](capture_and_replay.md#overhead-space-tile-click-spacetileclicknav).

---

## Section Workflow

### Step 1 — activate the section

Click the section tab to make it active.

If the section already has a captured preset, activating it replays that preset. If it does not, activating it leaves the current presentation alone.

### Step 2 — adjust the view

A common starting move is to press a View button (often Exterior or Overhead) to land at a known basepoint, then orbit / pan / zoom to the section's hero angle.

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

The User Visibility section in the Authoring Panel controls which UI panels users see in non-admin mode. There are six toggles:

- **Solar** — Solar / Site panel
- **Views** — Views row (Exterior / Interior / Overhead buttons)
- **Summer** — Summer presentation mode row
- **Winter** — Winter presentation mode row
- **Rooms** — SpaceMenu / Rooms panel (scrollable list of navigable rooms)
- **North** — North Arrow overlay

In Admin Mode, all six panels are always visible regardless of toggle state — so you can always author them. When a panel is toggled off (hidden from users), it shows a **dashed orange outline** in admin so you can tell it is hidden without losing readability. The North Arrow has no orange outline indicator; it shows or hides as-is in both modes.

User Visibility toggles are part of the section / view / presentation mode capture payload. Each capture independently controls which panels are visible when it is active — you can hide the Solar panel for interior views and show it for exterior views.

---

## Rooms panel (SpaceMenu)

The Rooms panel — implemented by the internal `SpaceMenu` component — is a scrollable list of navigable rooms displayed in the right column of the viewer, below the Solar panel. Each room is clickable to navigate to that location. In Admin Mode the panel is always visible; the **Rooms** User Visibility toggle controls whether users see it.

Two things to know about Rooms panel navigation:

- Clicking a room in the Rooms panel **only navigates the camera**. It does not change lighting, environment, exposure, materials, or geometry visibility.
- The exception is the overhead space-tile click (`SpaceTileClickNav`). See [Overhead space-tile click](#overhead-space-tile-click-spacetileclicknav) above.

---

## Floor Nav debug tool

A **Floor Nav** button appears in the Views Panel in Admin Mode. Toggling it on overlays a debug visualization showing:

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
3. Press each View button and confirm it replays the captured pose.
4. Switch presentation modes and confirm each mode renders the captured environment.
5. Reload the page and confirm everything still works (persistence is browser-local — see below).

A useful diagnostic: hover any capture indicator in the header (section tabs, option buttons, view indicators, presentation mode indicators, Mat. Defaults). After a 3-second delay a tooltip appears showing the exact stored payload, with a Copy button. This is the easy way to verify what was captured without opening browser developer tools.

---

## Persistence

Authored work is saved automatically to your browser's local storage, keyed by model. Reload the page and your captures come back — for the built-in demo models.

What persists:

- Section captures, view captures, presentation mode captures, option captures, model defaults.
- Section/option label renames.

What does **not** persist:

- Work on uploaded ad-hoc `.glb` files. Reloading clears them.

### Reset Model

The **Reset Model** button in the header clears all captures for the current model in one action — section captures, view captures, presentation mode captures, option captures, and model defaults. It asks you to confirm before clearing.

### Capture indicators in the overlay vs. the header

Two sets of capture indicators exist:

- **Header indicators** (Summer Day, Summer Night, Exterior, Interior, etc., plus Mat. Defaults). These reflect what is actually stored in your saved state. They survive reloads and are the reliable source of truth for what has been captured. They light up blue when a capture is stored.
- **Authoring overlay indicators** (the highlighted state on individual capture buttons). These reflect the current session only. They reset on page reload because the system has no way to distinguish "this is a freshly captured value" from "this value was just loaded from storage." Use the header indicators for capture status.

### Clear buttons are always enabled

**Clear Material Defaults**, **Clear View Capture**, and **Clear Mode Capture** are always clickable, even when the overlay shows no captured value for the current session. This is intentional — your saved state may hold a capture from a previous session that the overlay doesn't know about. Clicking the clear button always removes any persisted value.

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

- **Sections own presentation** — pose, presentation mode reference, visibility, User Visibility flags
- **Views own reusable basepoints** — pose, presentation mode reference, visibility, User Visibility flags, per camera mode slot
- **Presentation modes own the full visual environment** — HDR, terrain, lighting, solar, point lights, exposure
- **Options own configuration effects** — geometry membership and material assignments per option
- **Model defaults own the baseline appearance** — material assignments applied before any option assignments

Recommended order for a new model: Presentation Mode → Views → Sections → Options (geometry then materials) → Model Defaults (anytime, optional).

Admin Mode is for authoring; turn it off to enter display mode.

---

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
