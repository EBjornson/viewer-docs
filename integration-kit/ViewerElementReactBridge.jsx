import { useEffect, useRef } from 'react'
import { VIEWER_OUTPUT_EVENT_MAP } from './viewerOutputEventMap.js'

// React adapter for any React host that consumes the Viewer bundle. Mounts the
// framework-agnostic <viewer-element> using the same `{ input, output }`
// prop shape the rest of the integration kit assumes.
//
// **Why this bridge exists** — and why React hosts cannot just `import { Viewer }`
// from the bundle directly: the Viewer bundle ships its own React internally
// (alongside Three.js and @react-three/fiber). A React host with its own
// React installed would have TWO React instances at runtime; React's hooks
// require all hook calls within a component tree to dispatch against the
// SAME React instance. The bundle's `<Viewer>` export, when rendered by the
// host's React tree, calls hooks against the bundle's React → "Invalid hook
// call" → blank page with no obvious error. The custom element
// `<viewer-element>` sidesteps this by creating its own React root
// internally; the host just renders the element and communicates via DOM
// property + DOM events. This bridge wraps that pattern in a React-friendly
// `{ input, output }` API.
//
// The bridge talks to the element exclusively through DOM APIs (setting
// the `input` property, attaching event listeners) — exactly the path a
// non-React host (Vue, Svelte, Vanilla JS) would use. There is intentionally
// no React state shared across the boundary; the bundled React inside the
// element is its own world.

export function ViewerElementReactBridge({ input, output }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.input = input
  }, [input])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const bound = []
    for (const [callbackName, eventName] of Object.entries(VIEWER_OUTPUT_EVENT_MAP)) {
      const cb = output?.[callbackName]
      if (typeof cb !== 'function') continue
      const handler = (e) => cb(e.detail)
      el.addEventListener(eventName, handler)
      bound.push([eventName, handler])
    }
    return () => {
      for (const [eventName, handler] of bound) {
        el.removeEventListener(eventName, handler)
      }
    }
  }, [output])

  return (
    <viewer-element
      ref={ref}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
