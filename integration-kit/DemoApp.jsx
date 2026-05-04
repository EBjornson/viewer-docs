import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SECTION_DEMO_ITEMS } from '../config/sectionDemoConfig'
import { modelManifest } from '../config/modelManifest'
import { decimalToTimeString12h, dayOfYearToDateString } from '../utils/solarFormatUtils'

// ─── Capture image overlay ───────────────────────────────────────────────────

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatShortDate(dayOfYear) {
  const dateStr = dayOfYearToDateString(dayOfYear)
  const [, month, day] = dateStr.split('-').map(Number)
  return `${MONTH_ABBR[month - 1]} ${day}`
}

function formatLatLon(lat, lon) {
  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`
  const lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`
  return `${latStr},  ${lonStr}`
}

function compositeInfoOverlay(blob, metadata) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const barHeight = 130
      const barY = img.height - barHeight
      const padX = 72

      // Background bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.62)'
      ctx.fillRect(0, barY, img.width, barHeight)

      // Subtle top border
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillRect(0, barY, img.width, 1)

      // Section name + selected option
      ctx.font = '600 62px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fillText(`${metadata.sectionLabel}  —  ${metadata.optionLabel}`, padX, barY + 66)

      // Solar info line — only rendered when the captured presentation mode
      // supplies all four solar fields. Skipped if no presentation mode is
      // captured for this section, since the overlay must not claim solar
      // values the rendered image wasn't actually produced with.
      const hasSolarMetadata =
        typeof metadata.solarDayOfYear === 'number' &&
        typeof metadata.solarHour === 'number' &&
        typeof metadata.latitude === 'number' &&
        typeof metadata.longitude === 'number'
      if (hasSolarMetadata) {
        const date = formatShortDate(metadata.solarDayOfYear)
        const time = decimalToTimeString12h(metadata.solarHour)
        const latLon = formatLatLon(metadata.latitude, metadata.longitude)
        const solarLine = `Solar Date & Location:  ${date}  ·  ${time}  ·  ${latLon}`

        ctx.font = '400 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
        ctx.fillText(solarLine, padX, barY + 114)
      }

      canvas.toBlob((result) => resolve(result ?? blob), 'image/jpeg', 0.92)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob) }
    img.src = url
  })
}

// ─── Cross-section ownership enforcement ────────────────────────────────────
//
// Two App-level rules:
//   1) a geometry item can not be owned by multiple different sections
//   2) a geometry's material assignment can not be owned by multiple different
//      sections (option in section A assigning a material to geometry G blocks
//      any option in sections B..N from assigning materials to G)
//
// These rules live at the App layer because section identity is App-owned;
// the Viewer fires onOptionCaptured with no section context. We enforce by
// scanning existing optionCaptures for the geometryIds in the incoming
// payload and rejecting if any are owned by a different section.

function findGeometryOwner(optionCaptures, excludeSectionId, geometryId, kind) {
  for (const sectionId of Object.keys(optionCaptures)) {
    if (sectionId === excludeSectionId) continue
    const options = optionCaptures[sectionId]
    if (!options) continue
    for (const optionId of Object.keys(options)) {
      const capture = options[optionId]
      if (kind === 'geometry') {
        if (capture?.geometryIds?.includes(geometryId)) {
          return { sectionId, optionId }
        }
      } else {
        const owned = capture?.materialAssignments?.some((a) =>
          a?.geometryIds?.includes(geometryId)
        )
        if (owned) return { sectionId, optionId }
      }
    }
  }
  return null
}

function findOptionCaptureConflicts(optionCaptures, activeSectionId, payload) {
  const geometry = []
  ;(payload?.geometryIds ?? []).forEach((id) => {
    if (!id) return
    const owner = findGeometryOwner(optionCaptures, activeSectionId, id, 'geometry')
    if (owner) geometry.push({ id, ...owner })
  })

  const materialTargetIds = new Set()
  ;(payload?.materialAssignments ?? []).forEach((a) => {
    a?.geometryIds?.forEach((id) => { if (id) materialTargetIds.add(id) })
  })
  const material = []
  materialTargetIds.forEach((id) => {
    const owner = findGeometryOwner(optionCaptures, activeSectionId, id, 'material')
    if (owner) material.push({ id, ...owner })
  })

  return { geometry, material }
}

