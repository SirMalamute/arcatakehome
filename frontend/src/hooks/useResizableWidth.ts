import { useCallback, useEffect, useState } from 'react'

function readStored(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key))
    return v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

/** Width of a right-docked pane, dragged from its left edge, remembered per browser. */
export function useResizableWidth(key: string, initial = 520, min = 360, maxFraction = 0.65) {
  const [width, setWidth] = useState(() => readStored(key, initial))

  useEffect(() => {
    try {
      localStorage.setItem(key, String(Math.round(width)))
    } catch {
      /* storage unavailable: width just isn't remembered */
    }
  }, [key, width])

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = width
      const onMove = (ev: PointerEvent) => {
        const max = window.innerWidth * maxFraction
        setWidth(Math.min(max, Math.max(min, startW + (startX - ev.clientX))))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [width, min, maxFraction],
  )

  return { width, startDrag }
}
