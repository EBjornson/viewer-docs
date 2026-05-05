// Cross-section ownership enforcement (App-level, not Viewer contract).
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

export const CONFLICT_ID_PREVIEW_COUNT = 3

export function formatIdPreview(ids) {
  if (ids.length <= CONFLICT_ID_PREVIEW_COUNT) return ids.join(', ')
  const head = ids.slice(0, CONFLICT_ID_PREVIEW_COUNT).join(', ')
  return `${head} (+${ids.length - CONFLICT_ID_PREVIEW_COUNT} more)`
}

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

export function findOptionCaptureConflicts(optionCaptures, activeSectionId, payload) {
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
export function findExistingCrossSectionViolations(optionCaptures) {
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
export function groupConflictsByOwner(conflicts) {
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

export function mergeOptionCapture(existing, incoming) {
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
