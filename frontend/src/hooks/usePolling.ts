import { useEffect, useRef } from 'react'

/** Call `fn` every `intervalMs` while `active` is true. */
export function usePolling(fn: () => void, active: boolean, intervalMs = 2000) {
  const saved = useRef(fn)
  useEffect(() => {
    saved.current = fn
  }, [fn])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => saved.current(), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
}
