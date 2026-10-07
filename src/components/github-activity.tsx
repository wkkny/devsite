import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  HeatCalendar,
  HeatCalendarGrid,
  HeatCalendarLegend,
  HeatCalendarTooltip,
} from '@/components/charts/heat-calendar'
import { addDays, mondayOf, startOfDay } from '@/components/charts/heat-calendar/utils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { portfolioOwner } from '@/data'
import { parseContributions, type ContributionDay } from '../../shared/github-activity'

// The calendar covers whole calendar years, Jan to Dec, from this year onwards.
const FIRST_YEAR = 2026
const DAY_MS = 86_400_000
const currentYear = () => Math.max(FIRST_YEAR, new Date().getUTCFullYear())

function dateForCell(start: Date, week: number, day: number) {
  return addDays(start, week * 7 + day).toISOString().slice(0, 10)
}

function GitHubActivity() {
  const [year, setYear] = useState(currentYear)
  const [contributionsByYear, setContributionsByYear] = useState<Record<number, ContributionDay[]>>({})
  const [hasEntered, setHasEntered] = useState(() => typeof IntersectionObserver === 'undefined')
  const [status, setStatus] = useState<{ year: number; kind: 'loading' | 'error' } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const retryButtonRef = useRef<HTMLButtonElement>(null)

  const years = Array.from({ length: currentYear() - FIRST_YEAR + 1 }, (_, index) => FIRST_YEAR + index)
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year, 11, 31))
  const gridStart = mondayOf(yearStart)
  const weeks = Math.ceil(((yearEnd.getTime() - gridStart.getTime()) / DAY_MS + 1) / 7)
  const contributions = contributionsByYear[year]
  const isLoaded = contributions !== undefined
  const isLoading = !isLoaded && status?.year === year && status.kind === 'loading'
  const hasError = !isLoaded && status?.year === year && status.kind === 'error'

  // On narrow screens the calendar scrolls; open it at today, or at the year's end for past years.
  useLayoutEffect(() => {
    const mobile = window.matchMedia('(max-width: 639px)')
    const firstMonday = mondayOf(new Date(Date.UTC(year, 0, 1)))
    const showLatestWeeks = () => {
      const scroller = calendarScrollRef.current
      if (!mobile.matches || !scroller) return
      const todayWeek = Math.floor((startOfDay(new Date()).getTime() - firstMonday.getTime()) / DAY_MS / 7)
      const lastVisibleWeek = Math.min(Math.max(todayWeek, 0), weeks - 1)
      scroller.scrollLeft = ((lastVisibleWeek + 1) / weeks) * scroller.scrollWidth - scroller.clientWidth
    }

    showLatestWeeks()
    mobile.addEventListener('change', showLatestWeeks)
    return () => mobile.removeEventListener('change', showLatestWeeks)
  }, [year, weeks])

  // Wait until the calendar is near the viewport before the first request.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    if (hasEntered) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        setHasEntered(true)
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [hasEntered])

  useEffect(() => {
    if (!hasEntered && attempt === 0) return
    if (isLoaded) return

    const controller = new AbortController()

    async function loadContributions() {
      setStatus({ year, kind: 'loading' })

      try {
        const response = await fetch(
          `https://github-contributions-api.jogruber.de/v4/${portfolioOwner.githubUsername}?y=${year}`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('Unable to fetch GitHub contributions')

        const data: unknown = await response.json()
        const days = parseContributions(data).filter((day) => day.date.startsWith(`${year}-`))
        if (!controller.signal.aborted) {
          // Move focus only if the visitor is still on the retry control that will disappear.
          if (document.activeElement === retryButtonRef.current) {
            calendarScrollRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus()
          }
          setContributionsByYear((current) => ({ ...current, [year]: days }))
          setStatus(null)
        }
      } catch {
        if (!controller.signal.aborted) setStatus({ year, kind: 'error' })
      }
    }

    void loadContributions()
    return () => controller.abort()
  }, [hasEntered, year, attempt, isLoaded])

  const byDate = new Map((contributions ?? []).map((day) => [day.date, day]))
  const values = Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => (byDate.get(dateForCell(gridStart, week, day))?.level ?? 0) / 4),
  )
  const counts = Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => byDate.get(dateForCell(gridStart, week, day))?.count ?? 0),
  )

  return (
    <div ref={sectionRef} className="w-full" aria-busy={isLoading}>
      <div className="mb-3 flex justify-end">
        <ToggleGroup
          aria-label="Contribution year"
          value={[String(year)]}
          onValueChange={(values) => {
            if (values[0]) setYear(Number(values[0]))
          }}
          variant="outline"
          size="sm"
        >
          {years.map((option) => (
            <ToggleGroupItem key={option} value={String(option)} aria-label={`Show ${option} activity`}>
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <HeatCalendar
        key={year}
        weeks={weeks}
        startDate={yearStart}
        endDate={yearEnd}
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
            setStatus({ year, kind: 'loading' })
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
