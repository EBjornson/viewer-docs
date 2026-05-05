import { useCallback, useMemo, useRef, useState } from 'react'

/**
 * Resolves DemoApp's three-source pMode merge into a single pair of derived
 * values (`activePMode` for indicator display, `resolvedPresentation` for
 * `viewerInput.presentation`).
 *
 * The three sources:
 *   1. `override` — transient flag set when admin clicks a pMode pill.
 *      Cleared on section selection and model switch.
 *   2. `sectionCapture.presentationMode` — App-side metadata tag attached
 *      when a section was captured under a particular pMode (re-skin
 *      support per v1.8 design Q2).
 *   3. `currentPModeRef.current` — sticky-across-clicks fallback. Used for
 *      uncaptured-section navigation (where #2 is undefined) and for
 *      attaching the pMode tag on new section captures.
 *
 * `currentPModeRef` is exposed because DemoApp's `viewerOutput` callbacks
 * read it directly to attach the pMode tag on `onSectionCaptured` and to
 * route `onPresentationModeCaptured`/`...Cleared` payloads to the correct
 * `presentationModeCaptures[mode]` entry.
 */
export function usePModeResolver({ sectionCapture, presentationModeCaptures, selectionKey }) {
  const [override, setOverride] = useState(null)
  const currentPModeRef = useRef('day')

  const activePMode = override
    ?? sectionCapture?.presentationMode
    ?? currentPModeRef.current

  // Re-skin with fallback per v1.8 design Q2:
  // - Override path: push the App-stored snapshot for the override pMode.
  // - Otherwise: re-resolve via presentationModeCaptures[capture.tag] for
  //   re-skin support; fall back to the section's embedded snapshot when
  //   the App has no pMode storage for that tag.
  // - Spread to a fresh object every render so the Viewer's presentation
  //   hook sees a new reference and re-syncs cleanly.
  // selectionKey included so re-clicks force a fresh reference (admin-edit reset).
  const resolvedPresentation = useMemo(() => {
    if (override) {
      const fromStore = presentationModeCaptures[override]
      return fromStore ? { ...fromStore } : undefined
    }
    if (!sectionCapture) return undefined
    const fromStore = presentationModeCaptures?.[sectionCapture.presentationMode]
    return { ...(fromStore ?? sectionCapture.presentation) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override, sectionCapture, presentationModeCaptures, selectionKey])

  // Section click: clear admin override (so #2 or #3 drives), and inherit
  // the section's pMode tag into the sticky ref so future captures and pMode
  // actions route to the section's "home" pMode.
  const onSectionSelected = useCallback((cap) => {
    setOverride(null)
    if (cap?.presentationMode) currentPModeRef.current = cap.presentationMode
  }, [])

  // Admin pMode pill click: set the transient override and update the sticky
  // ref so capture callbacks route to this pMode.
  const onPModeSelected = useCallback((mode) => {
    setOverride(mode)
    currentPModeRef.current = mode
  }, [])

  // Model switch: clear the override only (sticky ref persists across model
  // switches, matching the prior inline behavior).
  const onModelSwitch = useCallback(() => {
    setOverride(null)
  }, [])

  return {
    activePMode,
    resolvedPresentation,
    currentPModeRef,
    onSectionSelected,
    onPModeSelected,
    onModelSwitch,
  }
}
