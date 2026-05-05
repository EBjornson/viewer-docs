# Tester Quickstart

**Primary reader:** Non-technical tester
**Goal:** Get to a working configuration in about 15 minutes
**Next doc:** [Admin Authoring Guide](admin_authoring_guide.md), once you're comfortable with the basics

---

Thank you for taking the time to test this early build. This is early-stage software, and your experience — what feels clear, what's confusing, what breaks — is genuinely valuable feedback.

This guide will walk you from your first page load to a working authored configuration in about 15 minutes. No technical background is needed.

---

## What You Are Looking At

Open the test site: **https://bp-viewer-theta.vercel.app/**

This is a configurable product viewer. The idea is that a company selling a repeatable, customisable product — a cabin, a tiny home, a boat — can author a guided 3D experience for their customers. Customers browse sections of the product (Roof, Flooring, Solar Package, etc.), choose options within each section, and see the result immediately in 3D.

What you are testing today is the **authoring side** of that experience — the tools an admin uses to set up how the product looks and behaves before a customer ever sees it.

The interface has three main areas:

- **Header** — model selector, the Admin Mode toggle, and a row of status indicators showing what has been captured and saved
- **3D Viewer** — the main product view, taking up most of the screen
- **Sections and Options panel** — below the viewer; this is where customers would make their configuration choices, and where you select what you are currently authoring

---

## Choosing a Model

Use the dropdown in the header to select one of the available demo models. The **Ready** indicator on the left side of the header will show "Loading…" while the model loads and turn green once it is ready. Give it a moment — the first load on a cold connection can take a few seconds.

You can also upload your own `.glb` file using the **Upload .glb** button. Note that work you do on an uploaded model is not saved between sessions — if you reload the page it starts fresh. Use the built-in demo models if you want your authoring work to persist.

---

## Camera Controls

**Exterior and overhead view**

- **Orbit** — left-click and drag to rotate around the model
- **Zoom** — scroll wheel
- **Pan** — right-click and drag

**Interior view**

- **Look around** — left-click and drag to look in any direction from your current position
- **Move to a new spot** — click anywhere on the floor to navigate there

Use the **Exterior**, **Interior**, and **Overhead** buttons in the Views Panel (visible on the right side of the viewer) to switch between view modes.

In **Overhead view**, clicking directly on the floor plan will navigate the camera into that interior space automatically.

---

## Understanding Sections and Options

The demo is currently set up with four placeholder sections — **Section 1** through **Section 4** — each with four placeholder options — **Option 1** through **Option 4**.

Think of sections as major decision areas for the product (Roof Type, Interior Finish, Solar Package, Lighting). Think of options as the choices within each section (Metal Roof, Shingle Roof; Standard Lighting, Premium Lighting).

The section and option labels are placeholders for now. In Admin Mode you can rename any section or option label using the **Rename** button that appears alongside each one — this lets you try out real product terminology without affecting any captured data.

The authoring tools let you attach real meaning to each section and option: a specific camera angle, a lighting environment, material changes, geometry visibility — all of which replay deterministically when a customer selects that section or option.

---

## Enabling Admin Mode

Find the **Admin Mode** button in the header and click it. It will highlight to show it is active.

An authoring overlay will appear on the left side of the viewer. This is where all the capture tools live. The overlay is **context-aware**: its content adapts to whatever you most recently clicked.

- Click a **Section tab** → the overlay shows section capture tools (camera, lighting, geometry visibility for that section)
- Click an **Option button** → the overlay shows option capture tools (material changes, geometry membership)
- Click a **View button** (Exterior / Interior / Overhead) → camera navigates to that default pose (admin authoring convenience)
- Click a **Presentation Mode button** (Summer Day, Winter Night, etc.) → the overlay shows the presentation settings for that mode

You don't need to switch tabs — just click whatever you want to author and the overlay follows.

To return to the clean customer-facing view, click **Admin Mode** again to turn it off.

---

## Your First Authoring Exercise

Work through these five steps in roughly this order. Each one builds on the previous, but you do not have to follow the order strictly — once you have one Presentation Mode captured, you can revisit any step in any order as needed.

---

### Step 1 — Set Up a Presentation Mode

DemoApp's header has two rows of presentation mode pills: **Summer Day / Summer Night / Summer Night Interior** and **Winter Day / Winter Night / Winter Night Interior**. Each pill is an App-side capture slot — clicking one in admin mode loads its stored snapshot (or seeds nothing if uncaptured). Each mode stores a complete visual environment — HDR sky, terrain, lighting levels, solar position, and more.

