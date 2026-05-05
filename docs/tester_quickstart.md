# Tester Quickstart

**Primary reader:** Non-technical tester
**Goal:** Get to a working configuration in about 15 minutes
**Next doc:** [Admin Authoring Guide](admin_authoring_guide.md), once you're comfortable with the basics

---

Thank you for taking the time to test this early build. This is early-stage software, and your experience — what feels clear, what's confusing, what breaks — is genuinely valuable feedback.

This guide walks you from your first page load to a working authored configuration in about 15 minutes. No technical background is needed.

---

## What You Are Looking At

Open the test site: **https://bp-viewer-theta.vercel.app/**

This is a configurable product viewer. The idea is that a company selling a repeatable, customisable product — a cabin, a tiny home, a boat — can author a guided 3D experience for their customers. Customers browse sections of the product (Roof, Flooring, Solar Package, etc.), choose options within each section, and see the result immediately in 3D.

What you are testing today is the **authoring side** of that experience — the tools an admin uses to set up how the product looks and behaves before a customer ever sees it.

The interface has three main areas:

- **Header** — model selector, the Admin Mode toggle, presentation-mode pills, and capture status indicators
- **3D Viewer** — the main product view, taking up most of the screen
- **Sections and Options panel** — below the viewer; this is where customers would make their configuration choices, and where you select what you are currently authoring

---

## Choosing a Model

Use the dropdown in the header to select one of the available demo models. The **Ready** indicator on the left side of the header will show "Loading…" while the model loads and turn green once it is ready. Give it a moment — the first load on a cold connection can take a few seconds.

You can also upload your own `.glb` file using the **Upload .glb** button. Note that work you do on an uploaded model is not saved between sessions — if you reload the page it starts fresh. Use the built-in demo models if you want your authoring work to persist.

---

## Camera Controls

How you move the camera depends on the camera mode of the current view (set when each section was captured — Exterior, Interior, or Overhead).

**Exterior and overhead modes**

- **Orbit** — left-click and drag to rotate around the model
- **Zoom** — scroll wheel
- **Pan** — right-click and drag

**Interior mode**

- **Look around** — left-click and drag to look in any direction from your current position
- **Move to a new spot** — click anywhere on the floor to navigate there

**Overhead mode — floor-tile click**

If you click directly on the floor of a room while in overhead mode, the camera will navigate down into that interior space.

In user mode, camera mode is set by whichever section is active. Clicking between sections animates the camera to whatever pose and view mode that section was captured with. There is no separate "view selector" for end users — the section is the camera selector.

In Admin Mode, an extra **View row** (Exterior / Interior / Overhead) appears at the top of the Section tab in the authoring overlay. These are admin-only conveniences — they jump you to default poses while you're framing a section, before you capture.

---

## Understanding Sections and Options

The demo is set up with placeholder sections — **Section 1** through **Section 4** — each with placeholder options — **Option 1** through **Option 4**.

Think of sections as major decision areas for the product (Roof Type, Interior Finish, Solar Package, Lighting). Think of options as the choices within each section (Metal Roof / Shingle Roof; Standard Lighting / Premium Lighting).

The section and option labels are placeholders for now. In Admin Mode you can rename any section or option label using the **Rename** button that appears alongside each one — this lets you try out real product terminology without affecting any captured data.

The authoring tools let you attach real meaning to each section and option: a specific camera angle, a lighting environment, material changes, geometry visibility — all of which replay deterministically when a customer selects that section or option.

---

## Enabling Admin Mode

Find the **Admin Mode** button in the header and click it. It will highlight to show it is active.

The **Authoring Panel** appears as an overlay on the left side of the viewer. This is where all the capture tools live. The panel has three internal tabs at the top:

- **Section** — capture and clear actions for sections, geometry visibility tools, User Visibility toggles, Camera Mode selector
- **Option** — capture and clear actions for options, the materials picker, model default materials, geometry tools
- **pMode** — capture and clear actions for the active presentation mode, lighting and environment sliders, HDR / terrain / light source mode

You click the tab that matches what you're authoring against. The two top rows in the Section and pMode tabs are admin-only conveniences:

- **Section tab → View row** (Exterior / Interior / Overhead): jumps the camera to the Viewer's built-in default pose for that camera mode. Useful as a starting point before framing your section.
- **pMode tab → pMode helper buttons** (Summer Day / Summer Night / Winter Day / Winter Night, four buttons): loads the Viewer's built-in lighting defaults, plus the snowy HDRI/terrain pair for the winter buttons. Useful when you want a sensible starting point for a presentation mode.

