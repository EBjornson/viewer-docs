import React, { useEffect, useRef, useState } from 'react'

// Hover-triggered flyout that shows the captured payload as JSON in Admin Mode.
// Also suppresses descendant native `title` attributes while the flyout is up
// so the browser's native tooltip doesn't sit on top of the JSON. Stashes each
// title on `data-suppressed-title` and restores them on hide.
export function CaptureTooltip({ payload, position = 'below', containerStyle, enabled = true, children }) {
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
