import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  HeatCalendar,
  HeatCalendarGrid,
  HeatCalendarLegend,
  HeatCalendarTooltip,
} from '@/components/charts/heat-calendar'
import { parseContributions, type ContributionDay } from '../../shared/github-activity'

const GITHUB_USERNAME = 'wkkny'
const WEEKS = 53

function dateForCell(start: Date, week: number, day: number) {
  const date = new Date(start)
  date.setUTCDate(date.getUTCDate() + week * 7 + day)
  return date.toISOString().slice(0, 10)
}

function GitHubActivity() {
  const [contributions, setContributions] = useState<ContributionDay[]>([])
  const [hasError, setHasError] = useState(false)
  const calendarScrollRef = useRef<HTMLDivElement>(null)

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
    const controller = new AbortController()

    async function loadContributions() {
      try {
        const response = await fetch(
          `https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('Unable to fetch GitHub contributions')

        const data: unknown = await response.json()
        setContributions(parseContributions(data))
      } catch {
        if (!controller.signal.aborted) setHasError(true)
      }
    }

    void loadContributions()
    return () => controller.abort()
  }, [])

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
    <div className="w-full">
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
      {hasError && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          GitHub activity is unavailable right now.
        </p>
      )}
    </div>
  )
}

export { GitHubActivity }
