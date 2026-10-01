import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  HeatCalendar,
  HeatCalendarGrid,
  HeatCalendarLegend,
  HeatCalendarTooltip,
} from '@/components/charts/heat-calendar'
import { portfolioOwner } from '@/data'
import { parseContributions, type ContributionDay } from '../../shared/github-activity'

const WEEKS = 53

function dateForCell(start: Date, week: number, day: number) {
  const date = new Date(start)
  date.setUTCDate(date.getUTCDate() + week * 7 + day)
  return date.toISOString().slice(0, 10)
}

function GitHubActivity() {
  const [contributions, setContributions] = useState<ContributionDay[]>([])
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const retryButtonRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const mobile = window.matchMedia('(max-width: 639px)')
    const showLatestWeeks = () => {
      if (mobile.matches && calendarScrollRef.current) {
        calendarScrollRef.current.scrollLeft = calendarScrollRef.current.scrollWidth
      }
    }

    showLatestWeeks()
    mobile.addEventListener('change', showLatestWeeks)
    return () => mobile.removeEventListener('change', showLatestWeeks)
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const controller = new AbortController()
    let started = false

    async function loadContributions() {
      if (started) return
      started = true
      setHasError(false)
      setIsLoading(true)

      try {
        const response = await fetch(
          `https://github-contributions-api.jogruber.de/v4/${portfolioOwner.githubUsername}?y=last`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('Unable to fetch GitHub contributions')

        const data: unknown = await response.json()
        const contributions = parseContributions(data)
        if (!controller.signal.aborted) {
          // Move focus only if the visitor is still on the retry control that will disappear.
          if (document.activeElement === retryButtonRef.current) {
            calendarScrollRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus()
          }
          setContributions(contributions)
        }
      } catch {
        if (!controller.signal.aborted) setHasError(true)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    if (attempt > 0 || typeof IntersectionObserver === 'undefined') {
      void loadContributions()
      return () => controller.abort()
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        void loadContributions()
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(section)

    return () => {
      observer.disconnect()
      controller.abort()
    }
  }, [attempt])

  const now = new Date()
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const startDate = new Date(endDate)
  startDate.setUTCDate(startDate.getUTCDate() - ((endDate.getUTCDay() + 6) % 7) - (WEEKS - 1) * 7)

  const byDate = new Map(contributions.map((day) => [day.date, day]))
  const values = Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => (byDate.get(dateForCell(startDate, week, day))?.level ?? 0) / 4),
  )
  const counts = Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => byDate.get(dateForCell(startDate, week, day))?.count ?? 0),
  )

  return (
    <div ref={sectionRef} className="w-full" aria-busy={isLoading}>
      <HeatCalendar
        weeks={WEEKS}
        endDate={endDate}
        values={values}
        counts={counts}
        unit="contributions"
        color="var(--portfolio-blue)"
        className="w-full"
      >
        <div ref={calendarScrollRef} className="calendar-scroll w-full overflow-x-auto overflow-y-hidden">
          <HeatCalendarGrid className="min-w-[742px] sm:min-w-0">
            <HeatCalendarTooltip />
          </HeatCalendarGrid>
        </div>
        <HeatCalendarLegend />
      </HeatCalendar>
      {isLoading && <p role="status" className="mt-3 text-sm text-muted-foreground">Loading GitHub activity…</p>}
      {hasError && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          GitHub activity is unavailable right now.
        </p>
      )}
      {(hasError || (attempt > 0 && isLoading)) && (
        <button
          ref={retryButtonRef}
          type="button"
          aria-disabled={isLoading}
          className="mt-2 rounded text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-50"
          onClick={() => {
            if (isLoading) return
            setIsLoading(true)
            setHasError(false)
            setAttempt((current) => current + 1)
          }}
        >
          Retry GitHub activity
        </button>
      )}
    </div>
  )
}

export { GitHubActivity }
