import type { FetchContributions } from "./data";

/** One day of activity. `level` (0 to 4) is optional; without it the shade follows `count`. */
export interface CalendarDay {
  date: string;
  count: number;
  level?: number;
}

/** A selected day, or a range when `end` is set. Dates are `YYYY-MM-DD`, `start` before `end`. */
export interface CalendarSelection {
  start: string;
  end?: string;
}

/** The noun after each count: one word, or singular and plural forms. */
export type CalendarUnit = string | { one: string; other: string };

export interface ContributionCalendarProps {
  /** Activity by date. Days that are missing count as zero. */
  days: readonly CalendarDay[];
  /** First day shown. The grid starts on the Monday of its week; earlier days are left blank. */
  start: Date;
  /** Last day of the grid. Later days in its week are left blank. */
  end: Date;
  /** Last day with data. Days after it, up to `end`, show as disabled squares. */
  activeUntil?: Date;
  /** Defaults to "contribution" and "contributions". */
  unit?: CalendarUnit;
  /** The single hue of the squares. Any CSS color. */
  color?: string;
  showLegend?: boolean;
  onSelectionChange?: (selection: CalendarSelection | null) => void;
  className?: string;
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
  unit?: CalendarUnit;
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
  onSelectionChange?: (selection: CalendarSelection | null) => void;
  className?: string;
}
