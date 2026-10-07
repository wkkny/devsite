"use client";

import { type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildCalendar, type Cell, moveFocus, rangeTotal } from "./model";
import { CalendarTooltip } from "./tooltip";
import type { CalendarSelection, CalendarUnit, ContributionCalendarProps } from "./types";
import { cx, formatDate, formatDay } from "./utils";

const LEVELS = [0, 1, 2, 3, 4];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
/** How much of `color` each level mixes in. Level 0 uses a faint neutral instead. */
const LEVEL_STRENGTH = [0, 28, 50, 74, 100];
const EMPTY_FILL = "color-mix(in srgb, var(--foreground) 6%, transparent)";
const DISABLED_FILL = "color-mix(in srgb, var(--foreground) 2%, transparent)";
const DISABLED_EDGE = "inset 0 0 0 1px color-mix(in srgb, var(--foreground) 7%, transparent)";
const GAP_PX = 2;
/** Below this square size the grid scrolls sideways instead of shrinking further. */
const MIN_SQUARE_PX = 12;
const DEFAULT_UNIT = { one: "contribution", other: "contributions" };
const plural = new Intl.PluralRules("en-US");

function unitFor(unit: CalendarUnit, count: number) {
  if (typeof unit === "string") return unit;
  return plural.select(count) === "one" ? unit.one : unit.other;
}

function fill(level: number, color: string) {
  return level === 0 ? EMPTY_FILL : `color-mix(in srgb, ${color} ${LEVEL_STRENGTH[level]}%, transparent)`;
}

/** Selected cell indexes. `end` is the second day picked, which may come before `start`. */
type Selection = { start: number; end?: number } | null;

/**
 * A year-style activity grid for any per-day metric: weeks as columns, Monday to Sunday as
 * rows. Hover or focus a day for its count; pick two days for the total between them; hover
 * a legend shade to see only days at that level.
 */
