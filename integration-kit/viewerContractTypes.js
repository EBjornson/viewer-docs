export const VIEWER_CONTRACT_VERSION = '1.8'

export const VIEWER_CAMERA_MODES = Object.freeze([
  'exterior',
  'interior',
  'overhead',
])

export const VIEWER_LIGHT_SOURCE_MODES = Object.freeze(['import', 'auto', 'none'])

/**
 * @typedef {'exterior' | 'interior' | 'overhead'} ViewerCameraMode
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
 * @property {string[]} [sectionHiddenGeometryIds] - Geometry to hide (fade) at the section level. Not overridable by shownGeometryIds. Auto-suspended by the Viewer during overhead-nav (see capture_and_replay.md).
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
 * @typedef {object} ViewerAdminInput
 * @property {boolean} [enabled]
 * @property {ViewerAdminBatchCaptureInput} [batchCapture]
 */

/**
 * @typedef {object} ViewerInput
 * @property {ViewerModelInput} model
 * @property {ViewerCameraInput} [camera]
 * @property {ViewerSceneInput} [scene]
 * @property {ViewerPresentationInput} [presentation]
 * @property {ViewerAdminInput} [admin]
 * @property {number} [selectionKey] - Optional monotonically-increasing counter the App bumps on every section selection click that has a captured pose to replay. The Viewer's only response: force the camera animation effect to re-fire even when `camera.pose`'s reference identity is unchanged. Handles the "user clicks the active section to return to its captured pose after free-navigating" case. Bumping for uncaptured sections is harmless; option clicks should not bump.
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
 * Section capture is self-contained: the embedded `presentation` snapshot is
 * everything the App needs to replay (no external pMode lookup). The App may
 * attach its own `presentationMode` tag as App metadata for re-skin support;
 * that tag is App-side and not part of this contract.
 *
 * The hides captured by Section Capture are emitted under
 * `visibilityAssignments.sectionHiddenGeometryIds` — the same field name the
 * App pushes back via `viewerInput.scene.visibilityAssignments` on replay.
 * Capture-pass-through ({ ...capture.visibilityAssignments }) Just Works
 * without translation. `hiddenGeometryIds` on the input side is reserved for
 * the option-visibility pool, not section-level hides.
 *
 * @typedef {object} ViewerSectionCapturePayload
 * @property {ViewerCameraPose} pose
 * @property {ViewerCameraMode} cameraMode
 * @property {ViewerPresentationInput} presentation
 * @property {ViewerSceneVisibilityAssignments} [visibilityAssignments]
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
 * @typedef {object} ViewerOutput
 * @property {(event: ViewerReadyEvent) => void} [onViewerReady]
 * @property {(event: ViewerRenderCapturedEvent) => void} [onRenderCaptured]
 * @property {() => void} [onBatchCaptureComplete]
 * @property {(event: ViewerErrorEvent) => void} [onError]
 * @property {(payload: ViewerSectionCapturePayload) => void} [onSectionCaptured]
 * @property {() => void} [onSectionCaptureCleared]
 * @property {(payload: ViewerOptionCapturePayload) => void} [onOptionCaptured]
 * @property {() => void} [onOptionCaptureCleared]
 * @property {(payload: ViewerMaterialDefaultsPayload) => void} [onMaterialDefaultsCaptured]
 * @property {() => void} [onMaterialDefaultsCleared]
 * @property {(snapshot: ViewerPresentationInput) => void} [onPresentationModeCaptured]
 * @property {() => void} [onPresentationModeCaptureCleared]
 */
