import { useEffect, useState } from 'react'
import { FiEye } from 'react-icons/fi'

import { Tooltip } from '@/components/motion/tooltip'
import { EASED_LINEAR_CSS } from '@/lib/ease'
import { cn } from '@/lib/utils'

const counterUrl = 'https://counterapi.com/api/wkkny-devsite/view/home'

export function ViewerCounter() {
  const [viewers, setViewers] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const url = new URL(counterUrl)
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
        if (!response.ok) return

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
        }
      } catch {
        // Keep the profile usable when the counter service is unavailable.
      }
    }

    void loadViewers()
    return () => controller.abort()
  }, [])

  return (
    <Tooltip
      content="Visitors"
      side="bottom"
      gap={2}
      wrapperClassName={viewers === null ? 'pointer-events-none' : undefined}
    >
      <output
        className={cn(
          'inline-flex h-10 shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground motion-safe:transition-opacity motion-safe:duration-200',
          viewers === null ? 'opacity-0' : 'opacity-100',
        )}
        style={{ transitionTimingFunction: EASED_LINEAR_CSS }}
        aria-label={viewers === null ? 'Visitor count loading' : `${viewers.toLocaleString()} visitors`}
      >
        <FiEye aria-hidden="true" className="size-4" />
        <span className="tabular-nums">{viewers === null ? '—' : viewers.toLocaleString()}</span>
      </output>
    </Tooltip>
  )
}
