// Shared map: ViewerOutput callback name → CustomEvent name dispatched on the
// element. Convention: drop the "on" prefix and lowercase the rest.
// Exception: onError → 'viewererror' to avoid clashing with the native DOM
// `error` event that browsers may fire on elements.
//
// Source of truth for both ViewerElement (custom element side) and
// ViewerElementReactBridge (React side). Adding a new ViewerOutput callback
// requires updating ViewerOutput in viewerContractTypes.js AND this file.
export const VIEWER_OUTPUT_EVENT_MAP = Object.freeze({
  onViewerReady: 'viewerready',
  onRenderCaptured: 'rendercaptured',
  onBatchCaptureComplete: 'batchcapturecomplete',
  onError: 'viewererror',
  onSectionCaptured: 'sectioncaptured',
  onSectionCaptureCleared: 'sectioncapturecleared',
  onOptionCaptured: 'optioncaptured',
  onOptionCaptureCleared: 'optioncapturecleared',
  onMaterialDefaultsCaptured: 'materialdefaultscaptured',
  onMaterialDefaultsCleared: 'materialdefaultscleared',
  onPresentationModeCaptured: 'presentationmodecaptured',
  onPresentationModeCaptureCleared: 'presentationmodecapturecleared',
})