// One-time scan of persisted state for existing cross-section violations.
// Runs two independent passes — show/hide geometry ownership and material
// assignment ownership — and tags each violation with its `kind` so the
// banner can describe it precisely. The two rules are intentionally
// independent: the same geometry MAY appear in section A's show/hide list
// AND section B's material assignments without being a violation.
function findExistingCrossSectionViolations(optionCaptures) {
  const showHideSections = new Map()  // id -> Set<sectionId>
  const materialSections = new Map()  // id -> Set<sectionId>

  for (const sectionId of Object.keys(optionCaptures ?? {})) {
    const options = optionCaptures[sectionId]
    if (!options) continue
    for (const optionId of Object.keys(options)) {
      const capture = options[optionId]
      capture?.geometryIds?.forEach((id) => {
        if (!id) return
        if (!showHideSections.has(id)) showHideSections.set(id, new Set())
        showHideSections.get(id).add(sectionId)
      })
      capture?.materialAssignments?.forEach((a) => {
        a?.geometryIds?.forEach((id) => {
          if (!id) return
          if (!materialSections.has(id)) materialSections.set(id, new Set())
          materialSections.get(id).add(sectionId)
        })
      })
    }
  }

  const violations = []
  showHideSections.forEach((sectionIds, id) => {
    if (sectionIds.size > 1) violations.push({ id, kind: 'geometry', sectionIds: [...sectionIds] })
  })
  materialSections.forEach((sectionIds, id) => {
    if (sectionIds.size > 1) violations.push({ id, kind: 'material', sectionIds: [...sectionIds] })
  })
  return violations
}

// Groups a flat list of `{id, sectionId, optionId}` conflicts into one entry
// per (sectionId, optionId) owner, accumulating all conflicting geometryIds.
function groupConflictsByOwner(conflicts) {
  const map = new Map()
  conflicts.forEach((c) => {
    const key = `${c.sectionId}::${c.optionId}`
    if (!map.has(key)) {
      map.set(key, { sectionId: c.sectionId, optionId: c.optionId, ids: [] })
    }
    map.get(key).ids.push(c.id)
  })
  return [...map.values()]
}

const CONFLICT_ID_PREVIEW_COUNT = 3

function formatIdPreview(ids) {
  if (ids.length <= CONFLICT_ID_PREVIEW_COUNT) return ids.join(', ')
  const head = ids.slice(0, CONFLICT_ID_PREVIEW_COUNT).join(', ')
  return `${head} (+${ids.length - CONFLICT_ID_PREVIEW_COUNT} more)`
}

function CaptureConflictBanner({ conflict, formatOwnerLabel, onDismiss }) {
  const geometryGroups = groupConflictsByOwner(conflict.conflicts.geometry)
  const materialGroups = groupConflictsByOwner(conflict.conflicts.material)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 4,
      background: 'rgba(200,50,50,0.92)',
      border: '1px solid rgba(255,100,100,0.5)',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 13,
      color: 'white',
      boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      pointerEvents: 'auto',
      position: 'relative',
      paddingRight: 28,
    }}>
      <span style={{ fontWeight: 700 }}>Capture rejected — cross-section ownership conflict</span>
      {geometryGroups.map((g) => (
        <span key={`g-${g.sectionId}-${g.optionId}`} style={{ opacity: 0.92 }}>
          Already in show/hide list of <strong>{formatOwnerLabel(g.sectionId, g.optionId)}</strong>: {formatIdPreview(g.ids)}
        </span>
      ))}
      {materialGroups.map((g) => (
        <span key={`m-${g.sectionId}-${g.optionId}`} style={{ opacity: 0.92 }}>
          Already material-assigned by <strong>{formatOwnerLabel(g.sectionId, g.optionId)}</strong>: {formatIdPreview(g.ids)}
        </span>
      ))}
      <span style={{ opacity: 0.75, fontSize: 11, marginTop: 2 }}>
        Clear that capture first, or pick different geometry.
      </span>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  )
}

