export const VIEWER_CONTRACT_VERSION = '1.7'

export const VIEWER_CAMERA_MODES = Object.freeze([
  'exterior',
  'interior',
  'overhead',
])

export const VIEWER_PRESENTATION_MODES = Object.freeze([
  'day',
  'nightExt',
  'nightInt',
  'winterDay',
  'winterNight',
  'winterNightInt',
])

export const VIEWER_LIGHT_SOURCE_MODES = Object.freeze(['import', 'auto', 'none'])

/**
 * @typedef {'exterior' | 'interior' | 'overhead'} ViewerCameraMode
 */

/**
 * @typedef {'day' | 'nightExt' | 'nightInt' | 'winterDay' | 'winterNight' | 'winterNightInt'} ViewerPresentationMode
 */

/**
 * @typedef {'import' | 'auto' | 'none'} ViewerLightSourceMode
 */

/**
 * @typedef {[number, number, number]} ViewerVector3Tuple
 */

/**
 * FOV is intentionally omitted: it is fully determined by `cameraMode` (each
 * mode has a canonical default), so storing it would be redundant. The Viewer
 * resolves FOV from the active cameraMode at replay time.
 *
 * @typedef {object} ViewerCameraPose
 * @property {ViewerVector3Tuple} position
 * @property {ViewerVector3Tuple} target
 */

/**
 * @typedef {object} ViewerModelInput
 * @property {string} [modelUrl] - Path or blob URL of the .glb to load. Omit (or pass undefined) when no model is selected; the Viewer renders an empty scene in that case.
 * @property {string} [productId]
 * @property {string} [modelVersion]
 */

/**
 * @typedef {object} ViewerCameraInput
 * @property {ViewerCameraMode} [cameraMode]
 * @property {ViewerCameraPose} [pose]
 */

/**
 * @typedef {object} ViewerSceneVisibilityAssignments
 * @property {string[]} [hiddenGeometryIds]      - Geometry to hide (fade). Overridden by shownGeometryIds.
 * @property {string[]} [shownGeometryIds]        - Geometry to show even if present in hiddenGeometryIds.
 * @property {string[]} [instantHiddenGeometryIds]
 * @property {string[] | null} [isolatedGeometryIds]
 */

/**
 * @typedef {object} ViewerMaterialAssignmentMaps
 * @property {string} [color]
 * @property {string} [normal]
 * @property {string} [roughness]
 * @property {string} [ao]
 */

/**
 * @typedef {object} ViewerMaterialAssignment
 * @property {string[]} geometryIds
 * @property {string} [color]
 * @property {number} [roughness]
 * @property {number} [metalness]
 * @property {boolean} [restoreOriginalMaterial]
 * @property {ViewerMaterialAssignmentMaps} [maps]
 * @property {number} [textureScale]
 * @property {number} [normalMapIntensity]
 * @property {number} [textureRotation]
 */

/**
 * @typedef {object} ViewerSceneInput
 * @property {ViewerSceneVisibilityAssignments} [visibilityAssignments]
 * @property {ViewerMaterialAssignment[]} [defaultMaterialAssignments]
 * @property {ViewerMaterialAssignment[]} [materialAssignments]
 */

/**
 * @typedef {object} ViewerSolarTimeInput
 * @property {number} [hour]      - Hour of day (0–23.75 in 0.25 increments)
 * @property {number} [dayOfYear] - Day of year (1–366; supports leap years)
 */

/**
 * @typedef {object} ViewerSolarInput
 * @property {number} [latitude]
 * @property {number} [longitude]
 * @property {number} [northOffset]
 * @property {ViewerSolarTimeInput} [time]
 */

/**
 * @typedef {object} ViewerPresentationUiInput
 * @property {boolean} [showSolarSitePanel]
 * @property {boolean} [showNorthArrow]
 * @property {boolean} [showPresetViews]
 * @property {boolean} [showPresentationPresets]
 * @property {boolean} [showWinterPresets]
 * @property {boolean} [showSpaceMenu]
 */

