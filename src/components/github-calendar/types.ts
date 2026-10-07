import type { ReactNode } from "react";
import type { FetchContributions } from "./data";

export type HeatCalendarCell = { w: number; d: number };

export interface HeatCalendarSelection {
  start: HeatCalendarCell;
  end?: HeatCalendarCell;
}

export interface HeatCalendarProps {
  /** Noun after every count, e.g. "commits", "ships". */
  unit?: string;
  /** Number of week columns. */
  weeks?: number;
  /** Count a cell at intensity 1 stands for; a cell reads `intensity × maxCount`. */
  maxCount?: number;
  /** `values[week][day]` intensities in 0..1, seven days per week. Missing values are zero. */
  values?: number[][];
  /** Exact counts for each cell, indexed by week then Monday-first day. */
  counts?: number[][];
  /** Last UTC calendar day of the grid. Defaults to today after mount; explicit dates render identically in every timezone. */
  endDate?: Date;
  /** First UTC calendar day shown. The grid opens on the week containing it, and earlier days in that week are hidden. Without it the grid is the `weeks` ending at `endDate`. */
  startDate?: Date;
  /** Last day with data. Later days inside the grid render as inert, disabled squares. */
  activeUntil?: Date;
  /** The single hue. Any CSS color; magnitude maps to its strength, never to a second color. */
  color?: string;
  className?: string;
  children?: ReactNode;
  /** Controlled selection; null clears it. Cell coordinates are zero-based week/day (Monday first). */
  selection?: HeatCalendarSelection | null;
  defaultSelection?: HeatCalendarSelection | null;
  onSelectionChange?: (selection: HeatCalendarSelection | null) => void;
}

/** Every piece of text GitHubCalendar shows or announces. */
export interface GitHubCalendarLabels {
  loading: string;
  error: string;
  retry: string;
  /** Accessible name of the year picker. */
  yearPicker: string;
  /** Accessible name of each year button. */
  showYear: (year: number) => string;
}

export interface GitHubCalendarProps {
  /** GitHub username whose public contributions are shown. */
  username: string;
  /** Earliest year in the year picker. Defaults to the current year. */
  fromYear?: number;
  /** Year shown first. Defaults to the current year. */
  defaultYear?: number;
  /** The single hue of the squares. Any CSS color. */
  color?: string;
  /** Noun after every count. */
  unit?: string;
  /** `"auto"` shows the picker only when there is more than one year. */
  showYearPicker?: boolean | "auto";
  showLegend?: boolean;
  /** A link to the GitHub profile above the calendar. */
  showProfileLink?: boolean;
  /** Wait until the calendar is near the viewport before the first request. */
  lazy?: boolean;
  /** Abort a request after this many milliseconds and offer a retry. */
  timeoutMs?: number;
  /** Replace the data source, e.g. with your own API route. Defaults to `fetchGitHubContributions`. */
  fetchContributions?: FetchContributions;
  labels?: Partial<GitHubCalendarLabels>;
  onSelectionChange?: (selection: HeatCalendarSelection | null) => void;
  className?: string;
}