function LoadViolationsBanner({ violations, onDismiss }) {
  const showHide = violations.filter((v) => v.kind === 'geometry').map((v) => v.id)
  const material = violations.filter((v) => v.kind === 'material').map((v) => v.id)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 4,
      background: 'rgba(200,140,40,0.9)',
      border: '1px solid rgba(255,180,80,0.5)',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 12,
      color: 'white',
      boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      pointerEvents: 'auto',
      position: 'relative',
      paddingRight: 28,
    }}>
      <span style={{ fontWeight: 700 }}>
        Pre-existing cross-section conflicts ({violations.length})
      </span>
      {showHide.length > 0 && (
        <span style={{ opacity: 0.92 }}>
          Show/hide ownership ({showHide.length}): {formatIdPreview(showHide)}
        </span>
      )}
      {material.length > 0 && (
        <span style={{ opacity: 0.92 }}>
          Material assignment ownership ({material.length}): {formatIdPreview(material)}
        </span>
      )}
      <span style={{ opacity: 0.75, fontSize: 11, marginTop: 2 }}>
        Clear and re-author the affected captures to fix.
      </span>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  )
}

// ─── Option capture merge ────────────────────────────────────────────────────

function mergeOptionCapture(existing, incoming) {
  const mergedGeometryIds = [...new Set([
    ...(existing?.geometryIds ?? []),
    ...(incoming?.geometryIds ?? []),
  ])]
  const byId = new Map()
  ;(existing?.materialAssignments ?? []).forEach((a) => {
    ;(a.geometryIds ?? []).forEach((id) => { if (id) byId.set(id, a) })
  })
  ;(incoming?.materialAssignments ?? []).forEach((a) => {
    ;(a.geometryIds ?? []).forEach((id) => { if (id) byId.set(id, a) })
  })
  const mergedMaterials = [...byId.values()]
  return {
    geometryIds: mergedGeometryIds.length ? mergedGeometryIds : undefined,
    materialAssignments: mergedMaterials.length ? mergedMaterials : undefined,
  }
}

// ─── Persistence ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'demoapp_v2'

