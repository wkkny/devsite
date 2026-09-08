import { memo, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContributionLevel = 0 | 1 | 2 | 3 | 4

export type ContributionData = {
    [date: string]: {
        level: ContributionLevel
        label?: string
        count?: number
    }
}

export type ThemeColors = {
    level0: string
    level1: string
    level2: string
    level3: string
    level4: string
}

export type CellShape = "rounded" | "circle"

export type GithubCalendarProps = {

    username?: string // GitHub username
    data?: ContributionData //Optional - Only for manual data
    startDate?: string
    endDate?: string
    startsOnSunday?: boolean //Want to start weeks on Sunday or not ?
    cellSize?: number
    cellGap?: number
    fillWidth?: boolean
    maxCellSize?: number
    cellShape?: CellShape //Rounded | Circle
    theme?: "github" | "blue" | "sunset" | "purple" | "gray" | "minimal" | ThemeColors
    showMonthLabels?: boolean // Want the month labels on top
    showStats?: boolean
    showLegend?: boolean
    className?: string // Custom class for custom styling
}

// ─── Built-in themes ──────────────────────────────────────────────────────────

const THEMES: Record<string, ThemeColors> = {
    github: {
        level0: "#ebedf0",
        level1: "#9be9a8",
        level2: "#40c463",
        level3: "#30a14e",
        level4: "#216e39",
    },
    blue: {
        level0: "#eff6ff",
        level1: "#bfdbfe",
        level2: "#60a5fa",
        level3: "#2563eb",
        level4: "#1e3a8a",
    },
    sunset: {
        level0: "#fff7ed",
        level1: "#fed7aa",
        level2: "#fb923c",
        level3: "#ea580c",
        level4: "#7c2d12",
    },
    purple: {
        level0: "#faf5ff",
        level1: "#e9d5ff",
        level2: "#a855f7",
        level3: "#7e22ce",
        level4: "#3b0764",
    },
    gray: {
        level0: "#f3f4f6",
        level1: "#d1d5db",
        level2: "#9ca3af",
        level3: "#4b5563",
        level4: "#111827",
    },
    minimal: {
        level0: "#f4f4f5",
        level1: "#d4d4d8",
        level2: "#a1a1aa",
        level3: "#71717a",
        level4: "#18181b",
    },
}

const DARK_THEMES: Record<string, ThemeColors> = {
    github: {
        level0: "#161b22",
        level1: "#0e4429",
        level2: "#006d32",
        level3: "#26a641",
        level4: "#39d353",
    },
    blue: {
        level0: "#161e2b",
        level1: "#1e3a5f",
        level2: "#1d4ed8",
        level3: "#3b82f6",
        level4: "#93c5fd",
    },
    sunset: {
        level0: "#261a13",
        level1: "#7c2d12",
        level2: "#c2410c",
        level3: "#f97316",
        level4: "#fdba74",
    },
    purple: {
        level0: "#191124",
        level1: "#3b0764",
        level2: "#6b21a8",
        level3: "#a855f7",
        level4: "#d8b4fe",
    },
    gray: {
        level0: "#13181f",
        level1: "#374151",
        level2: "#6b7280",
        level3: "#9ca3af",
        level4: "#e5e7eb",
    },
    minimal: {
        level0: "#18181b",
        level1: "#3f3f46",
        level2: "#71717a",
        level3: "#a1a1aa",
        level4: "#fafafa",
    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
    const parts = dateStr.split("-").map(Number)
    const y = parts[0] ?? 0
    const m = parts[1] ?? 1
    const d = parts[2] ?? 1
    return new Date(y, m - 1, d)
}

function formatDate(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const CONTRIBUTION_LEVELS: ContributionLevel[] = [0, 1, 2, 3, 4]
const EMPTY_CONTRIBUTIONS: ContributionData = {}

function formatTooltipDate(dateStr: string): string {
    const date = parseDate(dateStr)
    return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
}

function getContributionLabel(count?: number, level?: ContributionLevel, label?: string): string {
    if (label) return label
    if (count !== undefined) return `${count} contribution${count === 1 ? "" : "s"}`
    if (level !== undefined) return `Level ${level}`
    return "No contributions"
}

function getContributionSummaryLabel(count: number): string {
    return `contribution${count === 1 ? "" : "s"} this year`
}

function getContributionTotal(data: ContributionData) {
    return Object.values(data).reduce(
        (sum, value) => sum + (value.count ?? (value.level > 0 ? 1 : 0)),
        0
    )
}

// ─── API fetch ────────────────────────────────────────────────────────────────

type APIResponse = {
    contributions: { date: string; count: number; level: number }[]
}

async function fetchContributions(username: string): Promise<ContributionData> {
    const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}`)
    if (!res.ok) {
        throw new Error(`Could not fetch contributions for "${username}" (${res.status})`)
    }
    const json: APIResponse = await res.json()

    const result: ContributionData = {}
    for (const entry of json.contributions) {
        result[entry.date] = {
            level: Math.min(4, Math.max(0, entry.level)) as ContributionLevel,
            count: entry.count,
        }
    }
    return result
}

// ─── Build calendar grid ──────────────────────────────────────────────────────

function buildGrid(
    startDate: string,
    endDate: string,
    startsOnSunday: boolean
): { weeks: (string | null)[][]; monthLabels: { label: string; weekIndex: number }[]; gridStart: string } {
    const start = parseDate(startDate)
    const end = parseDate(endDate)

    const startDay = startsOnSunday ? 0 : 1
    const startDow = start.getDay()
    const offset = ((startDow - startDay) + 7) % 7
    const gridStart = addDays(start, -offset)

    const weeks: (string | null)[][] = []
    const monthLabels: { label: string; weekIndex: number }[] = []

    let current = new Date(gridStart)
    let weekIndex = 0
    let lastMonth = -1

    while (current <= end || (weeks.length > 0 && (weeks[weeks.length - 1]?.length ?? 0) < 7)) {
        const week: (string | null)[] = []

        for (let d = 0; d < 7; d++) {
            const dateStr = formatDate(current)
            const isInRange = current >= start && current <= end
            week.push(isInRange ? dateStr : null)

            if (isInRange && current.getMonth() !== lastMonth) {
                lastMonth = current.getMonth()
                monthLabels.push({ label: MONTH_NAMES[current.getMonth()]!, weekIndex })
            }

            current = addDays(current, 1)
        }

        weeks.push(week)
        weekIndex++

        if (current > end && weeks.length > 0 && (weeks[weeks.length - 1]?.every((d) => d === null || parseDate(d) > end) ?? false)) break
    }

    return { weeks, monthLabels, gridStart: formatDate(gridStart) }
}

// ─── Tooltip state type ───────────────────────────────────────────────────────

type TooltipState = {
    visible: boolean
    date: string
    count: number | undefined
    label: string | undefined
    x: number
    y: number
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function CalendarSkeleton({
    cellSize = 12,
    cellGap = 3,
    fillWidth = false,
    maxCellSize,
    cellShape = "rounded",
    showMonthLabels = true,
    showStats = true,
    showLegend = true,
    startsOnSunday = true,
    startDate,
    endDate,
    className,
}: {
    cellSize?: number
    cellGap?: number
    fillWidth?: boolean
    maxCellSize?: number
    cellShape?: CellShape
    showMonthLabels?: boolean
    showStats?: boolean
    showLegend?: boolean
    startsOnSunday?: boolean
    startDate?: string
    endDate?: string
    className?: string
}) {
    const maxCellSizeResolved = maxCellSize ?? cellSize * 1.5

    // Same date logic as the real grid so label positions / week count match exactly
    const resolvedEnd = endDate ?? formatDate(new Date())
    const resolvedStart = useMemo(() => {
        if (startDate) return startDate
        const d = parseDate(resolvedEnd)
        d.setFullYear(d.getFullYear() - 1)
        d.setDate(d.getDate() + 1)
        return formatDate(d)
    }, [startDate, resolvedEnd])

    const { weeks, monthLabels, gridStart } = useMemo(
        () => buildGrid(resolvedStart, resolvedEnd, startsOnSunday),
        [resolvedStart, resolvedEnd, startsOnSunday]
    )

    // Match the real component's fill-to-width measurement
    const wrapRef = useRef<HTMLDivElement>(null)
    const [wrapWidth, setWrapWidth] = useState(0)

    useEffect(() => {
        if (!fillWidth) return
        const el = wrapRef.current
        if (!el) return

        const measure = () => setWrapWidth(el.clientWidth)
        measure()

        const observer = new ResizeObserver(measure)
        observer.observe(el)

        return () => observer.disconnect()
    }, [fillWidth])

    const effectiveCellSize = useMemo(() => {
        if (!fillWidth || wrapWidth === 0) return cellSize
        const available = wrapWidth - 24
        const fitted = Math.floor(
            (available - (weeks.length - 1) * cellGap) / weeks.length
        )
        return Math.max(2, Math.min(fitted, maxCellSizeResolved))
    }, [fillWidth, wrapWidth, weeks.length, cellGap, cellSize, maxCellSizeResolved])

    const step = effectiveCellSize + cellGap
    const monthLabelHeight = showMonthLabels ? 20 : 0
    const svgWidth = weeks.length * step - cellGap
    const svgHeight = monthLabelHeight + 7 * step - cellGap
    const cellRx = cellShape === "circle" ? effectiveCellSize / 2 : effectiveCellSize * 0.2

    const labelByWeek = new Map<number, string>()
    monthLabels.forEach(({ label, weekIndex }) => {
        if (!labelByWeek.has(weekIndex)) labelByWeek.set(weekIndex, label)
    })

    return (
        <div ref={wrapRef} className={cn("w-full overflow-x-hidden border rounded-sm", className)}>
            <div className="w-fit mx-auto max-w-full flex flex-col gap-3 p-3 animate-pulse">
                <div
                    className="relative overflow-x-auto"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
                >
                    <svg width={svgWidth} height={svgHeight} className="overflow-visible">
                        {/* month label placeholders */}
                        {showMonthLabels && ([...labelByWeek.entries()].map(([weekIndex, label]) => (
                            <rect
                                key={`label-${weekIndex}-${label}`}
                                x={weekIndex * step}
                                y={2}
                                width={label.length * 7.5}
                                height={11}
                                rx={3}
                                className="fill-muted"
                            />
                        )))}

                        {/* cell placeholders */}
                        {weeks.map((week, wi) =>
                            week.map((date, di) => {
                                if (!date) {
                                    const cellDate = formatDate(addDays(parseDate(gridStart), wi * 7 + di))
                                    if (cellDate > resolvedEnd) return null
                                }
                                return (
                                    <rect
                                        key={`${wi}-${di}`}
                                        x={wi * step}
                                        y={monthLabelHeight + di * step}
                                        width={effectiveCellSize}
                                        height={effectiveCellSize}
                                        rx={cellRx}
                                        className="fill-muted"
                                    />
                                )
                            })
                        )}
                    </svg>
                </div>

                {/* stats + legend placeholders */}
                <div className="flex items-start justify-between gap-x-4">
                    {showStats && (
                        <div className="flex flex-1 flex-wrap items-center gap-x-1.5">
                            <div className="h-4 w-16 rounded bg-muted" />
                            <div className="h-4 w-28 rounded bg-muted" />
                        </div>
                    )}
                    {showLegend && (
                        <div className="flex shrink-0 items-center gap-1.5">
                            <div className="h-3 w-8 rounded bg-muted" />
                            {CONTRIBUTION_LEVELS.map((level) => (
                                <svg key={level} width={effectiveCellSize} height={effectiveCellSize}>
                                    <rect
                                        width={effectiveCellSize}
                                        height={effectiveCellSize}
                                        rx={cellRx}
                                        className="fill-muted"
                                    />
                                </svg>
                            ))}
                            <div className="h-3 w-10 rounded bg-muted" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export const GithubCalendar = memo(function GithubCalendar({
    username,
    data: dataProp,
    startDate,
    endDate,
    startsOnSunday = true,
    cellSize = 12,
    cellGap = 3,
    fillWidth = false,
    maxCellSize: maxCellSizeProp,
    cellShape = "rounded",
    theme = "github",
    showMonthLabels = true,
    showStats = true,
    showLegend = true,
    className,
}: GithubCalendarProps) {
    // Scroll ref — used to auto-scroll to most recent months on compact viewports
    const scrollRef = useRef<HTMLDivElement>(null)
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const checkDark = () => {
            setIsDark(
                document.documentElement.classList.contains("dark") ||
                document.body.classList.contains("dark")
            )
        }

        checkDark()

        const observer = new MutationObserver(checkDark)
        const opts = { attributes: true, attributeFilter: ["class"] }
        observer.observe(document.documentElement, opts)
        observer.observe(document.body, opts)

        return () => observer.disconnect()
    }, [])

    // ── Fetch state ────────────────────────────────────────────────────────
    const query = useQuery({
        queryKey: ["github-contributions", username],
        queryFn: () => fetchContributions(username!),
        enabled: Boolean(username),
        staleTime: 3_600_000,
        retry: 2,
    })

    const fetchedData = query.data ?? null
    const loading = Boolean(username) && query.isPending
    const fetchError = query.error
        ? query.error instanceof Error
            ? query.error.message
            : String(query.error)
        : null

    // ── Choose data source ─────────────────────────────────────────────────
    const data = dataProp ?? fetchedData ?? EMPTY_CONTRIBUTIONS

    // ── Resolve dates ──────────────────────────────────────────────────────
    const resolvedEnd = endDate ?? formatDate(new Date())
    const resolvedStart = useMemo(() => {
        if (startDate) return startDate
        const d = parseDate(resolvedEnd)
        d.setFullYear(d.getFullYear() - 1)
        d.setDate(d.getDate() + 1)
        return formatDate(d)
    }, [startDate, resolvedEnd])

    // ── Filter data to the visible range ──────────────────────────────────
    const filteredData = useMemo(() => {
        const filtered: ContributionData = {}
        for (const [date, value] of Object.entries(data)) {
            if (date >= resolvedStart && date <= resolvedEnd) {
                filtered[date] = value
            }
        }
        return filtered
    }, [data, resolvedStart, resolvedEnd])

    // ── Fill-width measurement ─────────────────────────────────────────────
    const wrapRef = useRef<HTMLDivElement>(null)
    const [wrapWidth, setWrapWidth] = useState(0)

    useEffect(() => {
        if (!fillWidth) return
        const el = wrapRef.current
        if (!el) return

        const measure = () => setWrapWidth(el.clientWidth)
        measure()

        const observer = new ResizeObserver(measure)
        observer.observe(el)

        return () => observer.disconnect()
    }, [fillWidth, loading])

    // ── Resolve theme colors ───────────────────────────────────────────────
    const lightColors: ThemeColors =
        typeof theme === "object" ? theme : (THEMES[theme] ?? THEMES.github!)
    const darkColors: ThemeColors =
        typeof theme === "object" ? theme : (DARK_THEMES[theme] ?? DARK_THEMES.github!)

    const activeColors = isDark ? darkColors : lightColors

    // ── Tooltip state ──────────────────────────────────────────────────────
    const [tooltip, setTooltip] = useState<TooltipState>({
        visible: false,
        date: "",
        count: undefined,
        label: undefined,
        x: 0,
        y: 0,
    })

    // ── Build grid ─────────────────────────────────────────────────────────
    const { weeks, monthLabels, gridStart } = useMemo(
        () => buildGrid(resolvedStart, resolvedEnd, startsOnSunday),
        [resolvedStart, resolvedEnd, startsOnSunday]
    )

    // ── Effective cell size ────────────────────────────────────────────────
    const maxCellSize = maxCellSizeProp ?? cellSize * 1.5
    const effectiveCellSize = useMemo(() => {
        if (!fillWidth || wrapWidth === 0) return cellSize
        const available = wrapWidth - 24
        const fitted = Math.floor(
            (available - (weeks.length - 1) * cellGap) / weeks.length
        )
        return Math.max(2, Math.min(fitted, maxCellSize))
    }, [fillWidth, wrapWidth, weeks.length, cellGap, cellSize, maxCellSize])

    // ── Stats ──────────────────────────────────────────────────────────────
    const contributionTotal = useMemo(() => getContributionTotal(filteredData), [filteredData])

    // ── Dimensions ────────────────────────────────────────────────────────
    const step = effectiveCellSize + cellGap
    const monthLabelHeight = showMonthLabels ? 20 : 0
    const svgWidth = weeks.length * step - cellGap
    const svgHeight = monthLabelHeight + 7 * step - cellGap

    // Auto-scroll to the right end (most recent months) — must be before early returns
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
        }
    }, [fetchedData, dataProp])

    // ── Loading / error states ───────────────────────────
    if (loading) {
        return (
            <CalendarSkeleton
                cellSize={cellSize}
                cellGap={cellGap}
                fillWidth={fillWidth}
                maxCellSize={maxCellSize}
                cellShape={cellShape}
                showMonthLabels={showMonthLabels}
                showStats={showStats}
                showLegend={showLegend}
                startsOnSunday={startsOnSunday}
                startDate={startDate}
                endDate={endDate}
                className={className}
            />
        )
    }

    if (fetchError) {
        return (
            <div className={cn("w-fit mx-auto flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive", className)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {fetchError}
            </div>
        )
    }

    const cellRx = cellShape === "circle" ? effectiveCellSize / 2 : effectiveCellSize * 0.2

    return (
        <div ref={wrapRef} className={cn("w-full overflow-x-hidden border rounded-sm", className)}>
            <div className="w-fit mx-auto max-w-full flex flex-col gap-3 p-3">
                <div
                    ref={scrollRef}
                    className="relative overflow-x-auto"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
                >
                    <svg
                        width={svgWidth}
                        height={svgHeight}
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="overflow-visible"
                    >
                        {/* month labels */}
                        {showMonthLabels && (() => {
                            const byWeek = new Map<number, string>()
                            monthLabels.forEach(({ label, weekIndex }) =>
                                byWeek.set(weekIndex, label)
                            )
                            return Array.from(byWeek.entries()).map(([weekIndex, label]) => (
                                <text
                                    key={`${label}-${weekIndex}`}
                                    x={weekIndex * step}
                                    y={10}
                                    fontSize={14}
                                    fill={isDark ? "#fafafa" : "#0a0a0a"}
                                    fontFamily="inherit"
                                >
                                    {label}
                                </text>
                            ))
                        })()}

                        {/* cells */}
                        {weeks.map((week, wi) =>
                            week.map((date, di) => {
                                const entry = date ? filteredData[date] : undefined
                                const level: ContributionLevel = entry?.level ?? 0
                                const cellCenterX = wi * step + cellSize / 2
                                const cellTopY = monthLabelHeight + di * step

                                if (!date) {
                                    const cellDate = formatDate(addDays(parseDate(gridStart), wi * 7 + di))
                                    if (cellDate > resolvedEnd) return null
                                }

                                return (
                                    <rect
                                        key={`${wi}-${di}`}
                                        x={wi * step}
                                        y={cellTopY}
                                        width={effectiveCellSize}
                                        height={effectiveCellSize}
                                        rx={cellRx}
                                        fill={activeColors[`level${level}` as keyof ThemeColors]}
                                        style={{ transition: "opacity 0.1s" }}
                                        onMouseEnter={() => {
                                            if (!date) return
                                            setTooltip({
                                                visible: true,
                                                date,
                                                count: entry?.count,
                                                label: entry?.label,
                                                x: cellCenterX,
                                                y: cellTopY,
                                            })
                                        }}
                                        onMouseLeave={() =>
                                            setTooltip((t) => ({ ...t, visible: false }))
                                        }
                                    />
                                )
                            })
                        )}
                    </svg>

                    {/* tooltip */}
                    {tooltip.visible && (
                        <Tooltip open>
                            <TooltipTrigger
                                render={
                                    <div
                                        className="pointer-events-none absolute z-50"
                                        style={{
                                            left: tooltip.x,
                                            top: tooltip.y,
                                            width: 1,
                                            height: 1,
                                        }}
                                    />
                                }
                            />
                            <TooltipContent side="top">
                                <div className="font-medium">
                                {getContributionLabel(
                                    tooltip.count,
                                    filteredData[tooltip.date]?.level,
                                    tooltip.label
                                )}
                                </div>
                                <div className="text-muted">{formatTooltipDate(tooltip.date)}</div>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>

                <div className="flex items-start justify-between gap-x-4">
                    {/* stats line (left) */}
                    {showStats && (
                        <div className="flex flex-1 flex-wrap gap-x-1 text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{contributionTotal.toLocaleString()}</span>
                            <span>{getContributionSummaryLabel(contributionTotal)}</span>
                        </div>
                    )}

                    {/* legend (right) */}
                    {showLegend && (
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <span>Less</span>
                            {CONTRIBUTION_LEVELS.map((level) => (
                                <svg key={level} width={effectiveCellSize} height={effectiveCellSize}>
                                    <rect
                                        width={effectiveCellSize}
                                        height={effectiveCellSize}
                                        rx={cellRx}
                                        fill={activeColors[`level${level}`]}
                                    />
                                </svg>
                            ))}
                            <span>More</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
})

GithubCalendar.displayName = "GithubCalendar"
