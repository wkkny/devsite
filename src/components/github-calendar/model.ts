import type { CalendarDay } from "./types";
import { addDays, DAY_MS, formatMonth, isoDate, mondayOf, utcDay } from "./utils";

/**
 * The calendar as plain data, so layout, keyboard movement and range totals can be tested
 * without rendering. Cells are numbered week by week from the first Monday:
 * `index = week * 7 + weekday`, with Monday as weekday 0.
 */

/** `outside` is blank (before `start` or after `end`), `disabled` has no data yet, `active` is a real day. */
export type CellState = "outside" | "disabled" | "active";

export interface Cell {
  index: number;
  week: number;
  weekday: number;
  date: Date;
  iso: string;
  state: CellState;
  count: number;
  /** 0 to 4. */
  level: number;
}

export interface CalendarModel {
  weeks: number;
  cells: Cell[];
  /** A label for each week where a new month starts, thinned so labels never collide. */
  months: { week: number; month: number; label: string }[];
  /** First and last active cell, or -1 when there are none. */
  firstActive: number;
  lastActive: number;
  /** Where keyboard focus enters: today when it is active, otherwise the last active day. */
  entry: number;
  /** The last active date, for "Jan 1 – Oct 7" style summaries. */
  lastActiveDate: Date;
}

/** Labels closer than this many weeks would overlap, so the earlier one is dropped. */
const MIN_LABEL_GAP = 3;

/** Shade for a day without a GitHub-style level: quarters of the busiest day, at least 1 if non-zero. */
export function levelFromCount(count: number, max: number) {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

export function buildCalendar({
  start,
  end,
  activeUntil,
  today = new Date(),
  days,
}: {
  start: Date;
  end: Date;
  activeUntil?: Date;
  today?: Date;
  days: readonly CalendarDay[];
}): CalendarModel {
  const firstDay = utcDay(start);
  const lastDay = utcDay(end);
  const lastDataDay = activeUntil && utcDay(activeUntil) < lastDay ? utcDay(activeUntil) : lastDay;
  const gridStart = mondayOf(firstDay);
  const weeks = Math.max(1, Math.floor((lastDay.getTime() - gridStart.getTime()) / DAY_MS / 7) + 1);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const busiest = days.reduce((max, day) => Math.max(max, day.count), 0);

  const cells: Cell[] = [];
  let firstActive = -1;
  let lastActive = -1;
  for (let index = 0; index < weeks * 7; index++) {
    const date = addDays(gridStart, index);
    const iso = isoDate(date);
    const state: CellState =
      date < firstDay || date > lastDay ? "outside" : date > lastDataDay ? "disabled" : "active";
    const day = state === "active" ? byDate.get(iso) : undefined;
    const count = day?.count ?? 0;
    if (state === "active") {
      if (firstActive === -1) firstActive = index;
      lastActive = index;
    }
    cells.push({
      index,
      week: Math.floor(index / 7),
      weekday: index % 7,
      date,
      iso,
      state,
      count,
      level: state === "active" ? Math.min(4, Math.max(0, day?.level ?? levelFromCount(count, busiest))) : 0,
    });
  }

  // A week is named after the month of its first day inside the grid's range.
  const months: { week: number; month: number; label: string }[] = [];
  let previousMonth = -1;
  for (let week = 0; week < weeks; week++) {
    const first = cells.slice(week * 7, week * 7 + 7).find((cell) => cell.state !== "outside");
    if (!first) continue;
    const month = first.date.getUTCMonth();
    if (month !== previousMonth) months.push({ week, month, label: formatMonth.format(first.date) });
    previousMonth = month;
  }
  const spacedMonths = months.filter((label, i) => {
    const next = months[i + 1];
    return !next || next.week - label.week >= MIN_LABEL_GAP;
  });

  const todayIndex = Math.round((utcDay(today).getTime() - gridStart.getTime()) / DAY_MS);
  const entry = cells[todayIndex]?.state === "active" ? todayIndex : lastActive;

  return {
    weeks,
    cells,
    months: spacedMonths,
    firstActive,
    lastActive,
    entry,
    lastActiveDate: lastActive === -1 ? lastDataDay : cells[lastActive].date,
  };
}

/**
 * Where a key moves focus from cell `index`, or null for keys the grid does not handle.
 * Moves that would land on a blank or disabled day stay put rather than skipping or wrapping.
 */
export function moveFocus(model: CalendarModel, index: number, key: string, ctrlKey = false): number | null {
  const { cells, weeks } = model;
  const cell = cells[index];
  if (!cell) return null;
  const active = (i: number) => cells[i]?.state === "active";

  switch (key) {
    case "ArrowUp":
      return cell.weekday > 0 && active(index - 1) ? index - 1 : index;
    case "ArrowDown":
      return cell.weekday < 6 && active(index + 1) ? index + 1 : index;
    case "ArrowLeft":
      return active(index - 7) ? index - 7 : index;
    case "ArrowRight":
      return active(index + 7) ? index + 7 : index;
    case "Home":
      if (ctrlKey) return model.firstActive;
      // the first active day in this row
      for (let i = cell.weekday; i < index; i += 7) if (active(i)) return i;
      return index;
    case "End":
      if (ctrlKey) return model.lastActive;
      for (let i = (weeks - 1) * 7 + cell.weekday; i > index; i -= 7) if (active(i)) return i;
      return index;
    default:
      return null;
  }
}

/** Sum and number of active days from `a` to `b`, in either order. */
export function rangeTotal(model: CalendarModel, a: number, b: number) {
  let total = 0;
  let days = 0;
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
    const cell = model.cells[i];
    if (cell?.state !== "active") continue;
    total += cell.count;
    days++;
  }
  return { total, days };
}