Both are pure shortcuts — they don't save anything, they just set up a starting state. To save, you still click the Capture button in the active tab.

In the DemoApp header, six **pMode pills** (Summer Day, Summer Night, Summer Night Interior, Winter Day, Winter Night, Winter Night Interior) live separately. These are the **slots** your captured presentation modes are stored under. Clicking a pill in admin mode makes that slot "active" so the next Mode Capture lands there. (The four AuthoringPanel helper buttons and the six header pills are intentionally separate surfaces — helpers seed lighting defaults; pills route stored captures.)

To return to the clean customer-facing view, click **Admin Mode** again to turn it off.

---

## Your First Authoring Exercise

Work through these four steps in roughly this order. Each one builds on the previous, but you do not have to follow the order strictly — once you have one Presentation Mode captured, you can revisit any step in any order as needed.

### Step 1 — Capture a Presentation Mode

A presentation mode is a complete visual environment — HDR sky, terrain, lighting, solar position, exposure, ambient. Each section you capture later will store the full presentation snapshot at the moment of capture, but having a captured mode first gives you a one-click "starting point" you can apply repeatedly.

Start with **Summer Day**:

1. Click the **Summer Day** pill in the header to make it the active slot
2. Open the **pMode** tab in the authoring panel
3. (Optional) click the **Summer Day** helper button at the top of the pMode tab to load built-in daytime lighting defaults — a faster starting point than dragging sliders from scratch
4. Adjust the lighting and environment settings until you like the daytime look
5. Click **Mode Capture** at the top of the pMode tab to save into the active slot

You can return later to capture other modes (Summer Night, Winter Day, etc.). Winter modes can be left uncaptured if your product does not need a winter presentation.

The precise lighting setup can be refined later — capturing a reasonable first pass now is enough to move forward.

---

### Step 2 — Capture Sections

A section capture is a stored "moment" for one product section: a camera pose + camera mode + the full presentation snapshot at capture time + geometry visibility.

For each section:

1. Click the section tab (e.g. **Section 1**) to make it active
2. (Optional) click a **View** button at the top of the AuthoringPanel's Section tab (Exterior / Interior / Overhead) to land at a default pose, then orbit/zoom/pan to your section's hero angle
3. (Optional) click a pMode pill in the header (e.g. **Summer Day**) to apply the lighting you captured in Step 1 — this loads the stored snapshot into the live view
4. Set the matching **Camera Mode** in the Section tab (Ext / Int / Ovh) — this labels the mode that will be stored, it does *not* move the camera
5. Set the **User Visibility** toggles for which panels customers should see when this section is active. There are three:
   - **Solar** — show or hide the Solar / Site panel
   - **Rooms** — show or hide the Rooms panel
   - **North** — show or hide the North Arrow overlay
6. (Optional) hide any presentation-context geometry — for an overhead section you'll usually hide the roof so the floor plan is visible
7. Click **Section Capture**

**Sections without options.** Some sections may exist purely as stored "view-like" moments — no options associated. The capture workflow is identical; just don't author options for that section.

**Testing the replay.** To see the camera animation working, capture **at least two sections**. Then click between them — each click should animate the camera to the position and lighting you captured for that section. Switching to a section that has no capture leaves the current view alone (the Viewer preserves whatever state is already on screen).

To remove a capture and start over, click **Section Clear** while that section is active.

You can rename section labels at any time using the **Rename** button beside each section tab in Admin Mode.

---

### Step 3 — Capture Options

With sections captured, you can author the options within each section.

1. Click a section tab to make it active
2. Click an option button (e.g. **Option 1**) to make it active
3. Open the **Option** tab in the authoring panel (it should be ready to go after clicking the option button)
4. Use the geometry visibility and material assignment controls to configure what this option looks like — select parts of the model, hide / show, edit color / roughness / metalness, or apply a library texture
5. Click **Option Capture**

Repeat for as many options as you want to test. Clicking between options in the same section should now show the configured changes in the viewer.

**Cross-section ownership.** Two independent rules keep the configuration system deterministic:

- A piece of geometry's **show/hide list ownership** lives in only one section (Section 1's options can hide the roof, but Section 2's options cannot).
- A piece of geometry's **material assignment ownership** lives in only one section.

The same roof piece *may* be in Section 1's show/hide list **and** Section 2's material assignments — that's allowed. But if you try to add a roof piece to Section 2's show/hide list when Section 1 already owns it (or assign a material to a roof piece another section has already assigned), the capture is rejected and a red banner explains why. To resolve, either pick different geometry or clear the conflicting capture in the other section first.

