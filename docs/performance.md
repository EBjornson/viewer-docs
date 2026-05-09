# Performance

This page is the working reference for keeping the Viewer smooth as models grow more complex. It's organized for **fast triage** when something feels jittery, plus **authoring budgets** to anchor what "fits" today.

The Viewer's real-world frame rate is dominated by GPU fragment-shader cost during transit (camera animations through the model), not main-thread JS. Knowing that shapes every lever below.

## TL;DR — current state

A model on a Retina display (devicePixelRatio=2) with the audit's reference setup (5 shadow casters, ~150 visible meshes, alphaHash dithering) hits **60 fps with zero frame drops > 18 ms** during every camera-animation cell, including the worst-case ovh→int pathNav. The shipped levers (memoization, shadow-update gating, fade-shadow throttle, animation-only DPR drop) are doing the heavy lifting. If you're seeing jitter, something has changed: model got more complex, a new code path is bypassing the gating, or the measurement environment is pathological.

## Where the frame budget goes

A render frame in the Viewer typically spends time, in order:

1. **GPU scene render** — fragment-shader work scaling with `pixelRatio² × visible-mesh-coverage × material-cost`. **This is the bottleneck during pathNav transit** at full DPR=2.
2. **GPU shadow map render** — only when `gl.shadowMap.needsUpdate = true`. Re-renders all 5 shadow casters (sun + 4 marker spots). ~10–15 ms per bump on the reference scene.
3. **Three.js update** — matrix world updates, frustum culling, sorting. ~1–2 ms.
4. **R3F useFrame callbacks** — `CameraAnimator`, `ViewerOrbitControls`, the various controllers. ~1–2 ms.
5. **React reconciliation** — only on actual state changes (not every frame; `frameloop="demand"` + memoized child components). ~30–80 ms on a Section pill click; effectively zero between clicks.