/**
 * @typedef {object} ViewerPresentationInput
 * @property {string} [environmentId]
 * @property {number} [environmentRotation]
 * @property {number} [hdrIntensity]
 * @property {number} [backgroundIntensity]
 * @property {string} [terrainPresetId]
 * @property {number} [terrainIntensity]
 * @property {number} [exposure]
 * @property {number} [sunIntensity]
 * @property {number} [ambientIntensity]
 * @property {ViewerSolarInput} [solar]
 * @property {ViewerPresentationUiInput} [ui]
 * @property {number} [pointLightIntensity]
 * @property {number} [spotLightIntensity]
 * @property {number} [pointLightDistance]
 * @property {number} [pointLightDecay]
 * @property {number} [spotLightDecay]
 * @property {number} [pointLightColorTemperature]
 * @property {number} [emissiveIntensity]
 * @property {ViewerLightSourceMode} [lightSourceMode] - Marker-driven light source policy. `'import'` uses authored marker lights from the loaded model; `'auto'` synthesizes a derived layout when no markers exist; `'none'` disables interior fixtures entirely. When omitted, the Viewer resolves a smart default per loaded model: `'import'` if light markers are detected, `'auto'` otherwise.
 */

/**
 * @typedef {object} ViewerBatchRenderCaptureItem
 * @property {object} [metadata]
 * @property {{ pose?: ViewerCameraPose, cameraMode?: ViewerCameraMode }} [camera]
 * @property {ViewerSceneInput} [scene]
 * @property {ViewerPresentationInput} [presentation]
 */

/**
 * @typedef {object} ViewerAdminBatchCaptureInput
 * @property {number} nonce
 * @property {ViewerBatchRenderCaptureItem[]} items
 */

/**
 * Optional hint from the App about which authoring context the admin is
 * currently focused on. The Viewer uses this to filter the authoring panel
 * down to controls relevant to the current focus. Send `'all'` (or omit) to
 * preserve legacy non-dynamic behavior where the panel exposes everything
 * and the admin uses the Presentation/Option mode toggle manually.
 * @typedef {'section' | 'option' | 'view' | 'presentationMode' | 'all'} ViewerAuthoringFocus
 */

/**
 * @typedef {object} ViewerAdminInput
 * @property {boolean} [enabled]
 * @property {ViewerOptionCapturePayload} [activeOptionCapture]
 * @property {ViewerAdminBatchCaptureInput} [batchCapture]
 * @property {ViewerAuthoringFocus} [activeAuthoringFocus]
 */

/**
 * @typedef {object} ViewerInput
 * @property {ViewerModelInput} model
 * @property {ViewerCameraInput} [camera]
 * @property {ViewerSceneInput} [scene]
 * @property {ViewerPresentationInput} [presentation]
 * @property {Record<string, ViewerPresentationInput>} [presentationModeCaptures] - App's persisted per-mode capture map (key = presentation mode id). Consulted by the Viewer's mode-switch resolver to apply the captured snapshot for the selected mode; absent entries fall through to Viewer-side lighting defaults. App owns this map; Viewer only reads it.
 * @property {ViewerPresentationMode} [activePresentationMode] - The presentation mode the App considers active. The Viewer mirrors this into its internal mode-button highlight so user-mode replays — where the App switches presentation modes implicitly via section/view selection — keep the highlighted button in sync. Direct mode-button clicks update the Viewer's state optimistically and round-trip through `onActivePresentationModeChanged`; the App should reflect that callback back onto this field for the next render. Optional: if omitted, the Viewer manages its mode highlight internally (legacy behavior).
 * @property {number} [presentationSyncKey] - Bump-style force-resync signal. Increment when there's a stored capture to replay so the Viewer re-syncs its presentation state from `input.presentation`. Do NOT increment when `input.presentation` reflects only defaults — that would overwrite admin-edited values. Typical use: bump on section/view tile clicks during user-mode replay.
 * @property {ViewerAdminInput} [admin]
 */