When the active option's intent is *only* to apply a material to geometry that's already owned for show/hide by another section, use the **Capture Material Only** button instead of Option Capture. It saves the material change without claiming show/hide ownership of the selected geometry, so it doesn't trip the show/hide rule.

You can rename option labels at any time using the **Rename** button beside each option button in Admin Mode.

---

### Step 4 — Generate Section Images

Once at least one section has a captured pose, the **Complete Build** button in the header turns blue.

Clicking it triggers the Viewer to render one JPEG for each captured section:

1. The camera snaps to that section's captured pose
2. The Viewer pauses briefly (about 1.5 seconds) for the render to settle — materials and shadows need a moment to resolve at full quality
3. The image is captured at full resolution (3840×2160) and downloaded to your machine

If multiple sections are captured, multiple files download in sequence — one per section, each named after the section label.

During the process the button shows "Capturing…" and is disabled. It returns to its normal state when all images have been captured.

If no sections have captures yet, the button stays neutral and clicking it has no effect. Capture at least one section first (Step 2) to enable it.

---

## Model Defaults (optional, anytime)

Some models benefit from a baseline appearance — a default exterior color the customer sees before making any choices. To set this:

1. With **no option active** (so you're not editing on top of an option assignment), open the Option tab in the authoring panel
2. Select the geometry you want to set a baseline for
3. Adjust the color, roughness, metalness, or apply a library texture
4. Click **Capture Material Defaults**

The baseline replays automatically on every load, before any option assignments. Option assignments always override defaults for the same geometry, so if every option for a piece of geometry sets its own material, the default is never visible and capturing one is unnecessary.

---

## Saving and Resetting

Your work saves automatically to your browser as you go. Reload the page and your captures will still be there, for the built-in demo models.

To wipe everything and start fresh, click **Reset Model** in the header. It will ask you to confirm before clearing.

---

## Interior Navigation

If the model has interior rooms set up, the **Rooms** panel on the right side of the viewer will list them. Click any room to navigate there.

In Overhead view, you can also click directly on the floor to navigate into that room.

Note that interior navigation requires navigation markers to be set up in the model file. Not all demo models may have these — if you find the Rooms list is empty or interior navigation is not working for a particular model, that is expected for now.

---

## What to Watch For

As you explore, please note anything that:

- **Feels confusing or unclear** — steps that required guesswork, labels that did not explain themselves, anything you had to try twice
- **Behaved unexpectedly** — captures that did not replay correctly, camera motion that felt wrong, sections or options that did not update the viewer as expected
- **Broke or produced an error** — anything that stopped working, showed a red error banner, or left the viewer in a broken state
- **Felt slow** — model load times, camera animation, response to option changes

If you can include a brief description of what you were doing when something happened, and what you expected vs. what actually happened, that is the most useful form of feedback.

---

## Known Rough Edges

A few things to be aware of in this early version so they do not surprise you:

- **Section and option labels are placeholders** — use the Rename button in Admin Mode to give them meaningful names for your testing. Label changes are display-only and do not affect captured data.
- **The authoring tools are a working prototype** — the admin overlay is functional but not yet polished. Some controls are more refined than others.
- **Persistence is browser-local** — there is no cloud save or account yet. Your work lives in this browser only.
- **Uploaded models are not persisted** — reload the page and any work on an uploaded model is lost.
- **Some demo models have more set up than others** — if a model appears as a plain grey shape with no authored sections, it is a blank canvas ready for authoring rather than a finished demo.
- **Interior navigation depends on model preparation** — if a model does not have navigation markers, interior pathfinding will not be available for that model.
- **Pivots and slides reset on reload** — if a model has click-to-rotate doors or click-to-slide panels, opening them is a per-session interaction. Reload returns them all to closed; this is by design.

---

## Short Summary

1. Open **https://bp-viewer-theta.vercel.app/**
2. Select a demo model and wait for **Ready**
3. Explore with the camera controls
4. Click **Admin Mode** to enable the authoring overlay (Section / Option / pMode tabs)
5. Capture at least one Presentation Mode (Summer Day to start) via the pMode tab
6. Capture at least two Sections via the Section tab — to see the camera-replay animation between them
7. Capture Options within each section via the Option tab
8. Once sections are captured, click **Complete Build** in the header to generate one JPEG per captured section
9. Note anything that surprises, confuses, or breaks

Thank you for testing.
