import { useCallback, useMemo, useRef, useState } from 'react'

/**
 * Reusable pMode resolution hook for CustomApps that maintain a presentation
 * mode taxonomy. Handles the three-source merge — transient override, the
 * section capture's pMode tag, and a sticky-across-clicks fallback — and
 * produces the values the host App pushes into `viewerInput.presentation`
 * plus an `activePMode` for indicator display.
 *
 * Used by both admin authoring (override = "load this preset to capture
 * from") and optional user-mode override (override = "show me all sections
 * under this preset"). The two modes differ only in whether the host App
 * calls `onSectionSelected` on a section click (admin: yes, clears the
 * override; user-mode-override: no, keeps the override persistent across
 * section clicks).
 *
 * The three priority sources, in order:
 *   1. `override` — transient flag set when a pMode pill is clicked. Cleared
 *      by `onSectionSelected` (admin pattern). Persistent for user-mode
 *      override patterns that skip the call.
 *   2. `sectionCapture.presentationMode` — App-side metadata tag attached
 *      when a section was captured under a particular pMode. Enables re-skin:
 *      updating a pMode's stored snapshot propagates to all sections tagged
 *      with that pMode on next replay.
 *   3. `currentPModeRef.current` — sticky-across-clicks fallback. Used for
 *      uncaptured-section navigation (where #2 is undefined) and for
 *      attaching the pMode tag on new section captures.
 *
 * `currentPModeRef` is exposed because the host App reads it directly to
 * attach the pMode tag on `onSectionCaptured` and to route
 * `onPresentationModeCaptured`/`...Cleared` payloads to the correct
 * `presentationModeCaptures[mode]` entry.
 *
 * @param {object} params
 * @param {object | null} params.sectionCapture - Currently active section's stored capture, with optional `.presentationMode` tag.
 * @param {Record<string, object>} params.presentationModeCaptures - The App's pMode store, keyed by pMode string.
 * @param {number} params.selectionKey - Bumps on section/pill clicks; included as a memo dep so re-clicks force a fresh `resolvedPresentation` reference.
 * @param {string} params.defaultMode - Cold-start sticky pMode. Should match the App's taxonomy (e.g. the first key in your pill grid).
 *
 * @returns {{
 *   activePMode: string,
 *   resolvedPresentation: object | undefined,
 *   currentPModeRef: { current: string },
 *   onSectionSelected: (cap: object | null) => void,
 *   onPModeSelected: (mode: string) => void,
 *   clearOverride: () => void,
 * }} `activePMode` for indicator display; `resolvedPresentation` for
 * `viewerInput.presentation` (undefined for uncaptured-section navigation,
 * triggering preserve-on-undefined per the contract). `onSectionSelected`
 * and `onPModeSelected` are click handlers; `clearOverride` is the explicit
 * "clear the transient override" primitive — call from model-switch
 * lifecycle handlers and from any user-facing "turn off override" UI.
 */
export function usePModeResolver({
  sectionCapture,
  presentationModeCaptures,
  selectionKey,
  defaultMode,
}) {
  const [override, setOverride] = useState(null)
  const currentPModeRef = useRef(defaultMode)

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
  // actions route to the section's "home" pMode. User-mode-override patterns
  // skip this call to keep the override persistent across section clicks.
  const onSectionSelected = useCallback((cap) => {
    setOverride(null)
    if (cap?.presentationMode) currentPModeRef.current = cap.presentationMode
  }, [])

  // pMode pill click: set the transient override and update the sticky ref
  // so capture callbacks route to this pMode.
  const onPModeSelected = useCallback((mode) => {
    setOverride(mode)
    currentPModeRef.current = mode
  }, [])

  // Explicit clear-the-override primitive. Sticky ref persists. Call from
  // model-switch lifecycle handlers and from any user-facing "turn off
  // override" UI (e.g. DemoApp's Visual Override toggle).
  const clearOverride = useCallback(() => {
    setOverride(null)
  }, [])

  return {
    activePMode,
    resolvedPresentation,
    currentPModeRef,
    onSectionSelected,
    onPModeSelected,
    clearOverride,
  }
}
