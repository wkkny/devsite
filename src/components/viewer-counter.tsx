import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { FiEye } from 'react-icons/fi'

import { Tooltip } from '@/components/ui/tooltip'
import { portfolioOwner } from '@/data'
import { EASE_OUT } from '@/lib/ease'

// Counts up from zero once. It writes the text directly, so the count never re-renders React.
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const show = (current: number) => {
      node.textContent = Math.round(current).toLocaleString()
    }
    if (reduce) {
      show(value)
      return
    }
    const controls = animate(0, value, { duration: 0.8, ease: EASE_OUT, onUpdate: show })
    return () => controls.stop()
  }, [value, reduce])

  return <span ref={ref}>0</span>
}

export function ViewerCounter({ startAnimation }: { startAnimation: boolean }) {
  const [viewers, setViewers] = useState<number | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const url = new URL(portfolioOwner.visitorCounterUrl)
    url.searchParams.set('unique', 'true')

    if (
      import.meta.env.DEV ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      url.searchParams.set('readOnly', 'true')
    }

    async function loadViewers() {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) {
          setLoadFailed(true)
          return
        }

        const data: unknown = await response.json()
        if (
          typeof data === 'object' &&
          data !== null &&
          'value' in data &&
          typeof data.value === 'number' &&
          Number.isFinite(data.value) &&
          data.value >= 0
        ) {
          setViewers(data.value)
        } else {
          setLoadFailed(true)
        }
      } catch {
        if (!controller.signal.aborted) setLoadFailed(true)
        // Keep the profile usable when the counter service is unavailable.
      }
    }

    void loadViewers()
    return () => controller.abort()
  }, [])

  return (
    <Tooltip content="Visitors" side="bottom" gap={2} disabled={viewers === null || !startAnimation}>
      <output
        className="inline-flex h-8 shrink-0 items-center gap-2 px-2 text-sm font-medium leading-none text-muted-foreground"
        aria-label={
          viewers !== null
            ? `${viewers.toLocaleString()} visitors`
            : loadFailed
              ? 'Visitor count unavailable'
              : 'Visitor count loading'
        }
      >
        <FiEye aria-hidden="true" className="size-4" />
        {viewers === null || !startAnimation ? (
          <span aria-hidden="true" className="inline-flex h-[1.1em] items-center leading-none tabular-nums">—</span>
        ) : (
          <span aria-hidden="true" className="inline-flex h-[1.1em] items-center leading-none tabular-nums">
            <CountUp value={viewers} />
          </span>
        )}
      </output>
    </Tooltip>
  )
}