When frames drop > 50 ms, suspect **GPU shadow regen** (look at #2). When frames sustain ~30 Hz with no individual long task, suspect **GPU scene render at full DPR** (look at #1). When the click handler itself stalls, suspect **React reconciliation** (#5).

## Authoring budgets

These are the proven-fits-today numbers for the reference model on a 2× DPR Retina display. They're not contractual limits; treat them as the territory we know is safe. Push past them and re-measure.

| Budget | Reference | What costs more if exceeded |
|---|---|---|
| Visible meshes during transit | ~150 | GPU scene render (#1 above) — pathNav cells are the first to drop fps |
| Cloned materials | ~189 | Each gets its own `customDepthMaterial` for alphaHash; shadow-pass cost scales |
| Shadow casters (lights with `castShadow`) | 5 (1 sun + 4 marker spots) | Every shadow re-render re-renders ALL casters; cost is multiplicative |
| Spot shadow map size | 512² each | Quadratic in resolution. 1024² would 4× spot shadow cost |
| Sun shadow frustum | 60 × 60 | Tuned for the reference scene size; bias values are calibrated to it |
| Light markers (`_PL`, `_SL[deg]`) | ~12 (8 point + 4 spot) | Point lights don't cast shadows (cheap); spot lights do (see above) |
| Concurrent fades | ~10 meshes per crossfade | Throttled per F3 — see below |

**Canary**: the longest cross-mode pathNav (e.g. `S5→S1` ovh→int with orbit pre-alignment + multi-segment path) is the first cell to drop frames when the budget tightens. Re-measure it after any model authoring change.

## Shipped levers — what attacks what

Each entry: what it does, what cost it attacks, where it lives.

| Lever | Attacks | Source |
|---|---|---|
| `React.memo` on heavy leaves (`NorthArrow`, `FloorPointClickNav`, `ExteriorOrbitClickNav`, `SolarPanel`, `SpaceMenu`, `SceneLights`) | React re-render cascade on `selectionKey` bump | [ViewerSceneCanvas.jsx](src/viewer/components/ViewerSceneCanvas.jsx), [SolarPanel.jsx](src/viewer/components/SolarPanel.jsx), [SpaceMenu.jsx](src/viewer/components/SpaceMenu.jsx), [SceneLights.jsx](src/viewer/components/SceneLights.jsx) |
| `useMemo` on `viewerNavigationState` / `viewerSceneState` | Wrapper-object ref churn into `ViewerRoot`/`ViewerSceneCanvas` | [ViewerRuntime.jsx:658,675](src/viewer/ViewerRuntime.jsx#L658) |
| Shadow `needsUpdate` content-fingerprint dedup | Redundant full shadow re-renders on Section pill clicks where visibility content didn't actually change | `ShadowMapAutoUpdate` in [ViewerSceneCanvas.jsx](src/viewer/components/ViewerSceneCanvas.jsx) |
| Shadow `needsUpdate` 50 ms grace + apply-on-animation-complete | Mid-animation shadow re-render stalling a single frame on the GPU during cross-mode transitions | same |
| Fade-driven shadow update throttle (every-3rd-frame + final-bump) | The 27-frames-of-shadow-pass cost during a 450 ms crossfade | [VisibilityFadeController.jsx](src/viewer/components/VisibilityFadeController.jsx) |
| **Animation-only DPR drop** | GPU fragment cost during camera-animation transit on Retina displays — biggest single win | `AnimationDprGate` in [ViewerSceneCanvas.jsx](src/viewer/components/ViewerSceneCanvas.jsx) |

Other architectural levers already in place from earlier perf work:
- `frameloop="demand"` ([ViewerSceneCanvas.jsx](src/viewer/components/ViewerSceneCanvas.jsx)) — render only when `invalidate()` is called.
- `gl.shadowMap.autoUpdate = false` ([`ShadowMapAutoUpdate`](src/viewer/components/ViewerSceneCanvas.jsx)) — shadows never re-render unless `needsUpdate = true`.
- `gl.compileAsync` for shader pre-warming ([`ShaderPreCompile`](src/viewer/components/ViewerSceneCanvas.jsx)).
- alphaHash dithering instead of `transparent + opacity` for visibility fade ([useSceneVisibility.js](src/viewer/hooks/useSceneVisibility.js)).
- Eager material clone with `customDepthMaterial` attach to pre-warm patched-shader compiles ([modelPreparationUtils.js](src/utils/modelPreparationUtils.js)).

## How to measure

### In-browser, no Chrome DevTools needed

A self-scheduling rAF tick + `PerformanceObserver` for long tasks. Captures real per-frame deltas, fps, drop counts, blocking-task counts. Paste into the dev console:

```js
window.__perfWatch = (() => {
  const W = { longTasks: [], rafTimes: [], _activeWatch: false };
  W.startWatch = () => {
    W.longTasks = []; W.rafTimes = []; W._activeWatch = true;
    const tick = (ts) => { if (!W._activeWatch) return; W.rafTimes.push(ts); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  W.stopWatch = () => { W._activeWatch = false; };
  W.summary = () => {
    const deltas = []; for (let i = 1; i < W.rafTimes.length; i++) deltas.push(W.rafTimes[i] - W.rafTimes[i - 1]);
    const wallMs = W.rafTimes.length > 1 ? W.rafTimes.at(-1) - W.rafTimes[0] : 0;
    return {
      frames: W.rafTimes.length, wallMs: Math.round(wallMs),
      fps: Math.round((W.rafTimes.length - 1) * 1000 / wallMs * 10) / 10,
      top10: [...deltas].sort((a, b) => b - a).slice(0, 10).map(d => Math.round(d)),
      drops50: deltas.filter(d => d > 50).length,
      drops18: deltas.filter(d => d > 18).length,
      longTasks: W.longTasks.filter(t => t.duration >= 50).length,
    };
  };
  new PerformanceObserver((list) => { for (const e of list.getEntries()) W.longTasks.push({ start: e.startTime, duration: e.duration }); })
    .observe({ entryTypes: ['longtask'] });
  return W;
})();

// Usage:
__perfWatch.startWatch();
// ... click a Section pill, wait for the animation to complete, then:
__perfWatch.stopWatch();
__perfWatch.summary();
```

Read the output:
- `drops50 > 0` → a frame took > 50 ms (likely GPU shadow regen, GPU scene render spike, or main-thread long task).
- `drops18 > 5%` of total frames → sustained sub-vsync rendering (likely GPU fragment-shader cost during transit).
- `longTasks > 0` → main-thread blocking ≥ 50 ms (look at React reconciliation, click handler).
- `top10` deltas all 16–18 ms → 60 fps clean.
- `top10` deltas clustered at 33–34 ms → 30 fps GPU-bound.

Run twice; first run can be cold (shader compile, GPU resource alloc). Second run is the real number.

### Chrome DevTools trace + call-tree parser

When the rAF watcher says "drops happen but I don't know why," capture a Chrome perf trace through the DevTools Performance tab (or via Chrome DevTools MCP if you have it), save the JSON, then parse the V8 sample profiler chunks to bucket time by leaf function during a chosen window.

A reusable parser stub lives at `/tmp/parse-trace.mjs` during audits — its core idea:
1. Find the click event timestamp.
2. Define an animation window (`click+200ms` to `click+4000ms`) skipping the click handler tax.
3. Reconstruct the `ProfileChunk` samples + `timeDeltas` into per-sample timestamps.
4. Bucket samples by leaf-function self time AND by full-stack total time.
5. Filter to user-source-only paths to focus on app code.

Use it when the symptom is sustained sub-vsync rendering. Look for high `WebGLRenderer.render`, `WebGLShadowMap.render`, or `setProgram` totals. If those dominate and main-thread script time is light, you're GPU-bound — see the levers list.

### What NOT to use

- Chrome DevTools' "INP" alone — only catches the click handler, misses the steady-state animation drops that matter most.
- `PerformanceObserver({ type: 'long-animation-frame' })` alone — gives the right shape (script time vs render time within a single frame) but only fires for frames > 50 ms, missing sustained 30 Hz where every frame is 33 ms.

## Symptom → likely cause

| Symptom | First place to look |
|---|---|
| Click feels laggy (~150 ms) but animation runs smooth | React reconciliation cost; check that any new heavy children of `ViewerSceneCanvas` / `ViewerRuntime` are memoized |
| One ~100 ms stall mid-animation, then smooth | Shadow re-render firing during animation — verify the F2 defer + content fingerprint cover the trigger |
| Sustained ~30 Hz throughout transit (every frame ~33 ms) | GPU fragment cost; verify `AnimationDprGate` is wrapping that animation type (not all scene-motion uses `animationTarget`) |
| Sustained ~30 Hz only during a fade window (~450 ms after click) | F3's fade-shadow throttle isn't firing — check `VisibilityFadeController`'s every-3rd-frame logic |
| Frame drops only on the FIRST animation after page load | Cold shader cache; verify `ShaderPreCompile` is firing on `loadedObject` change |
| Cold-load is slow | Out of scope for this doc — see the early-perf-series commits (`7ad8012`, `9412373`, `bb4269d`, `a1be960`); also the `project_startup_perf` memory entry |

## Levers considered but not shipped

Documented so future investigations don't re-walk the same dead ends.

- **Drop `SPOT_SHADOW_MAP_RES` from 512² to 256²**: tested, no measurable gain. With shadow updates already gated by F2/F3 to fire only during fades, the spot-shadow render frequency is too low for the resolution drop to matter. **Visual cost would be real (fuzzier spot shadows in interior); benefit was not.** Reverted.
- **Permanent `dpr=1`** (always low-DPR): tested, hits 60 fps everywhere. **Visual cost is too high** — the at-rest view of the model is noticeably pixelated on Retina. Animation-only DPR drop is the right balance. **Don't lower this further** unless we add an at-rest dpr restore that fades smoothly.
- **Defer fade-driven shadow updates entirely (skip during animation, snap at end)** instead of F3's throttle: tested implicitly, would create a visible "shadow snap" at fade-end where a fading mesh's cast shadow suddenly appears or disappears. Throttle is the right pattern.
- **Stabilize `visibilityAssignments` ref upstream in DemoApp** to prevent ref churn into the Viewer: explored, would require restructuring DemoApp's `viewerInput` memo. The downstream content-fingerprint dedup at the Viewer (F2) achieves the same end-state without touching App code. Keep the dedup.

## When models grow more complex

The likely failure modes, in order of when they'll bite:

1. **Visible mesh count exceeds budget** (~150). pathNav transit cells start dropping frames first. **Mitigation**: aggressive culling (e.g. occlusion culling for meshes hidden by walls), or lowering `dpr` further during animation (e.g. `Math.min(0.75, baseDpr)` if 1 isn't enough).
2. **Shadow caster count grows past 5**. Shadow re-render during fades takes longer; the F3 every-3rd-frame throttle becomes insufficient. **Mitigation**: drop `castShadow` from less-important lights, or lower spot shadow map size for marginal lights only.
3. **Cloned material count grows past ~250**. Each material clone creates its own `customDepthMaterial` patched-shader; deep-clone cost on model-load goes up (this is what 7ad8012 fixed in 2026-04). **Mitigation**: re-share materials where possible during model prep, or accept the load-time hit.
4. **Per-frame React work creeps back in**. New components in `ViewerSceneCanvas` / `ViewerRuntime` not memoized. **Mitigation**: re-run the rAF watcher with the [DevTools React Profiler](https://react.dev/reference/react/Profiler) to find unmemoized re-renders; apply F1-style `React.memo` wraps.

When you do hit one of these, the measurement loop is: run the rAF watcher, identify which symptom row matches, apply the lever or budget tweak, re-measure.

## Memory entries (project history)

A few memory entries record specific calibrations not worth duplicating here:
- `project_shadow_bias` — sun bias values for the 60×60 frustum.
- `project_spot_shadow_near` — why spot shadow camera near=0.05 (not stock 0.5).
- `project_startup_perf` — cold-load tuning history.
- `project_memory_management` — model cache eviction, material/texture disposal.
