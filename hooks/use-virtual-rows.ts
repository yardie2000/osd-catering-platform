'use client'

import { useCallback, useEffect, useState } from 'react'

export type VirtualWindow = {
  /** erster zu rendernder Index (inkl.) */
  start: number
  /** letzter zu rendernder Index (exkl.) */
  end: number
  /** Höhe des oberen Platzhalters in px */
  padTop: number
  /** Höhe des unteren Platzhalters in px */
  padBottom: number
}

/**
 * Reine Fenster-Mathematik für die Zeilen-Virtualisierung (ohne DOM, unit-testbar).
 * Rendert nur die im Viewport sichtbaren Zeilen ± Overscan; oben/unten halten
 * Platzhalter die Gesamthöhe (und damit die Scrollbar) korrekt.
 */
export function computeWindow(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan = 8,
): VirtualWindow {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 }
  const safeScroll = Math.max(0, scrollTop)
  const start = Math.max(0, Math.floor(safeScroll / rowHeight) - overscan)
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight)
  const end = Math.min(count, start + visible + overscan * 2)
  const padTop = start * rowHeight
  const padBottom = Math.max(0, (count - end) * rowHeight)
  return { start, end, padTop, padBottom }
}

/**
 * Virtualisiert eine lange Zeilenliste in einem scrollbaren Container fester
 * Zeilenhöhe. Liefert die Scroll-Ref und das aktuelle Render-Fenster.
 */
export function useVirtualRows({
  count,
  rowHeight,
  overscan = 8,
}: {
  count: number
  rowHeight: number
  overscan?: number
}): { scrollRef: (el: HTMLDivElement | null) => void; window: VirtualWindow } {
  // Callback-Ref statt useRef: der Scroll-Container wird erst nach dem Laden
  // (bedingtes Rendern) gemountet. Ein Effekt mit leeren Deps würde ihn dann
  // verpassen und Scroll-Listener/Messung nie anhängen — die Liste ließe sich
  // nicht scrollen. Über den State-Node läuft der Effekt beim Mounten erneut.
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const scrollRef = useCallback((el: HTMLDivElement | null) => setNode(el), [])
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(640)

  useEffect(() => {
    if (!node) return
    const onScroll = () => setScrollTop(node.scrollTop)
    const measure = () => setViewport(node.clientHeight || 640)
    measure()
    node.addEventListener('scroll', onScroll, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      node.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [node])

  return { scrollRef, window: computeWindow(scrollTop, viewport, rowHeight, count, overscan) }
}