/**
 * @typedef {object} ViewerReadyEventCameraInfo
 * @property {ViewerVector3Tuple} target
 * @property {ViewerVector3Tuple} size
 * @property {number} maxDim
 * @property {number} distance
 */

/**
 * @typedef {object} ViewerReadyEvent
 * @property {string} [modelUrl]
 * @property {string} [productId]
 * @property {string} [modelVersion]
 * @property {ViewerCameraMode} [cameraMode]
 * @property {ViewerReadyEventCameraInfo} [cameraInfo]
 */

/**
 * @typedef {object} ViewerGeometryPickedEvent
 * @property {string} [geometryId]
 * @property {string} [meshName]
 * @property {string} [assemblyId]
 */

/**
 * @typedef {object} ViewerRenderCapturedEvent
 * @property {string} [imageUrl]
 * @property {unknown} [blob]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {object} ViewerErrorEvent
 * @property {string} [message]
 * @property {string} [code]
 * @property {unknown} [details]
 */

/**
 * @typedef {object} ViewerSectionCapturePayload
 * @property {ViewerCameraPose} pose
 * @property {ViewerCameraMode} [cameraMode]
 * @property {ViewerPresentationMode} presentationMode
 * @property {ViewerSceneVisibilityAssignments} [visibilityAssignments]
 * @property {ViewerPresentationUiInput} [ui]
 */

/**
 * Payload fired by onOptionCaptured. Intentionally carries no section or option
 * identity — those are App-level concerns. The App routes this payload to the
 * correct storage location using its own current selection state at capture time.
 *
 * @typedef {object} ViewerOptionCapturePayload
 * @property {string[]} [geometryIds]
 * @property {ViewerMaterialAssignment[]} [materialAssignments]
 */

/**
 * @typedef {object} ViewerMaterialDefaultsPayload
 * @property {ViewerMaterialAssignment[]} defaultMaterialAssignments
 */

/**
 * @typedef {object} ViewerViewCapturePayload
 * @property {ViewerCameraMode} cameraMode
 * @property {ViewerCameraPose} pose
 * @property {ViewerPresentationMode} presentationMode
 * @property {ViewerSceneVisibilityAssignments} [visibilityAssignments]
 * @property {ViewerPresentationUiInput} [ui]
 */

/**
 * @typedef {object} ViewerPresentationModeCapturePayload
 * @property {ViewerPresentationMode} mode
 * @property {ViewerPresentationInput} presentation
 */

/**
 * @typedef {object} ViewerOutput
 * @property {(event: ViewerReadyEvent) => void} [onViewerReady]
 * @property {(event: ViewerGeometryPickedEvent) => void} [onGeometryPicked]
 * @property {(event: ViewerRenderCapturedEvent) => void} [onRenderCaptured]
 * @property {() => void} [onBatchCaptureComplete]
 * @property {(event: ViewerErrorEvent) => void} [onError]
 * @property {(payload: ViewerSectionCapturePayload) => void} [onSectionCaptured]
 * @property {() => void} [onSectionCaptureCleared]
 * @property {(payload: ViewerOptionCapturePayload) => void} [onOptionCaptured]
 * @property {() => void} [onOptionCaptureCleared]
 * @property {(payload: ViewerMaterialDefaultsPayload) => void} [onMaterialDefaultsCaptured]
 * @property {() => void} [onMaterialDefaultsCleared]
 * @property {(payload: ViewerViewCapturePayload) => void} [onViewCaptured]
 * @property {(cameraMode: ViewerCameraMode) => void} [onViewCaptureCleared]
 * @property {(cameraMode: ViewerCameraMode) => void} [onViewSelected]
 * @property {(cameraMode: ViewerCameraMode) => void} [onSpaceTileWalkActivated]
 * @property {(payload: ViewerPresentationModeCapturePayload) => void} [onPresentationModeCaptured]
 * @property {(mode: ViewerPresentationMode) => void} [onPresentationModeCaptureCleared]
 * @property {(mode: ViewerPresentationMode) => void} [onActivePresentationModeChanged]
 */
