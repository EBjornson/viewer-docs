import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SECTION_DEMO_ITEMS } from './sectionDemoConfig'
import { modelManifest } from './modelManifest'
import { compositeInfoOverlay } from './captureImageOverlay'
import {
  findOptionCaptureConflicts,
  findExistingCrossSectionViolations,
  mergeOptionCapture,
} from './crossSectionConflicts'
import { CaptureConflictBanner, LoadViolationsBanner } from './CaptureConflictBanners'
import { CaptureTooltip } from './CaptureTooltip'
import { usePModeResolver } from './usePModeResolver'

// ─── Persistence ────────────────────────────────────────────────────────────

// Storage key bumped v2 → v3 for the v1.8 contract. v1.7 captures (under
// `demoapp_v2_*`) are orphaned cleanly — the App ignores them, but they
// remain in localStorage until the user manually clears via DevTools or
// switches browsers. No automatic migration path.
const STORAGE_KEY = 'demoapp_v3'

function loadCaptures(modelId) {
  if (!modelId) return null
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${modelId}`)
    return raw ? JSON.parse(raw) : null
  } catch (err) {
    console.warn(`[DemoApp] Failed to parse captures for ${modelId}:`, err)
    return null
  }
}

function saveCaptures(modelId, data) {
  if (!modelId) return
  try {
    localStorage.setItem(`${STORAGE_KEY}_${modelId}`, JSON.stringify(data))
  } catch {
    // localStorage may be unavailable (private mode) or full (quota exceeded);
    // captures will simply not persist this session, which is acceptable.
  }
}

// ─── Module-level defaults (computed once) ──────────────────────────────────

const DEFAULT_MODEL_ID = modelManifest[0]?.id || null
const DEFAULT_SELECTED_OPTIONS = Object.fromEntries(
  SECTION_DEMO_ITEMS.map((s) => [s.id, s.options[0]])
)
const INITIAL_SAVED = loadCaptures(DEFAULT_MODEL_ID)

// pMode taxonomy — DemoApp's 6-mode convention (App-side, not in the
// contract). The 2D shape mirrors the rendered pill grid (Summer row +
// Winter row); also drives the cold-start default and any "first key wins"
// derivation. Keeping the keys here as the single source of truth means the
// taxonomy can be reordered/renamed in one place.
const PMODE_ROWS = [
  [
    { key: 'day', label: 'Summer', fullName: 'Summer Day' },
    { key: 'nightExt', label: 'Night', fullName: 'Summer Night Exterior' },
    { key: 'nightInt', label: 'Interior', fullName: 'Summer Night Interior' },
  ],
  [
    { key: 'winterDay', label: 'Winter', fullName: 'Winter Day' },
    { key: 'winterNight', label: 'Night', fullName: 'Winter Night Exterior' },
    { key: 'winterNightInt', label: 'Interior', fullName: 'Winter Night Interior' },
  ],
]
const DEFAULT_PMODE = PMODE_ROWS[0][0].key

// ─── Styles ─────────────────────────────────────────────────────────────────

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  // Stable height regardless of which items render (admin vs user mode) and
  // how many pMode pill rows are visible. Sized to fit the tallest case:
  // admin mode with the 2-row pMode pill grid (~50px content + 20px vertical
  // padding). Items center vertically within this min-height; user mode's
  // sparser content occupies horizontal space but vertical height stays put.
  minHeight: 70,
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  flexShrink: 0,
  background: '#3c3b3b',
}

const btnBase = {
  padding: '7px 14px',
  borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'white',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const primaryBtn = { ...btnBase, background: 'rgba(72,127,255,0.42)' }
const secondaryBtn = { ...btnBase, background: 'rgba(0,0,0,0.58)' }
const activeAdminBtn = { ...secondaryBtn, background: 'rgba(72,127,255,0.42)' }

const modelSelectStyle = {
  background: 'rgba(0,0,0,0.58)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 7,
  color: 'white',
  fontSize: 12,
  padding: '7px 10px',
  cursor: 'pointer',
  maxWidth: 200,
}

// ─── Component ───────────────────────────────────────────────────────────────

// `ViewerComponent` is supplied by the entry point so DemoApp itself doesn't
// statically import any Viewer surface. main.jsx passes the source `Viewer` for
// fast HMR; main-bundle.jsx passes ViewerElementReactBridge so the only Three.js
// in scope is the one bundled inside the CDN-loaded viewer.js.
export function DemoApp(props = {}) {
  const ViewerComponent = props.ViewerComponent
  // Model selection
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID)
  const [modelObjectUrl, setModelObjectUrl] = useState(null)
  const modelUrl = modelObjectUrl
    ?? (selectedModelId ? (modelManifest.find((m) => m.id === selectedModelId)?.path ?? null) : null)

  // UI state
  const [adminEnabled, setAdminEnabled] = useState(false)
  // visualOverrideEnabled — opt-in user-facing toggle that exposes the pMode
  // pills in user mode. When on, pills with stored snapshots become clickable
  // and the active pill's snapshot replaces every section's resolved
  // presentation (override persists across section clicks — the conceptual
  // model is "show me all sections under this preset"). When off, pills are
  // hidden in user mode. Admin mode ignores this flag — pills are always
  // visible in admin for capture authoring.
  const [visualOverrideEnabled, setVisualOverrideEnabled] = useState(false)
  // selectionKey — bumped on every section selection click and on every admin
  // pMode pill click. Doubles as a useMemo dep on requestedCameraPose so
  // re-clicking the same section produces a new pose ref to retrigger
  // animation. Maps 1:1 to viewerInput.selectionKey.
  const [selectionKey, setSelectionKey] = useState(0)
  const [selectedSectionId, setSelectedSectionId] = useState(SECTION_DEMO_ITEMS[0]?.id)
  const [selectedOptions, setSelectedOptions] = useState(
    () => INITIAL_SAVED?.selectedOptions ?? { ...DEFAULT_SELECTED_OPTIONS }
  )

  // Label overrides — admin can rename sections and options
  const [sectionLabelOverrides, setSectionLabelOverrides] = useState(
    () => INITIAL_SAVED?.sectionLabelOverrides ?? {}
  )
  const [optionLabelOverrides, setOptionLabelOverrides] = useState(
    () => INITIAL_SAVED?.optionLabelOverrides ?? {}
  )

  // Inline rename editing state
  const [editingLabel, setEditingLabel] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const renameCancelRef = useRef(false)

  // Capture storage — populated by ViewerOutput callbacks
  const [sectionCaptures, setSectionCaptures] = useState(
    () => INITIAL_SAVED?.sectionCaptures ?? {}
  )
  const [optionCaptures, setOptionCaptures] = useState(
    () => INITIAL_SAVED?.optionCaptures ?? {}
  )
  const [materialDefaultCapture, setMaterialDefaultCapture] = useState(
    () => INITIAL_SAVED?.materialDefaultCapture ?? null
  )
  const [presentationModeCaptures, setPresentationModeCaptures] = useState(
    () => INITIAL_SAVED?.presentationModeCaptures ?? {}
  )

  // Viewer status
  const [viewerReady, setViewerReady] = useState(null)
  const [viewerError, setViewerError] = useState(null)

  // Cross-section ownership enforcement
  const [captureConflict, setCaptureConflict] = useState(null)
  const [loadViolations, setLoadViolations] = useState(
    () => findExistingCrossSectionViolations(INITIAL_SAVED?.optionCaptures ?? {})
  )

  useEffect(() => {
    if (loadViolations.length > 0) {
      console.warn('[DemoApp] Cross-section ownership violations in stored captures:', loadViolations)
    }
  }, [loadViolations])

  // Batch capture
  const [batchCaptureRequest, setBatchCaptureRequest] = useState({ nonce: 0, items: [] })
  const [isBatchCapturing, setIsBatchCapturing] = useState(false)
  const batchBlobsRef = useRef([])
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Capture flash feedback
  const [showCaptureFlash, setShowCaptureFlash] = useState(false)
  const captureFlashTimerRef = useRef(null)
  const triggerCaptureFlash = useCallback(() => {
    if (captureFlashTimerRef.current) clearTimeout(captureFlashTimerRef.current)
    setShowCaptureFlash(true)
    captureFlashTimerRef.current = setTimeout(() => setShowCaptureFlash(false), 180)
  }, [])

  useEffect(() => () => {
    if (captureFlashTimerRef.current) clearTimeout(captureFlashTimerRef.current)
  }, [])

  // Reset model captures — with inline confirmation
  const [confirmingReset, setConfirmingReset] = useState(false)
  const resetTimerRef = useRef(null)

  const handleResetRequest = useCallback(() => {
    setConfirmingReset(true)
    clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => setConfirmingReset(false), 5000)
  }, [])

  // Loads the seven capture/options/labels pieces from a stored snapshot
  // (or resets them to defaults if `snapshot` is null/empty). Each caller
  // layers its own additional cleanup (URL revoke, viewer status, banners)
  // around this — those vary by trigger so they stay at the call site.
  const applyCaptureSnapshot = useCallback((snapshot) => {
    setSectionCaptures(snapshot?.sectionCaptures ?? {})
    setOptionCaptures(snapshot?.optionCaptures ?? {})
    setMaterialDefaultCapture(snapshot?.materialDefaultCapture ?? null)
    setPresentationModeCaptures(snapshot?.presentationModeCaptures ?? {})
    setSelectedOptions(snapshot?.selectedOptions ?? { ...DEFAULT_SELECTED_OPTIONS })
    setSectionLabelOverrides(snapshot?.sectionLabelOverrides ?? {})
    setOptionLabelOverrides(snapshot?.optionLabelOverrides ?? {})
  }, [])

  const handleResetConfirm = useCallback(() => {
    clearTimeout(resetTimerRef.current)
    setConfirmingReset(false)
    applyCaptureSnapshot(null)
    setCaptureConflict(null)
    setLoadViolations([])
  }, [applyCaptureSnapshot])

  const handleResetCancel = useCallback(() => {
    clearTimeout(resetTimerRef.current)
    setConfirmingReset(false)
  }, [])

  useEffect(() => () => clearTimeout(resetTimerRef.current), [])

  const modelFileInputRef = useRef(null)

  // Stable refs so viewerOutput callbacks don't stale-close over selection state
  const selectedSectionIdRef = useRef(selectedSectionId)
  const selectedOptionsRef = useRef(selectedOptions)
  const optionCapturesRef = useRef(optionCaptures)
  selectedSectionIdRef.current = selectedSectionId
  selectedOptionsRef.current = selectedOptions
  optionCapturesRef.current = optionCaptures

  const sectionCapture = sectionCaptures[selectedSectionId] ?? null

  // pMode three-source merge — extracted into the published `usePModeResolver`
  // hook so CustomApps can reuse the same pattern with their own taxonomy.
  // Returns `activePMode` for the indicator pill display and `resolvedPresentation`
  // for `viewerInput.presentation`. `currentPModeRef` is exposed so the
  // capture callbacks can attach the pMode tag (`onSectionCaptured`) and route
  // pMode capture/clear payloads to the correct `presentationModeCaptures[mode]`
  // entry. Declared up here (rather than inline at the consumer site) so the
  // useCallbacks below — which include `currentPModeRef` / `pModeClearOverride`
  // in their deps arrays — see them defined when their deps evaluate (avoids
  // TDZ on first render).
  const {
    activePMode,
    resolvedPresentation,
    currentPModeRef,
    onSectionSelected: pModeOnSectionSelected,
    onPModeSelected: pModeOnPModeSelected,
    clearOverride: pModeClearOverride,
  } = usePModeResolver({
    sectionCapture,
    presentationModeCaptures,
    selectionKey,
    defaultMode: DEFAULT_PMODE,
  })

  // ─── Persistence: save on every capture change (manifest models only) ─────

  useEffect(() => {
    if (!selectedModelId || modelObjectUrl) return
    saveCaptures(selectedModelId, {
      sectionCaptures,
      optionCaptures,
      materialDefaultCapture,
      presentationModeCaptures,
      selectedOptions,
      sectionLabelOverrides,
      optionLabelOverrides,
    })
  }, [presentationModeCaptures, materialDefaultCapture, modelObjectUrl, optionCaptures,
    sectionCaptures, selectedModelId, selectedOptions,
    sectionLabelOverrides, optionLabelOverrides])

  // ─── Model switching ──────────────────────────────────────────────────────

  const switchToManifestModel = useCallback((modelId) => {
    if (modelObjectUrl) {
      URL.revokeObjectURL(modelObjectUrl)
      setModelObjectUrl(null)
    }
    const saved = loadCaptures(modelId)
    setSelectedModelId(modelId)
    applyCaptureSnapshot(saved)
    pModeClearOverride()
    setViewerReady(null)
    setViewerError(null)
    setCaptureConflict(null)
    setLoadViolations(findExistingCrossSectionViolations(saved?.optionCaptures ?? {}))
  }, [applyCaptureSnapshot, modelObjectUrl, pModeClearOverride])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedModelId(null)
    applyCaptureSnapshot(null)
    pModeClearOverride()
    setViewerReady(null)
    setViewerError(null)
    setModelObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }, [applyCaptureSnapshot, pModeClearOverride])

  // ─── ViewerOutput ─────────────────────────────────────────────────────────

  const viewerOutput = useMemo(() => ({
    onViewerReady: (event) => setViewerReady(event),
    onError: (event) => setViewerError(event),
    onSectionCaptured: (payload) => {
      const sectionId = selectedSectionIdRef.current
      // Attach App-side `presentationMode` tag from the currently active pMode
      // for re-skin support. The tag is App metadata layered on top of the
      // contract payload — the Viewer never reads it back.
      setSectionCaptures((prev) => ({
        ...prev,
        [sectionId]: { ...payload, presentationMode: currentPModeRef.current },
      }))
      triggerCaptureFlash()
    },
    onSectionCaptureCleared: () => {
      const sectionId = selectedSectionIdRef.current
      setSectionCaptures((prev) => {
        const next = { ...prev }
        delete next[sectionId]
        return next
      })
    },
    onOptionCaptured: (payload) => {
      const sectionId = selectedSectionIdRef.current
      const chosenOption = selectedOptionsRef.current[sectionId] || ''
      if (!chosenOption) return

      const conflicts = findOptionCaptureConflicts(
        optionCapturesRef.current,
        sectionId,
        payload
      )
      if (conflicts.geometry.length || conflicts.material.length) {
        setCaptureConflict({ sectionId, optionId: chosenOption, conflicts })
        return
      }

      setOptionCaptures((prev) => {
        const existing = prev[sectionId]?.[chosenOption]
        const merged = mergeOptionCapture(existing, payload)
        return {
          ...prev,
          [sectionId]: { ...prev[sectionId], [chosenOption]: merged },
        }
      })
      setCaptureConflict(null)
      triggerCaptureFlash()
    },
    onOptionCaptureCleared: () => {
      const sectionId = selectedSectionIdRef.current
      const chosenOption = selectedOptionsRef.current[sectionId] || ''
      if (!chosenOption) return
      // Symmetric with onSectionCaptureCleared: delete the entry rather than
      // soft-clear to {materialAssignments: []}. Downstream consumers
      // (mergeOptionCapture, findOptionCaptureConflicts, the blue-dot check,
      // material/geometry derivations) all use `?.` chains and ?? [] defaults
      // so a missing entry is equivalent to an empty one — and the deleted
      // shape matches what onSectionCaptureCleared produces, removing the
      // "captured? check presence vs check content" asymmetry.
      setOptionCaptures((prev) => {
        if (!prev[sectionId]?.[chosenOption]) return prev
        const sectionMap = { ...prev[sectionId] }
        delete sectionMap[chosenOption]
        const next = { ...prev }
        if (Object.keys(sectionMap).length === 0) delete next[sectionId]
        else next[sectionId] = sectionMap
        return next
      })
    },
    onMaterialDefaultsCaptured: (payload) => {
      setMaterialDefaultCapture(payload)
      triggerCaptureFlash()
    },
    onMaterialDefaultsCleared: () => setMaterialDefaultCapture(null),
    onPresentationModeCaptured: (snapshot) => {
      // Identity-free payload: route to the App's currently active pMode.
      const mode = currentPModeRef.current
      setPresentationModeCaptures((prev) => ({ ...prev, [mode]: snapshot }))
      triggerCaptureFlash()
    },
    onPresentationModeCaptureCleared: () => {
      // Identity-free callback: route to the App's currently active pMode.
      const mode = currentPModeRef.current
      setPresentationModeCaptures((prev) => {
        const next = { ...prev }
        delete next[mode]
        return next
      })
    },
    onRenderCaptured: (event) => {
      if (event?.blob) {
        batchBlobsRef.current.push({ metadata: event.metadata, blob: event.blob })
      }
    },
    onBatchCaptureComplete: async () => {
      setIsBatchCapturing(false)
      const blobs = batchBlobsRef.current
      batchBlobsRef.current = []
      for (const { metadata, blob } of blobs) {
        const composited = await compositeInfoOverlay(blob, metadata)
        if (!mountedRef.current) break
        const label = metadata?.sectionLabel ?? metadata?.sectionId ?? 'section'
        const url = URL.createObjectURL(composited)
        const a = document.createElement('a')
        a.href = url
        a.download = `${label}.jpg`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    },
  }), [triggerCaptureFlash, currentPModeRef])

  // ─── ViewerInput ──────────────────────────────────────────────────────────

  const materialAssignments = useMemo(() => {
    const result = []
    SECTION_DEMO_ITEMS.forEach((section) => {
      const chosenOption = selectedOptions[section.id] || ''
      const captured = optionCaptures[section.id]?.[chosenOption]?.materialAssignments
      if (captured?.length) result.push(...captured)
    })
    return result
  }, [selectedOptions, optionCaptures])

  // Hide pool: per-section union of *inactive* options' geometry. The active
  // option's geometry goes in `activeOptionGeometryIds` below (→ shownGeometryIds).
  // Scoped per-section rather than global because the cross-section ownership
  // rule guarantees no geometry appears in show/hide lists across sections, so
  // the global vs scoped distinction is semantically equivalent — but scoped
  // grows O(N×(M-1)) instead of O(N×M) at scale (dozens of sections × dozens
  // of options).
  const inactiveOptionGeometryIds = useMemo(() =>
    SECTION_DEMO_ITEMS.flatMap((section) => {
      const activeOption = selectedOptions[section.id]
      return section.options
        .filter((option) => option !== activeOption)
        .flatMap((option) => optionCaptures[section.id]?.[option]?.geometryIds ?? [])
    }),
    [selectedOptions, optionCaptures]
  )

  const activeOptionGeometryIds = useMemo(() =>
    SECTION_DEMO_ITEMS.flatMap((section) =>
      optionCaptures[section.id]?.[selectedOptions[section.id]]?.geometryIds ?? []
    ),
    [selectedOptions, optionCaptures]
  )

  // Camera pose — fresh ref on every selectionKey bump so re-clicks retrigger
  // animation even when the underlying pose object is identical.
  const requestedCameraPose = useMemo(
    () => sectionCapture?.pose ? { ...sectionCapture.pose } : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sectionCapture?.pose, selectionKey]
  )

  const visibilityAssignments = useMemo(() => {
    const hasCapture = !!sectionCapture
    const captureHidden = sectionCapture?.visibilityAssignments?.hiddenGeometryIds ?? []
    // Uncaptured-section navigation: omit the whole assignments object so
    // preserve-on-undefined kicks in (per the contract — camera, presentation,
    // and sectionHiddenGeometryIds all preserve to make uncaptured nav a scene
    // no-op). For a *captured* section with no hides we still need to push the
    // object with sectionHiddenGeometryIds: [] so the prior section's hides
    // (typically the roof, captured at overhead) clear instead of bleeding
    // through. Conflating the two cases was the bug.
    if (!hasCapture && !inactiveOptionGeometryIds.length) return undefined
    return {
      hiddenGeometryIds: inactiveOptionGeometryIds,
      shownGeometryIds: activeOptionGeometryIds,
      sectionHiddenGeometryIds: hasCapture ? captureHidden : undefined,
    }
  }, [sectionCapture, inactiveOptionGeometryIds, activeOptionGeometryIds])

  const handleCaptureSectionRenderings = useCallback(() => {
    const items = SECTION_DEMO_ITEMS
      .map((section) => {
        const capture = sectionCaptures[section.id]
        if (!capture?.pose) return null
        const captureHidden = capture.visibilityAssignments?.hiddenGeometryIds ?? []
        const hasVisibility = captureHidden.length > 0 || inactiveOptionGeometryIds.length > 0
        const mergedVisibility = hasVisibility ? {
          hiddenGeometryIds: inactiveOptionGeometryIds,
          shownGeometryIds: activeOptionGeometryIds,
          sectionHiddenGeometryIds: captureHidden,
        } : undefined
        const sectionLabel = sectionLabelOverrides[section.id] ?? section.label
        const selectedOption = selectedOptions[section.id]
        const optionLabel = selectedOption
          ? (optionLabelOverrides[section.id]?.[selectedOption] ?? selectedOption)
          : undefined
        // Resolve presentation per v1.8: pMode lookup with embedded fallback.
        const pres = presentationModeCaptures?.[capture.presentationMode] ?? capture.presentation
        return {
          metadata: {
            sectionId: section.id,
            sectionLabel,
            optionLabel,
            solarHour: pres?.solar?.time?.hour,
            solarDayOfYear: pres?.solar?.time?.dayOfYear,
            latitude: pres?.solar?.latitude,
            longitude: pres?.solar?.longitude,
          },
          camera: { pose: capture.pose, cameraMode: capture.cameraMode },
          scene: hasVisibility ? { visibilityAssignments: mergedVisibility } : undefined,
          presentation: pres ?? undefined,
        }
      })
      .filter(Boolean)
    if (!items.length) return
    batchBlobsRef.current = []
    setIsBatchCapturing(true)
    setBatchCaptureRequest((prev) => ({ nonce: prev.nonce + 1, items }))
  }, [inactiveOptionGeometryIds, activeOptionGeometryIds, presentationModeCaptures, sectionCaptures, sectionLabelOverrides, selectedOptions, optionLabelOverrides])

  const viewerInput = useMemo(() => {
    const defaults = materialDefaultCapture?.defaultMaterialAssignments
    return {
      model: { modelUrl },
      camera: {
        cameraMode: sectionCapture?.cameraMode,
        pose: requestedCameraPose,
      },
      scene: {
        visibilityAssignments,
        defaultMaterialAssignments: defaults?.length ? defaults : undefined,
        materialAssignments: materialAssignments.length ? materialAssignments : undefined,
      },
      presentation: resolvedPresentation,
      admin: {
        enabled: adminEnabled,
        ...(batchCaptureRequest.nonce > 0 ? { batchCapture: batchCaptureRequest } : {}),
      },
      selectionKey,
    }
  }, [
    selectionKey,
    adminEnabled,
    batchCaptureRequest,
    sectionCapture,
    materialAssignments,
    materialDefaultCapture,
    modelUrl,
    requestedCameraPose,
    resolvedPresentation,
    visibilityAssignments,
  ])

  // ─── Click handlers ───────────────────────────────────────────────────────

  // userModeOverrideActive — true when the user-facing Visual Override toggle
  // is on AND we're not in admin. In admin mode the pills are always live
  // (capture-authoring); in user mode they're gated by this derived flag.
  const userModeOverrideActive = visualOverrideEnabled && !adminEnabled

  const handleSectionClick = useCallback((sectionId) => {
    setSelectedSectionId(sectionId)
    // Hand the section's stored capture to the pMode resolver so it can clear
    // its override and inherit the section's pMode tag into the sticky ref
    // (admin pattern). Skip when user-mode override is active — the override
    // is conceptually "show every section under this preset," so it must
    // persist across section clicks. The camera still moves to the section's
    // pose; only the presentation override stays locked.
    if (!userModeOverrideActive) {
      pModeOnSectionSelected(sectionCaptures[sectionId])
    }
    // Bump selectionKey so the camera/presentation memos produce fresh refs
    // and re-fire even if values are identical.
    setSelectionKey((n) => n + 1)
  }, [sectionCaptures, pModeOnSectionSelected, userModeOverrideActive])

  const handleOptionClick = useCallback((sectionId, option) => {
    setSelectedOptions((prev) => ({ ...prev, [sectionId]: option }))
    // No selectionKey bump: option clicks change material/visibility assignments
    // (App pushes via different state), not camera or presentation intent.
  }, [])

  const handlePModePillClick = useCallback((mode) => {
    // Live in admin mode (capture-authoring) and in user mode when Visual
    // Override is on (runtime preset switching).
    if (!adminEnabled && !userModeOverrideActive) return
    pModeOnPModeSelected(mode)
    setSelectionKey((n) => n + 1)
  }, [adminEnabled, userModeOverrideActive, pModeOnPModeSelected])

  const handleVisualOverrideToggle = useCallback(() => {
    setVisualOverrideEnabled((prev) => {
      const next = !prev
      // Turning OFF: clear any active override and bump selectionKey so the
      // active section's own resolved presentation takes over again. Turning
      // ON is a no-op for the scene — no override pill is selected yet, so
      // resolved presentation falls through to the section's tag (or sticky).
      if (!next) {
        pModeClearOverride()
        setSelectionKey((n) => n + 1)
      }
      return next
    })
  }, [pModeClearOverride])

  // ─── Label helpers ────────────────────────────────────────────────────────

  const getSectionLabel = (section) => sectionLabelOverrides[section.id] ?? section.label
  const getOptionLabel = (sectionId, option) => optionLabelOverrides[sectionId]?.[option] ?? option

  // Resolves "Section / Option" display text from raw IDs (used by conflict banners
  // where the owner is identified by ID, not a section object).
  const formatOwnerLabel = (sectionId, optionId) => {
    const section = SECTION_DEMO_ITEMS.find((s) => s.id === sectionId)
    const sectionLabel = sectionLabelOverrides[sectionId] ?? section?.label ?? sectionId
    const optionLabel = optionLabelOverrides[sectionId]?.[optionId] ?? optionId
    return `${sectionLabel} / ${optionLabel}`
  }

  const startEditingSection = (section, e) => {
    e.stopPropagation()
    setEditingLabel({ type: 'section', id: section.id })
    setEditingValue(getSectionLabel(section))
  }

  const startEditingOption = (sectionId, option, e) => {
    e.stopPropagation()
    setEditingLabel({ type: 'option', sectionId, option })
    setEditingValue(getOptionLabel(sectionId, option))
  }

  const confirmRename = () => {
    if (!editingLabel) return
    const trimmed = editingValue.trim()
    if (editingLabel.type === 'section') {
      const original = SECTION_DEMO_ITEMS.find((s) => s.id === editingLabel.id)?.label ?? ''
      setSectionLabelOverrides((prev) => {
        const next = { ...prev }
        if (!trimmed || trimmed === original) delete next[editingLabel.id]
        else next[editingLabel.id] = trimmed
        return next
      })
    } else {
      setOptionLabelOverrides((prev) => {
        const next = { ...prev }
        const sectionMap = { ...(next[editingLabel.sectionId] ?? {}) }
        if (!trimmed || trimmed === editingLabel.option) delete sectionMap[editingLabel.option]
        else sectionMap[editingLabel.option] = trimmed
        if (Object.keys(sectionMap).length === 0) delete next[editingLabel.sectionId]
        else next[editingLabel.sectionId] = sectionMap
        return next
      })
    }
    setEditingLabel(null)
  }

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') { e.target.blur() }
    if (e.key === 'Escape') { renameCancelRef.current = true; setEditingLabel(null) }
  }

  const handleRenameBlur = () => {
    if (renameCancelRef.current) { renameCancelRef.current = false; return }
    confirmRename()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const activeSection = SECTION_DEMO_ITEMS.find((s) => s.id === selectedSectionId)

  // Shared style for pMode pill cells. Pills are live (clickable) in admin
  // mode (capture-authoring) and in user mode when Visual Override is on
  // (runtime preset switching); otherwise the pills don't render in user
  // mode at all, so the cursor only matters in the live cases.
  const buildPModePillStyle = (key, isFirst, isLast) => {
    const isActive = activePMode === key
    return {
      ...secondaryBtn,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '3px 0',
      width: 68,
      background: isActive ? 'rgba(72,127,255,0.42)' : 'rgba(0,0,0,0.58)',
      borderColor: 'rgba(255,255,255,0.2)',
      borderRadius: isFirst ? '7px 0 0 7px' : isLast ? '0 7px 7px 0' : '0',
      cursor: 'pointer',
      userSelect: 'none',
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#3c3b3b', color: 'white' }}>

      <header style={headerStyle}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.5px', flexShrink: 0 }}>
          DemoApp
        </span>

        {/* Admin Mode toggle stays in the same slot (right after the title)
            in both modes so its position never shifts as users flip between
            them. Admin-only items below it appear/disappear; this button's
            slot is the stable anchor. */}
        <button
          style={adminEnabled ? activeAdminBtn : secondaryBtn}
          onClick={() => setAdminEnabled((prev) => !prev)}
          title="Toggle input.admin.enabled. When on, the Viewer renders its built-in Authoring Panel with capture/clear controls. (In a real CustomApp this button would typically be hidden from end users — admin/authoring access would happen via a separate route or auth-gated UI. DemoApp keeps it visible in both modes for demo convenience so reviewers can flip back and forth.)"
        >
          Admin Mode
        </button>

        {adminEnabled && modelManifest.length > 0 && (
          <select
            style={modelSelectStyle}
            value={selectedModelId ?? ''}
            onChange={(e) => { if (e.target.value) switchToManifestModel(e.target.value) }}
            title="Manifest models from public/models. Each model has its own localStorage key (demoapp_v3_${modelId}) so captures persist per model. Switching loads that model's saved snapshot."
          >
            {!selectedModelId && <option value="">— uploaded file —</option>}
            {modelManifest.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        )}

        {adminEnabled && (confirmingReset ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,110,110,0.95)', whiteSpace: 'nowrap' }}>
              Reset all captures?
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                style={{ ...btnBase, background: 'rgba(180,40,40,0.7)', border: '1px solid rgba(255,100,100,0.45)', padding: '4px 10px', fontSize: 12 }}
                onClick={handleResetConfirm}
                title="Confirm: clear every stored capture for this model from localStorage."
              >
                Yes
              </button>
              <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 12 }} onClick={handleResetCancel} title="Cancel reset.">
                No
              </button>
            </div>
          </div>
        ) : (
          <button
            style={
              (Object.keys(sectionCaptures).length ||
               materialDefaultCapture ||
               Object.keys(presentationModeCaptures).length)
                ? activeAdminBtn
                : secondaryBtn
            }
            onClick={handleResetRequest}
            title="Clear all captures for this model from localStorage — section, presentation mode, option, and material defaults. Asks for confirmation."
          >
            Reset Model
          </button>
        ))}

        {adminEnabled && (
          <>
            <button
              style={secondaryBtn}
              onClick={() => modelFileInputRef.current?.click()}
              title="Load an ad-hoc .glb file. Captures on uploaded files do NOT persist — refreshing clears them. Use the model dropdown for the manifest models that do persist."
            >
              Upload .glb
            </button>
            <input
              ref={modelFileInputRef}
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </>
        )}

        {adminEnabled && (
          <a
            href="/downloads/00%20TestModel.skp"
            download="00 TestModel.skp"
            style={{ ...primaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            title="Download the SketchUp source for the demo model. Useful for studying the marker conventions (Spaces > Rooms / Doorways, _PL / _SL light markers, _RM room markers, pivot/slide markers)."
          >
            Download .skp
          </a>
        )}

        {adminEnabled && modelUrl && (
          <CaptureTooltip payload={viewerReady} position="below" enabled={adminEnabled}>
            <span
              title="Reflects onViewerReady. Hover ~3s in Admin Mode to inspect the full payload (modelUrl, productId, modelVersion, cameraMode, cameraInfo). Resets on every model switch."
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.15)',
                color: viewerReady ? 'rgba(100,220,130,0.9)' : 'rgba(255,255,255,0.35)',
                background: viewerReady ? 'rgba(100,220,130,0.1)' : 'rgba(255,255,255,0.05)',
                flexShrink: 0,
              }}
            >
              {viewerReady ? 'Ready' : 'Loading…'}
            </span>
          </CaptureTooltip>
        )}

        <span style={{ flex: 1 }} />

        {adminEnabled && (
          <CaptureTooltip payload={materialDefaultCapture} position="below-right" enabled={adminEnabled}>
            <span
              title="Persistent indicator for materialDefaultCapture (model-level baseline materials, applied before any option assignments). Blue dot = a capture is stored. Hover ~3s in Admin Mode for the payload."
              style={{
                ...secondaryBtn,
                position: 'relative',
                display: 'block',
                background: 'rgba(0,0,0,0.58)',
                cursor: 'default',
                userSelect: 'none',
              }}
            >
              Mat. Defaults
              {materialDefaultCapture && (
                <span style={{
                  position: 'absolute',
                  top: 3,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#487fff',
                  pointerEvents: 'none',
                }} />
              )}
            </span>
          </CaptureTooltip>
        )}

        {/* Visual Override toggle — opt-in user-facing control that exposes
            the pMode pills in user mode. Off by default. Hidden in admin
            mode (admin already has the pills live for capture authoring). */}
        {!adminEnabled && (
          <button
            style={visualOverrideEnabled ? activeAdminBtn : secondaryBtn}
            onClick={handleVisualOverrideToggle}
            title="Visual Override: when on, captured pMode presets become clickable in user mode and the active preset replaces every section's resolved presentation (override persists across section clicks — view all sections under this preset). When off, pMode pills are hidden in user mode and section replays use each section's authored presentation. Doesn't affect admin mode (pills are always live in admin for capture authoring)."
          >
            Visual Override
          </button>
        )}

        {/* pMode pills — Summer + Winter rows.
            - Admin mode: always rendered. Clickable buttons that load
              App-stored snapshots; the Viewer's Mode Capture / Mode Clear
              buttons route to the active pill's pMode.
            - User mode + Visual Override OFF: hidden entirely.
            - User mode + Visual Override ON: only pills with stored snapshots
              render (uncaptured pills have nothing to load). Click loads the
              snapshot as viewerInput.presentation; override persists across
              section clicks until the toggle is turned off. */}
        {(adminEnabled || userModeOverrideActive) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {PMODE_ROWS.map((row, rowIndex) => {
              const visibleCells = adminEnabled
                ? row
                : row.filter(({ key }) => !!presentationModeCaptures[key])
              if (!visibleCells.length) return null
              return (
                <div key={rowIndex} style={{ display: 'flex', alignItems: 'stretch' }}>
                  {visibleCells.map(({ key, label, fullName }, i, arr) => {
                    const isActive = activePMode === key
                    const captured = !!presentationModeCaptures[key]
                    return (
                      <CaptureTooltip
                        key={key}
                        payload={presentationModeCaptures[key]}
                        position="below-right"
                        containerStyle={{ marginLeft: i > 0 ? -1 : 0, position: 'relative', zIndex: isActive ? 1 : 0, display: 'flex' }}
                        enabled={adminEnabled}
                      >
                        <button
                          type="button"
                          onClick={() => handlePModePillClick(key)}
                          title={adminEnabled
                            ? `${fullName} (mode key: ${key}). Click to set currentPMode='${key}' and load presentationModeCaptures.${key} as viewerInput.presentation. The Viewer's Mode Capture / Mode Clear buttons will then route to this pMode. Blue background = currently active pMode (App-side selection state); blue dot = a capture is stored (hover ~3s for the payload).`
                            : `${fullName} (mode key: ${key}). Click to override every section's presentation with this preset's stored snapshot — override persists across section clicks until Visual Override is toggled off. Blue background = currently active override pMode.`}
                          style={buildPModePillStyle(key, i === 0, i === arr.length - 1)}
                        >
                          {label}
                          {captured && (
                            <span style={{
                              position: 'absolute',
                              top: 3,
                              right: 4,
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isActive ? 'white' : '#487fff',
                              pointerEvents: 'none',
                            }} />
                          )}
                        </button>
                      </CaptureTooltip>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        <span
          style={{ opacity: 0.5, fontSize: 14 }}
          title="Pricing placeholder — DemoApp doesn't compute pricing. A future Build & Price CustomApp would replace this with a running total."
        >
          $0
        </span>
        <button
          style={{
            ...(SECTION_DEMO_ITEMS.some((s) => sectionCaptures[s.id]?.pose) ? primaryBtn : secondaryBtn),
            opacity: isBatchCapturing ? 0.6 : 1,
          }}
          disabled={isBatchCapturing}
          onClick={handleCaptureSectionRenderings}
          title="Trigger batch image capture: bumps admin.batchCapture.nonce. The Viewer renders one 4K JPEG per section that has a captured pose, fires onRenderCaptured per image, and onBatchCaptureComplete when done. DemoApp downloads each image as a .jpg with a footer overlay."
        >
          {isBatchCapturing ? 'Capturing…' : 'Complete Build'}
        </button>
      </header>

      <div style={{ display: 'flex', flexShrink: 0, gap: 6, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#3c3b3b' }}>
        {SECTION_DEMO_ITEMS.map((section) => {
          const isSelectedSection = section.id === selectedSectionId
          const hasSectionCapture = !!sectionCaptures[section.id]
          const isEditingThis = editingLabel?.type === 'section' && editingLabel.id === section.id
          return (
            <CaptureTooltip
              key={section.id}
              payload={sectionCaptures[section.id]}
              containerStyle={{ flex: 1 }}
              enabled={adminEnabled}
            >
              {isEditingThis ? (
                <input
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={handleRenameBlur}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(72, 127, 255, 0.42)',
                    border: '1px solid rgba(147, 180, 255, 0.65)',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: 16,
                    fontWeight: 600,
                    textAlign: 'center',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <button
                  onClick={() => handleSectionClick(section.id)}
                  title={`Activate this section. Bumps selectionKey, clears any active pMode pill override. ${hasSectionCapture ? 'Blue dot = sectionCaptures has an entry for this id; replays on activation (re-resolved via presentationModeCaptures or fallback to embedded snapshot).' : 'No section capture stored — activating leaves the current camera/presentation alone.'} Hover ~3s in Admin Mode to inspect the payload.`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: adminEnabled ? '10px 72px 10px 14px' : '10px 14px',
                    background: isSelectedSection ? 'rgba(72, 127, 255, 0.42)' : 'rgba(255,255,255,0.08)',
                    border: isSelectedSection ? '1px solid rgba(147, 180, 255, 0.65)' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: isSelectedSection ? 'white' : 'rgba(255,255,255,0.45)',
                    fontSize: 16,
                    fontWeight: isSelectedSection ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {getSectionLabel(section)}
                  {hasSectionCapture && (
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isSelectedSection ? 'white' : '#3c3b3b',
                      flexShrink: 0,
                    }} />
                  )}
                </button>
              )}
              {adminEnabled && !isEditingThis && (
                <button
                  onClick={(e) => startEditingSection(section, e)}
                  title="Rename this section's display label. Stored in App state (sectionLabelOverrides) — does not affect any captured payload."
                  style={{
                    ...btnBase,
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(120, 130, 155, 0.4)',
                    border: '1px solid rgba(170, 180, 210, 0.35)',
                    padding: '6px 12px',
                    fontSize: 12,
                  }}
                >
                  Rename
                </button>
              )}
            </CaptureTooltip>
          )
        })}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <div style={{ width: 260, borderRight: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', flexShrink: 0, background: '#3c3b3b', padding: '8px' }}>
          {activeSection?.options?.length ? activeSection.options.map((option) => {
            const isSelected = selectedOptions[selectedSectionId] === option
            const hasOptionCapture = !!(
              optionCaptures[selectedSectionId]?.[option]?.geometryIds?.length ||
              optionCaptures[selectedSectionId]?.[option]?.materialAssignments?.length
            )
            const isEditingThis = editingLabel?.type === 'option' && editingLabel.sectionId === selectedSectionId && editingLabel.option === option
            return (
              <CaptureTooltip
                key={option}
                payload={optionCaptures[selectedSectionId]?.[option]}
                position="right"
                containerStyle={{ marginBottom: 4, position: 'relative' }}
                enabled={adminEnabled}
              >
                {isEditingThis ? (
                  <input
                    autoFocus
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleRenameBlur}
                    style={{
                      width: '100%',
                      padding: '12px 12px',
                      background: 'rgba(72, 127, 255, 0.2)',
                      border: '1px solid rgba(147, 180, 255, 0.65)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: 16,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <button
                    onClick={() => handleOptionClick(selectedSectionId, option)}
                    title={`Select this option. ${hasOptionCapture ? 'Blue dot = optionCaptures has geometry and/or material assignments stored for this option; selecting replays them.' : 'No capture stored for this option — selecting just changes the chosen option in App state.'}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: adminEnabled ? '12px 72px 12px 12px' : '12px 12px',
                      background: isSelected ? 'rgba(72, 127, 255, 0.42)' : 'rgba(255,255,255,0.08)',
                      border: isSelected ? '1px solid rgba(147, 180, 255, 0.65)' : '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      color: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 16,
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{
                      width: 13,
                      height: 13,
                      borderRadius: '50%',
                      background: isSelected ? 'white' : 'rgba(255,255,255,0.35)',
                      flexShrink: 0,
                    }} />
                    {getOptionLabel(selectedSectionId, option)}
                    {hasOptionCapture && (
                      <span style={{
                        marginLeft: 'auto',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isSelected ? 'white' : '#487fff',
                        flexShrink: 0,
                      }} />
                    )}
                  </button>
                )}
                {adminEnabled && !isEditingThis && (
                  <button
                    onClick={(e) => startEditingOption(selectedSectionId, option, e)}
                    title="Rename this option's display label. Stored in App state (optionLabelOverrides) — does not affect any captured payload."
                    style={{
                      ...btnBase,
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(120, 130, 155, 0.4)',
                      border: '1px solid rgba(170, 180, 210, 0.35)',
                      padding: '4px 10px',
                      fontSize: 11,
                    }}
                  >
                    Rename
                  </button>
                )}
              </CaptureTooltip>
            )
          }) : (
            <div style={{
              padding: '24px 12px',
              fontSize: 13,
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              fontStyle: 'italic',
            }}>
              (no options for this section)
            </div>
          )}
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
            maxWidth: '80%',
            pointerEvents: 'none',
          }}>
            {viewerError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(200,50,50,0.92)',
                border: '1px solid rgba(255,100,100,0.5)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                color: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                pointerEvents: 'auto',
              }}>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>
                  Viewer Error{viewerError.code ? ` · ${viewerError.code}` : ''}
                </span>
                {viewerError.message && (
                  <span style={{ opacity: 0.9 }}>{viewerError.message}</span>
                )}
                <button
                  onClick={() => setViewerError(null)}
                  style={{
                    marginLeft: 4,
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: '0 2px',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            )}
            {captureConflict && (
              <CaptureConflictBanner
                conflict={captureConflict}
                formatOwnerLabel={formatOwnerLabel}
                onDismiss={() => setCaptureConflict(null)}
              />
            )}
            {loadViolations.length > 0 && (
              <LoadViolationsBanner
                violations={loadViolations}
                onDismiss={() => setLoadViolations([])}
              />
            )}
          </div>
          {showCaptureFlash && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(72,127,255,0.22)',
              pointerEvents: 'none',
              zIndex: 10,
            }} />
          )}
          {modelUrl ? (
            <ViewerComponent input={viewerInput} output={viewerOutput} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, opacity: 0.4 }}>
              <p style={{ margin: 0, fontSize: 14 }}>Select a model or upload a .glb file to get started</p>
              <button
                style={secondaryBtn}
                onClick={() => modelFileInputRef.current?.click()}
                title="Load an ad-hoc .glb file. Captures on uploaded files do NOT persist — refreshing clears them."
              >
                Upload .glb
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
