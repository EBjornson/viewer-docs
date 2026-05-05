import React from 'react'
import { groupConflictsByOwner, formatIdPreview } from './crossSectionConflicts'

export function CaptureConflictBanner({ conflict, formatOwnerLabel, onDismiss }) {
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

export function LoadViolationsBanner({ violations, onDismiss }) {
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