export function ContributionCalendar({
  days,
  start,
  end,
  activeUntil,
  unit = DEFAULT_UNIT,
  color = "var(--primary)",
  showLegend = true,
  onSelectionChange,
  className,
}: ContributionCalendarProps) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const activeTime = activeUntil?.getTime();
  const model = useMemo(
    () =>
      buildCalendar({
        start: new Date(startTime),
        end: new Date(endTime),
        activeUntil: activeTime === undefined ? undefined : new Date(activeTime),
        days,
      }),
    [startTime, endTime, activeTime, days],
  );

  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [legendPreview, setLegendPreview] = useState<number | null>(null);
  const [legendLock, setLegendLock] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [dismissed, setDismissed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const hideTimer = useRef<number | undefined>(undefined);
  const helpId = useId();

  const isActive = (index: number | null | undefined): index is number =>
    index != null && model.cells[index]?.state === "active";
  const tabStop = isActive(focusIndex) ? focusIndex : model.entry;
  const filterLevel = legendPreview ?? legendLock;

  // A picked day previews the range to the hovered day; a second pick locks the range.
  const spanEnd = selection?.end ?? (selection && hover !== selection.start ? hover : null);
  const span = selection && spanEnd !== null ? [Math.min(selection.start, spanEnd), Math.max(selection.start, spanEnd)] : null;
  // A locked range keeps the tooltip on its end; otherwise it follows the pointer or focus.
  const tip = selection?.end ?? hover ?? selection?.start ?? null;
  const tipCell = !dismissed && isActive(tip) ? model.cells[tip] : null;
  const range = span ? rangeTotal(model, span[0], span[1]) : null;

  const choose = (next: Selection) => {
    setSelection(next);
    setDismissed(false);
    if (!next) setAnnouncement("Selection cleared.");
    else if (next.end === undefined) {
      setAnnouncement(`${formatDay.format(model.cells[next.start].date)} selected. Select a second day to total the range.`);
    } else {
      const total = rangeTotal(model, next.start, next.end);
      setAnnouncement(`${total.total} ${unitFor(unit, total.total)} from ${formatDay.format(model.cells[Math.min(next.start, next.end)].date)} to ${formatDay.format(model.cells[Math.max(next.start, next.end)].date)}, ${total.days} days.`);
    }
    if (!onSelectionChange) return;
    if (!next) return onSelectionChange(null);
    const result: CalendarSelection =
      next.end === undefined
        ? { start: model.cells[next.start].iso }
        : {
            start: model.cells[Math.min(next.start, next.end)].iso,
            end: model.cells[Math.max(next.start, next.end)].iso,
          };
    onSelectionChange(result);
  };

  const pick = (index: number) => {
    if (!selection || selection.end !== undefined) choose({ start: index });
    else if (selection.start === index) choose(null);
    else choose({ start: selection.start, end: index });
  };

  const keepTooltip = () => window.clearTimeout(hideTimer.current);
  const leaveTooltip = () => {
    keepTooltip();
    hideTimer.current = window.setTimeout(() => {
      // Pointer exit must not hide a readout for a keyboard-focused square.
      setHover(cellIndex(document.activeElement));
    }, 150);
  };

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDismissed(true);
      setHover(null);
      if (selection) {
        setSelection(null);
        setAnnouncement("Selection cleared.");
        onSelectionChange?.(null);
      }
      setLegendLock(null);
      setLegendPreview(null);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [selection, onSelectionChange]);

  const cellIndex = (target: EventTarget | null) => {
    const element = target instanceof Element ? target.closest<HTMLElement>("[data-index]") : null;
    return element ? Number(element.dataset.index) : null;
  };

  const getAnchor = useCallback(
    () => (tip === null ? null : (gridRef.current?.querySelector<HTMLElement>(`[data-index="${tip}"]`) ?? null)),
    [tip],
  );

  // A press anywhere outside the calendar drops the selection and a locked legend filter.
  useEffect(() => {
    if (!selection && legendLock === null) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && (rootRef.current?.contains(event.target) || document.getElementById(tooltipId)?.contains(event.target))) return;
      setSelection(null);
      if (selection) setAnnouncement("Selection cleared.");
      onSelectionChange?.(null);
      setLegendLock(null);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [selection, legendLock, onSelectionChange, tooltipId]);

  // Squares pop in week by week when a new range mounts. Data arriving later does not replay it.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations = Array.from(grid.querySelectorAll<HTMLElement>("[data-square]"), (square) =>
      square.animate([{ opacity: 0, transform: "scale(0.4)" }, { opacity: 1, transform: "none" }], {
        duration: 420,
        delay: Number(square.dataset.week) * 9 + Number(square.dataset.weekday) * 14,
        easing: "cubic-bezier(0.34, 1.4, 0.64, 1)",
        fill: "backwards",
      }),
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, [startTime, endTime]);

  // When the grid is wider than its container, open it scrolled to the entry day (usually today).
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const grid = gridRef.current;
    if (!scroller || !grid) return;
    const reveal = () => {
      if (scroller.scrollWidth <= scroller.clientWidth) return;
      const square = grid.querySelector<HTMLElement>(`[data-index="${model.entry}"]`);
      if (!square) return;
      const right = square.getBoundingClientRect().right - grid.getBoundingClientRect().left;
      scroller.scrollLeft = right - scroller.clientWidth + 16;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [model.entry]);

  const hotMonth = tipCell?.date.getUTCMonth() ?? null;

  const renderCell = (cell: Cell) => {
    if (cell.state === "outside") return null;
    const place: CSSProperties = { gridColumn: cell.week + 1, gridRow: cell.weekday + 2 };
    const timing = { "data-week": cell.week, "data-weekday": cell.weekday, "data-square": "" };

    if (cell.state === "disabled") {
      // No data yet: drawn so the year reads whole, but inert and hidden from assistive tech.
      return (
        <span
          key={cell.iso}
          aria-hidden="true"
          data-disabled={cell.iso}
          {...timing}
          className="aspect-square w-full cursor-not-allowed rounded-[3px]"
          style={{ ...place, background: DISABLED_FILL, boxShadow: DISABLED_EDGE }}
        />
      );
    }

    const selected = selection !== null && (cell.index === selection.start || cell.index === selection.end);
    const dimmed =
      (filterLevel !== null && cell.level !== filterLevel) ||
      (span !== null && (cell.index < span[0] || cell.index > span[1]));
    return (
      <span key={cell.iso} role="gridcell" aria-colindex={cell.week + 1} className="relative" style={place}>
        <button
          type="button"
          data-index={cell.index}
          data-date={cell.iso}
          {...timing}
          tabIndex={cell.index === tabStop ? 0 : -1}
          aria-label={`${cell.count} ${unitFor(unit, cell.count)} on ${formatDay.format(cell.date)}`}
          aria-pressed={selected}
          className={cx(
            "block aspect-square w-full rounded-[3px] transition-[scale,opacity] duration-150 ease-out outline-none",
            "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground focus-visible:relative focus-visible:z-10",
            "hover:relative hover:z-10 motion-safe:pointer-fine:hover:scale-125",
            selected && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
            dimmed && "opacity-25 focus-visible:opacity-100",
          )}
          style={{ background: fill(cell.level, color) }}
        />
      </span>
    );
  };

  return (
    <div ref={rootRef} className={cx("w-full", className)}>
      <span id={helpId} className="sr-only">
        Arrow keys move by day and week. Home and End move along the row, or with Control to the first
        and latest day. Enter selects a day; selecting a second day totals the range. Escape clears.
      </span>
      <div
        ref={scrollerRef}
        className="-m-1 w-[calc(100%+8px)] overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1"
      >
        <div
          ref={gridRef}
          role="grid"
          aria-label={`${unitFor(unit, 2)} calendar`}
          aria-rowcount={7}
          aria-colcount={model.weeks}
          aria-describedby={helpId}
          className="grid w-full min-w-(--calendar-min-width) sm:min-w-0"
          style={
            {
              gridTemplateColumns: `repeat(${model.weeks}, minmax(0, 1fr))`,
              gap: GAP_PX,
              "--calendar-min-width": `${model.weeks * (MIN_SQUARE_PX + GAP_PX)}px`,
            } as CSSProperties
          }
          onPointerOver={(event) => {
            const index = cellIndex(event.target);
            keepTooltip();
            if (index !== null) {
              if (index !== hover) setDismissed(false);
              setHover(index);
            }
            else if (event.target instanceof Element && event.target.closest("[data-disabled]")) setHover(null);
          }}
          onPointerLeave={leaveTooltip}
          onFocus={(event) => {
            const index = cellIndex(event.target);
            if (index === null) return;
            keepTooltip();
            setDismissed(false);
            setFocusIndex(index);
            setHover(index);
          }}
          onBlur={(event) => {
            if (!(event.relatedTarget instanceof Node && gridRef.current?.contains(event.relatedTarget))) setHover(null);
          }}
          onClick={(event) => {
            const index = cellIndex(event.target);
            if (index !== null) pick(index);
          }}
          onKeyDown={(event) => {
            const from = cellIndex(event.target);
            const next = from === null ? null : moveFocus(model, from, event.key, event.ctrlKey || event.metaKey);
            if (next === null) return;
            event.preventDefault();
            gridRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus();
          }}
        >
          {model.months.map(({ week, month, label }) => (
            <span
              key={week}
              aria-hidden="true"
              className={cx(
                "whitespace-nowrap pb-1 text-[10px] leading-none transition-colors duration-200",
                hotMonth === month ? "text-foreground" : "text-muted-foreground",
              )}
              style={{ gridColumn: week + 1, gridRow: 1 }}
            >
              {label}
            </span>
          ))}
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} role="row" aria-rowindex={weekday + 1} className="contents">
              {Array.from({ length: model.weeks }, (_, week) => renderCell(model.cells[week * 7 + weekday]))}
            </div>
          ))}
        </div>
      </div>

      {showLegend && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {model.firstActive === -1
              ? " "
              : `${formatDate.format(model.cells[model.firstActive].date)} – ${formatDate.format(model.lastActiveDate)}`}
          </span>
          <span className="flex items-center" onPointerLeave={() => setLegendPreview(null)}>
            <span className="mr-0.5">less</span>
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-label={`Show only level ${level} days`}
                aria-pressed={legendLock === level}
                data-active={filterLevel === level ? "" : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setLegendPreview(level);
                }}
                onFocus={() => setLegendPreview(level)}
                onBlur={() => setLegendPreview(null)}
                onClick={() => setLegendLock((current) => (current === level ? null : level))}
                className="group/level flex size-6 items-center justify-center rounded outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground"
              >
                <span aria-hidden="true" className="size-3 rounded-[3px] transition-[scale] duration-150 motion-safe:group-data-active/level:scale-125" style={{ background: fill(level, color) }} />
              </button>
            ))}
            <span className="ml-0.5">more</span>
          </span>
        </div>
      )}

      <span role="status" className="sr-only">{announcement}</span>

      <CalendarTooltip onPointerEnter={keepTooltip} onPointerLeave={leaveTooltip} id={tooltipId} open={tipCell !== null} anchorKey={tip} getAnchor={getAnchor}>
        {range && range.days > 1 ? (
          <>
            <span className="font-mono tabular-nums">
              {range.total} {unitFor(unit, range.total)}
            </span>
            <span className="text-muted-foreground">
              {formatDate.format(model.cells[span![0]].date)} – {formatDate.format(model.cells[span![1]].date)}
            </span>
            <span className="text-muted-foreground">{range.days} days</span>
          </>
        ) : tipCell ? (
          <>
            <span className="font-mono tabular-nums">
              {tipCell.count} {unitFor(unit, tipCell.count)}
            </span>
            <span className="text-muted-foreground">{formatDay.format(tipCell.date)}</span>
          </>
        ) : null}
      </CalendarTooltip>
    </div>
  );
}