Start with **Summer Day** — capturing at least one pMode early means you can use it as a starting point when you author sections (in admin mode, click a pMode pill in the App header to load that pMode's stored snapshot before tweaking and capturing a section).

1. Click **Summer Day** to make it active
2. In the authoring overlay, adjust the lighting and environment settings to suit a daytime look
3. Click **Mode Capture** at the top of the authoring overlay to save it

You can return later to capture other modes (Summer Night, Winter Day, etc.). Winter modes can be left uncaptured if the product does not have a winter presentation — use the **Winter** User Visibility toggle to hide that row from users.

The precise lighting setup can be refined later — capturing a reasonable first pass now is enough to move forward.

---

### Step 2 — Capture Your Three Views

The Views Panel on the right side of the viewer has three buttons: **Exterior**, **Interior**, and **Overhead**. These are the main navigation controls for customers — and they double as useful basepoints for you to return to while authoring sections.

For each view:

1. Click the view button (Exterior, Interior, or Overhead) — admin authoring convenience that navigates to the default pose for that camera mode
2. Position the camera to a good default angle for that view — orbit, zoom, and pan until it looks right
3. In the authoring overlay, set the **Presentation Mode** you want for this view — **Summer Day** is a good default for all three to start with
4. Use the **User Visibility** toggles in the authoring overlay to choose which panels appear when the customer is in this view. The six toggles are: **Solar** (Solar/Site panel), **Views** (Exterior/Interior/Overhead buttons), **Summer** (Summer mode buttons), **Winter** (Winter mode buttons), **Rooms** (Rooms panel), and **North** (North Arrow). For example, you might hide the Solar/Site panel for interior views, or hide the Rooms panel for exterior views
5. Click **View Capture** to save

Repeat for all three views. Once captured, clicking Exterior, Interior, or Overhead in the Views Panel will animate the camera to exactly the position and environment you set.

---

### Step 3 — Set Up Sections

With your presentation mode and views captured, you are ready to author sections.

Section captures include the active Presentation Mode reference, so confirm your preferred Presentation Mode (likely **Summer Day**) is active before each section capture.

For each section:

1. Click the section tab (e.g. **Section 1**) to make it active
2. Use the View buttons (top of the AuthoringPanel's Section tab) and camera controls to position the viewer for that section's hero angle (a common move is to press a View button to land at a default pose, then orbit/zoom from there)
3. Click **Section Capture** in the authoring overlay

**Testing the replay:** To see the camera animation working, capture **at least two sections**. Then click between them — each click should animate the camera to the position and environment captured for that section. Switching between a captured section and an uncaptured one will not produce a camera animation or change the presentation state — the Viewer preserves whatever presentation is currently active.

To remove a capture and start over, click **Clear Section Capture** while that section is active.

You can rename section labels at any time using the **Rename** button that appears alongside each section tab in Admin Mode.

---

### Step 4 — Set Up Options

With sections captured, you can author the options within each section.

1. Click a section tab to select it
2. Click an option button (e.g. **Option 1**) to select it — the authoring overlay automatically switches to option-authoring controls
3. Use the geometry visibility and material assignment controls to configure what this option looks like
4. Click **Option Capture** to save

Repeat for as many options as you want to test. Clicking between options in the same section should now show the configured changes in the viewer.

**Cross-section ownership:** there are two independent rules — show/hide ownership and material assignment ownership — each exclusive across sections. So a roof piece's *show/hide* list ownership lives in only one section, and a roof piece's *material* assignment lives in only one section. The same roof piece *may* be in Section 1's show/hide list **and** Section 2's material assignments — that's allowed. But if you try to add a roof piece to Section 2's show/hide list when Section 1's show/hide list already owns it (or assign a material to a roof piece another section has already material-assigned), the capture is rejected and a red banner explains why. To resolve, either pick different geometry or clear the conflicting capture in the other section first.

When the active option's intent is *only* to apply a material to geometry that's already owned for show/hide by another section, use the **Capture Material Only** button instead of Option Capture. It saves the material change without claiming show/hide ownership of the selected geometry, so it doesn't trip the show/hide rule.

You can rename option labels at any time using the **Rename** button that appears alongside each option button in Admin Mode.

---

### Step 5 — Generate Section Images

Once at least one section has a captured pose, the **Complete Build** button in the header turns blue.

Clicking it triggers the Viewer to render one JPEG for each captured section:

1. The camera snaps to that section's captured pose
2. The Viewer pauses briefly (about 1.5 seconds) for the render to settle — materials and shadows need a moment to resolve at full quality
3. The image is captured at full resolution (3840×2160) and downloaded to your machine

If multiple sections are captured, multiple files download in sequence — one per section, each named after the section label.

During the process the button shows "Capturing…" and is disabled. It returns to its normal state when all images have been captured.

If no sections have captures yet, the button stays neutral and clicking it has no effect. Capture at least one section first (Step 3) to enable it.

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

---

## Short Summary

1. Open **https://bp-viewer-theta.vercel.app/**
2. Select a demo model and wait for **Ready**
3. Explore with the camera controls
4. Click **Admin Mode** to enable the authoring overlay
5. Capture at least one Presentation Mode (Summer Day to start)
6. Capture your three Views (Exterior, Interior, Overhead) — camera position, presentation mode reference, and user visibility
7. Capture at least two Sections to see the replay animation
8. Capture Options within each section
9. Once sections are captured, click **Complete Build** in the header to generate one JPEG per captured section
10. Note anything that surprises, confuses, or breaks

Thank you for testing.
