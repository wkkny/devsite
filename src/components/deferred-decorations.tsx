import { lazy, Suspense, useEffect, useState } from 'react'

const desktopQuery = '(min-width: 768px) and (hover: hover) and (pointer: fine)'
const DraggableDecorations = lazy(() => import('./draggable-decorations').then((module) => ({ default: module.DraggableDecorations })).catch(() => ({ default: () => null })))

export function DeferredDecorations({ entryReady }: { entryReady: boolean }) {
  const [desktop, setDesktop] = useState(() => window.matchMedia(desktopQuery).matches)
  useEffect(() => {
    const query = window.matchMedia(desktopQuery)
    const update = () => setDesktop(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return desktop && entryReady ? (
    <Suspense fallback={null}>
      <DraggableDecorations entryReady={entryReady} />
    </Suspense>
  ) : null
}