function loadCaptures(modelId) {
  if (!modelId) return null
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${modelId}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
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

// ─── Styles ─────────────────────────────────────────────────────────────────

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  flexShrink: 0,
  background: '#111',
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

// ─── CaptureTooltip ──────────────────────────────────────────────────────────

function CaptureTooltip({ payload, position = 'below', containerStyle, enabled = true, children }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [coords, setCoords] = useState(null)
  const wrapperRef = useRef(null)
  const showTimerRef = useRef(null)
  const hideTimerRef = useRef(null)
  const copyTimerRef = useRef(null)

  useEffect(() => () => {
    clearTimeout(showTimerRef.current)
    clearTimeout(hideTimerRef.current)
    clearTimeout(copyTimerRef.current)
  }, [])

  // Suppress descendant `title` attributes while the payload flyout is up so
  // the native browser tooltip does not sit on top of the JSON. Stash each
  // value on `data-suppressed-title` and restore on hide.
  useEffect(() => {
    const root = wrapperRef.current
    if (!root || !visible) return undefined
    const stripTitle = (el) => {
      const value = el.getAttribute('title')
      if (value == null) return
      el.setAttribute('data-suppressed-title', value)
      el.removeAttribute('title')
    }
    if (root.hasAttribute('title')) stripTitle(root)
    root.querySelectorAll('[title]').forEach(stripTitle)
    return () => {
      const restoreTitle = (el) => {
        const value = el.getAttribute('data-suppressed-title')
        if (value == null) return
        el.setAttribute('title', value)
        el.removeAttribute('data-suppressed-title')
      }
      if (root.hasAttribute('data-suppressed-title')) restoreTitle(root)
      root.querySelectorAll('[data-suppressed-title]').forEach(restoreTitle)
    }
  }, [visible])

  const computeCoords = () => {
    if (!wrapperRef.current) return null
    const r = wrapperRef.current.getBoundingClientRect()
    if (position === 'right') return { top: r.top, left: r.right + 6 }
    if (position === 'below-right') return { top: r.bottom + 4, right: window.innerWidth - r.right }
    return { top: r.bottom + 4, left: r.left }
  }

  const scheduleShow = () => {
    clearTimeout(hideTimerRef.current)
    if (!enabled || !payload) return
    showTimerRef.current = setTimeout(() => {
      setCoords(computeCoords())
      setVisible(true)
    }, 3000)
  }

  const scheduleHide = () => {
    clearTimeout(showTimerRef.current)
    hideTimerRef.current = setTimeout(() => setVisible(false), 150)
  }

  const cancelHide = () => clearTimeout(hideTimerRef.current)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopied(true)
    clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', ...containerStyle }}
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
    >
      {children}
      {visible && payload && coords && (
        <div
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          style={{
            position: 'fixed',
            ...coords,
            zIndex: 1000,
            background: '#0d0d1a',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 7,
            overflow: 'hidden',
            minWidth: 260,
            maxWidth: 400,
            boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>
              Captured Payload
            </span>
            <button
              onClick={handleCopy}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                color: copied ? 'rgba(100,220,130,0.9)' : 'rgba(255,255,255,0.5)',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 7px',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: '8px 10px',
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'rgba(200,220,255,0.9)',
            maxHeight: '60vh',
            overflowY: 'auto',
            whiteSpace: 'pre',
          }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
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
  const [activationNonce, setActivationNonce] = useState(0)
  const [selectedSectionId, setSelectedSectionId] = useState(SECTION_DEMO_ITEMS[0]?.id)
  const [activeViewCameraMode, setActiveViewCameraMode] = useState(null)
  const [lastPressedViewMode, setLastPressedViewMode] = useState(null)
  const [spaceTileWalkCaptureMode, setSpaceTileWalkCaptureMode] = useState(null)
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
  const [viewCaptures, setViewCaptures] = useState(
    () => INITIAL_SAVED?.viewCaptures ?? {}
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

  // Active authoring focus — drives the Viewer's dynamic Authoring Panel.
  // Default 'section' so the admin lands on the broadest authoring surface
  // (Section Capture + Geometry + User Visibility + Presentation settings).
  const [activeAuthoringFocus, setActiveAuthoringFocus] = useState('section')

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

  const handleResetConfirm = useCallback(() => {
    clearTimeout(resetTimerRef.current)
    setConfirmingReset(false)
    setSectionCaptures({})
    setOptionCaptures({})
    setMaterialDefaultCapture(null)
    setViewCaptures({})
    setPresentationModeCaptures({})
    setSelectedOptions({ ...DEFAULT_SELECTED_OPTIONS })
    setSectionLabelOverrides({})
    setOptionLabelOverrides({})
    setCaptureConflict(null)
    setLoadViolations([])
  }, [])

  const handleResetCancel = useCallback(() => {
    clearTimeout(resetTimerRef.current)
    setConfirmingReset(false)
  }, [])

  useEffect(() => () => clearTimeout(resetTimerRef.current), [])

  const modelFileInputRef = useRef(null)

  // Stable refs so viewerOutput callbacks don't stale-close over section/option state
  const selectedSectionIdRef = useRef(selectedSectionId)
  const selectedOptionsRef = useRef(selectedOptions)
  const adminEnabledRef = useRef(adminEnabled)
  const optionCapturesRef = useRef(optionCaptures)
  selectedSectionIdRef.current = selectedSectionId
  selectedOptionsRef.current = selectedOptions
  adminEnabledRef.current = adminEnabled
  optionCapturesRef.current = optionCaptures

  // When admin mode is turned off, activate the last-selected view so its
  // capture (UI flags, visibility, presentation) applies immediately in user mode.
  const prevAdminEnabledRef = useRef(adminEnabled)
  useEffect(() => {
    const wasAdmin = prevAdminEnabledRef.current
    prevAdminEnabledRef.current = adminEnabled
    if (wasAdmin && !adminEnabled && lastPressedViewMode) {
      setActiveViewCameraMode(lastPressedViewMode)
      setActivationNonce((n) => n + 1)
    }
  }, [adminEnabled, lastPressedViewMode])

  // ─── Persistence: save on every capture change (manifest models only) ─────

  useEffect(() => {
    if (!selectedModelId || modelObjectUrl) return
    saveCaptures(selectedModelId, {
      sectionCaptures,
      optionCaptures,
      materialDefaultCapture,
      viewCaptures,
      presentationModeCaptures,
      selectedOptions,
      sectionLabelOverrides,
      optionLabelOverrides,
    })
  }, [presentationModeCaptures, materialDefaultCapture, modelObjectUrl, optionCaptures,
    sectionCaptures, selectedModelId, selectedOptions, viewCaptures,
    sectionLabelOverrides, optionLabelOverrides])

  // ─── Model switching ──────────────────────────────────────────────────────

  const switchToManifestModel = useCallback((modelId) => {
    if (modelObjectUrl) {
      URL.revokeObjectURL(modelObjectUrl)
      setModelObjectUrl(null)
    }
    const saved = loadCaptures(modelId)
    setSelectedModelId(modelId)
    setSectionCaptures(saved?.sectionCaptures ?? {})
    setOptionCaptures(saved?.optionCaptures ?? {})
    setMaterialDefaultCapture(saved?.materialDefaultCapture ?? null)
    setViewCaptures(saved?.viewCaptures ?? {})
    setPresentationModeCaptures(saved?.presentationModeCaptures ?? {})
    setSelectedOptions(saved?.selectedOptions ?? { ...DEFAULT_SELECTED_OPTIONS })
    setSectionLabelOverrides(saved?.sectionLabelOverrides ?? {})
    setOptionLabelOverrides(saved?.optionLabelOverrides ?? {})
    setViewerReady(null)
    setViewerError(null)
    setCaptureConflict(null)
    setLoadViolations(findExistingCrossSectionViolations(saved?.optionCaptures ?? {}))
  }, [modelObjectUrl])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedModelId(null)
    setSectionCaptures({})
    setOptionCaptures({})
    setMaterialDefaultCapture(null)
    setViewCaptures({})
    setPresentationModeCaptures({})
    setSelectedOptions({ ...DEFAULT_SELECTED_OPTIONS })
    setSectionLabelOverrides({})
    setOptionLabelOverrides({})
    setViewerReady(null)
    setViewerError(null)
    setModelObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }, [])

  // ─── ViewerOutput ─────────────────────────────────────────────────────────

  const viewerOutput = useMemo(() => ({
    onViewerReady: (event) => setViewerReady(event),
    onError: (event) => setViewerError(event),
    onSectionCaptured: (payload) => {
      const sectionId = selectedSectionIdRef.current
      setSectionCaptures((prev) => ({ ...prev, [sectionId]: payload }))
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
      setOptionCaptures((prev) => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], [chosenOption]: { materialAssignments: [] } },
      }))
    },
    onMaterialDefaultsCaptured: (payload) => {
      setMaterialDefaultCapture(payload)
      triggerCaptureFlash()
    },
    onMaterialDefaultsCleared: () => setMaterialDefaultCapture(null),
    onViewCaptured: (payload) => {
      setViewCaptures((prev) => ({ ...prev, [payload.cameraMode]: payload }))
      triggerCaptureFlash()
    },
    onViewCaptureCleared: (cameraMode) => {
      setViewCaptures((prev) => ({ ...prev, [cameraMode]: null }))
    },
    onViewSelected: (cameraMode) => {
      setLastPressedViewMode(cameraMode)
      setSpaceTileWalkCaptureMode(null)
      setActiveAuthoringFocus('view')
      if (!adminEnabledRef.current) {
        // User mode: activate the view's camera so its capture replays, and
        // bump syncKey to signal "selection changed" — the Viewer re-syncs
        // camera, presentation, and mode-highlight from input on every bump.
        setActiveViewCameraMode(cameraMode)
        setActivationNonce((n) => n + 1)
      }
      // Admin mode: skip the bump. View clicks in admin are Viewer-internal
      // navigation (the Viewer's handleViewChange handles camera + presentation
      // + mode-highlight directly via syncActivePresentationMode). Bumping
      // syncKey would re-fire the Viewer's input-driven re-sync paths with
      // stale section data and override the just-applied view state.
    },
    onSpaceTileWalkActivated: (cameraMode) => {
      setSpaceTileWalkCaptureMode(cameraMode)
    },
    onPresentationModeCaptured: (payload) => {
      setPresentationModeCaptures((prev) => ({ ...prev, [payload.mode]: payload.presentation }))
      triggerCaptureFlash()
    },
    onPresentationModeCaptureCleared: (mode) => {
      setPresentationModeCaptures((prev) => {
        const next = { ...prev }
        delete next[mode]
        return next
      })
    },
    onActivePresentationModeChanged: () => {
      // The `mode` argument is intentionally ignored: the active mode lives in
      // the Viewer (which owns mode-button click state). The App derives the
      // mode for `viewerInput.activePresentationMode` from the active capture
      // (`presentationCapture?.presentationMode`); direct mode-button clicks
      // don't bump `presentationSyncKey`, so the Viewer's optimistic mode state
      // is preserved without round-tripping through the App. We react here
      // only to switch authoring focus so the dynamic Authoring Panel filters
      // to mode-relevant controls.
      setActiveAuthoringFocus('presentationMode')
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
  }), [triggerCaptureFlash])

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

  const allOptionGeometryIds = useMemo(() =>
    SECTION_DEMO_ITEMS.flatMap((section) =>
      section.options.flatMap((option) =>
        optionCaptures[section.id]?.[option]?.geometryIds ?? []
      )
    ),
    [optionCaptures]
  )

  const activeOptionGeometryIds = useMemo(() =>
    SECTION_DEMO_ITEMS.flatMap((section) =>
      optionCaptures[section.id]?.[selectedOptions[section.id]]?.geometryIds ?? []
    ),
    [selectedOptions, optionCaptures]
  )

  // Last-one-wins: view button press or section click determines what drives camera + presentation.
  // Floor nav activates presentation/visibility from a view capture without changing camera pose.
  const cameraCapture = activeViewCameraMode
    ? (viewCaptures[activeViewCameraMode] ?? null)
    : (sectionCaptures[selectedSectionId] ?? null)

  const presentationCapture = spaceTileWalkCaptureMode
    ? (viewCaptures[spaceTileWalkCaptureMode] ?? cameraCapture)
    : cameraCapture

  // Captured presentation for the active section/view's mode. Undefined when
  // no capture exists for that mode — the Viewer fills in its own defaults.
  const effectivePresentation = presentationModeCaptures[presentationCapture?.presentationMode]

  // Spread into a new object so every nonce increment produces a new reference,
  // which triggers camera re-animation in the viewer.
  // activationNonce is gated on !adminEnabled: in admin mode the Viewer
  // handles view-button navigation internally (handleViewChange → directNavTo /
  // walkToCapturedPose), so a nonce-driven pose-ref change would re-fire the
  // Viewer's pose effect with the still-active SECTION's pose, undoing the
  // view's pose + cameraMode FOV. In user mode the nonce is still needed so
  // re-clicking the same section/view retriggers the animation (cameraCapture
  // ref hasn't changed in that case).
  const requestedCameraPose = useMemo(
    () => cameraCapture?.pose ? { ...cameraCapture.pose } : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cameraCapture?.pose, adminEnabled ? null : activationNonce]
  )

  const visibilityAssignments = useMemo(() => {
    const captureHidden = presentationCapture?.visibilityAssignments?.hiddenGeometryIds ?? []
    if (!captureHidden.length && !allOptionGeometryIds.length) return undefined
    return {
      hiddenGeometryIds: allOptionGeometryIds,
      shownGeometryIds: activeOptionGeometryIds,
      instantHiddenGeometryIds: captureHidden,
    }
  }, [presentationCapture?.visibilityAssignments?.hiddenGeometryIds, allOptionGeometryIds, activeOptionGeometryIds])

  const activeOptionCapture = optionCaptures[selectedSectionId]?.[selectedOptions[selectedSectionId]] ?? null

  const handleCaptureSectionRenderings = useCallback(() => {
    const items = SECTION_DEMO_ITEMS
      .map((section) => {
        const capture = sectionCaptures[section.id]
        if (!capture?.pose) return null
        const captureHidden = capture.visibilityAssignments?.hiddenGeometryIds ?? []
        const hasVisibility = captureHidden.length > 0 || allOptionGeometryIds.length > 0
        const mergedVisibility = hasVisibility ? {
          hiddenGeometryIds: allOptionGeometryIds,
          shownGeometryIds: activeOptionGeometryIds,
          instantHiddenGeometryIds: captureHidden,
        } : undefined
        const sectionLabel = sectionLabelOverrides[section.id] ?? section.label
        const selectedOption = selectedOptions[section.id]
        const optionLabel = optionLabelOverrides[section.id]?.[selectedOption] ?? selectedOption
        const pres = presentationModeCaptures[capture.presentationMode]
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
          presentation: presentationModeCaptures[capture.presentationMode] ?? undefined,
        }
      })
      .filter(Boolean)
    if (!items.length) return
    batchBlobsRef.current = []
    setIsBatchCapturing(true)
    setBatchCaptureRequest((prev) => ({ nonce: prev.nonce + 1, items }))
  }, [allOptionGeometryIds, activeOptionGeometryIds, presentationModeCaptures, sectionCaptures, sectionLabelOverrides, selectedOptions, optionLabelOverrides])

  const viewerInput = useMemo(() => {
    // Presentation snapshot is already a ViewerPresentationInput. Section/view
    // captures override only the UI flags; everything else flows through. When
    // there's no captured presentation for the active mode, presentation stays
    // undefined and the Viewer preserves whatever state it currently has.
    const presentation = effectivePresentation
      ? {
          ...effectivePresentation,
          ui: {
            ...effectivePresentation.ui,
            ...presentationCapture?.ui,
          },
        }
      : undefined

    const defaults = materialDefaultCapture?.defaultMaterialAssignments
    return {
      model: { modelUrl },
      camera: {
        cameraMode: cameraCapture?.cameraMode,
        pose: requestedCameraPose,
      },
      scene: {
        visibilityAssignments,
        defaultMaterialAssignments: defaults?.length ? defaults : undefined,
        materialAssignments: materialAssignments.length ? materialAssignments : undefined,
      },
      presentation,
      presentationModeCaptures: presentationModeCaptures ?? undefined,
      activePresentationMode: presentationCapture?.presentationMode,
      admin: {
        enabled: adminEnabled,
        activeOptionCapture: activeOptionCapture ?? undefined,
        ...(batchCaptureRequest.nonce > 0 ? { batchCapture: batchCaptureRequest } : {}),
        ...(adminEnabled ? { activeAuthoringFocus } : {}),
      },
      presentationSyncKey: activationNonce,
    }
  }, [
    activationNonce,
    activeAuthoringFocus,
    activeOptionCapture,
    adminEnabled,
    batchCaptureRequest,
    cameraCapture,
    effectivePresentation,
    materialAssignments,
    materialDefaultCapture,
    modelUrl,
    presentationCapture,
    presentationModeCaptures,
    requestedCameraPose,
    visibilityAssignments,
  ])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a1a', color: 'white' }}>

      <header style={headerStyle}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.5px', flexShrink: 0 }}>
          DemoApp
        </span>

        {modelManifest.length > 0 && (
          <select
            style={modelSelectStyle}
            value={selectedModelId ?? ''}
            onChange={(e) => { if (e.target.value) switchToManifestModel(e.target.value) }}
            title="Manifest models from public/models. Each model has its own localStorage key (demoapp_v2_${modelId}) so captures persist per model. Switching loads that model's saved snapshot."
          >
            {!selectedModelId && <option value="">— uploaded file —</option>}
            {modelManifest.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        )}

        <button
          style={adminEnabled ? activeAdminBtn : secondaryBtn}
          onClick={() => setAdminEnabled((prev) => !prev)}
          title="Toggle input.admin.enabled. When on, the Viewer renders its built-in Authoring Panel with capture/clear controls."
        >
          Admin Mode
        </button>

        {confirmingReset ? (
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
               Object.keys(viewCaptures).length ||
               materialDefaultCapture ||
               Object.keys(presentationModeCaptures).length)
                ? activeAdminBtn
                : secondaryBtn
            }
            onClick={handleResetRequest}
            title="Clear all captures for this model from localStorage — section, view, presentation mode, option, and material defaults. Asks for confirmation."
          >
            Reset Model
          </button>
        )}

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

        <a
          href="/downloads/00%20TestModel.skp"
          download="00 TestModel.skp"
          style={{ ...primaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          title="Download the SketchUp source for the demo model. Useful for studying the marker conventions (Spaces > Rooms / Doorways, _PL / _SL light markers, _RM room markers, pivot/slide markers)."
        >
          Download .skp
        </a>

        {modelUrl && (
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

        <CaptureTooltip payload={materialDefaultCapture} position="below-right" enabled={adminEnabled}>
          <span
            title="Persistent indicator for materialDefaultCapture (model-level baseline materials, applied before any option assignments). Blue = a capture is stored. Hover ~3s in Admin Mode for the payload."
            style={{
              ...secondaryBtn,
              display: 'block',
              background: materialDefaultCapture ? 'rgba(72,127,255,0.42)' : 'rgba(0,0,0,0.58)',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            Mat. Defaults
          </span>
        </CaptureTooltip>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
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
          ].map((row, rowIndex) => (
            <div key={rowIndex} style={{ display: 'flex', alignItems: 'stretch' }}>
              {row.map(({ key, label, fullName }, i, arr) => (
                <CaptureTooltip
                  key={key}
                  payload={presentationModeCaptures[key]}
                  position="below-right"
                  containerStyle={{ marginLeft: i > 0 ? -1 : 0, position: 'relative', zIndex: presentationModeCaptures[key] ? 1 : 0, display: 'flex' }}
                  enabled={adminEnabled}
                >
                  <span
                    title={`${fullName} (mode key: ${key}). Persistent indicator: blue = presentationModeCaptures.${key} is stored. Hover ~3s in Admin Mode for the payload.`}
                    style={{
                      ...secondaryBtn,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '3px 0',
                      width: 68,
                      background: presentationModeCaptures[key] ? 'rgba(72,127,255,0.42)' : 'rgba(0,0,0,0.58)',
                      borderRadius: i === 0 ? '7px 0 0 7px' : i === arr.length - 1 ? '0 7px 7px 0' : '0',
                      cursor: 'default',
                      userSelect: 'none',
                    }}
                  >
                    {label}
                  </span>
                </CaptureTooltip>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {['exterior', 'interior', 'overhead'].map((mode, i, arr) => (
            <CaptureTooltip
              key={mode}
              payload={viewCaptures[mode]}
              position="below-right"
              containerStyle={{ marginLeft: i > 0 ? -1 : 0, position: 'relative', zIndex: viewCaptures[mode] ? 1 : 0 }}
              enabled={adminEnabled}
            >
              <span
                title={`${mode.charAt(0).toUpperCase()}${mode.slice(1)} view (cameraMode: ${mode}). Persistent indicator: blue = viewCaptures.${mode} is stored. Hover ~3s in Admin Mode for the payload. Press the matching button at the bottom to replay.`}
                style={{
                  ...secondaryBtn,
                  display: 'block',
                  background: viewCaptures[mode] ? 'rgba(72,127,255,0.42)' : 'rgba(0,0,0,0.58)',
                  borderRadius: i === 0 ? '7px 0 0 7px' : i === arr.length - 1 ? '0 7px 7px 0' : '0',
                  cursor: 'default',
                  userSelect: 'none',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </span>
            </CaptureTooltip>
          ))}
        </div>

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

      <div style={{ display: 'flex', flexShrink: 0, gap: 6, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#111' }}>
        {SECTION_DEMO_ITEMS.map((section) => {
          const isActiveDriver = section.id === selectedSectionId && !lastPressedViewMode
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
                  onClick={() => {
                    setSelectedSectionId(section.id)
                    setActiveViewCameraMode(null)
                    setLastPressedViewMode(null)
                    setSpaceTileWalkCaptureMode(null)
                    setActiveAuthoringFocus('section')
                    // Always bump — this is the App's "selection changed" signal so the
                    // Viewer clears any active view button highlight. The Viewer's
                    // presentation re-sync logic itself decides whether to apply
                    // input.presentation (skips when no capture is provided).
                    setActivationNonce((n) => n + 1)
                  }}
                  title={`Activate this section. Sets activeAuthoringFocus='section', bumps presentationSyncKey. ${hasSectionCapture ? 'Blue dot = sectionCaptures has an entry for this id; replays on activation.' : 'No section capture stored — activating leaves the current camera/presentation alone.'} Hover ~3s in Admin Mode to inspect the payload.`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: adminEnabled ? '10px 72px 10px 14px' : '10px 14px',
                    background: isActiveDriver ? 'rgba(72, 127, 255, 0.42)' : 'rgba(255,255,255,0.08)',
                    border: isActiveDriver ? '1px solid rgba(147, 180, 255, 0.65)' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: isActiveDriver ? 'white' : isSelectedSection ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                    fontSize: 16,
                    fontWeight: isActiveDriver ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {getSectionLabel(section)}
                  {hasSectionCapture && (
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isActiveDriver ? 'white' : '#487fff',
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

        <div style={{ width: 260, borderRight: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', flexShrink: 0, background: '#161616', padding: '8px' }}>
          {activeSection?.options.map((option) => {
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
                    onClick={() => {
                      setSelectedOptions((prev) => ({ ...prev, [selectedSectionId]: option }))
                      setActiveAuthoringFocus('option')
                    }}
                    title={`Select this option. Sets activeAuthoringFocus='option' so the Authoring Panel shows option-relevant controls. ${hasOptionCapture ? 'Blue dot = optionCaptures has geometry and/or material assignments stored for this option; selecting replays them.' : 'No capture stored for this option — selecting just changes the chosen option in App state.'}`}
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
          })}
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
