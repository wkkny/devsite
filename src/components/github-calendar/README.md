# GitHubCalendar

A drop-in GitHub contributions calendar for React. It shows one calendar year at a time,
with a year picker, legend, tooltip, keyboard navigation and range totals. Days after
today show as disabled squares.

```tsx
import { GitHubCalendar } from "@/components/github-calendar";

<GitHubCalendar username="octocat" />;
```

## Copying it into another project

Copy this whole folder. It imports nothing from the rest of this site, and needs only:

- React 19 and `react-dom`
- Tailwind CSS v4 with the shadcn/ui colour tokens: `background`, `foreground`, `muted`,
  `muted-foreground`, `border`, `input`, `ring` and `primary`, plus `--radius-md`

Without shadcn, define those CSS variables yourself or pass `color` explicitly.

## `GitHubCalendar` props

| Prop | Default | |
|---|---|---|
| `username` | required | GitHub user whose public contributions are shown |
| `fromYear` | current year | Earliest year in the year picker |
| `defaultYear` | current year | Year shown first |
| `color` | `var(--primary)` | The single hue of the squares; any CSS colour |
| `unit` | contribution / contributions | Noun after each count: a string, or `{ one, other }` |
| `showYearPicker` | `"auto"` | `"auto"` shows it only when there is more than one year |
| `showLegend` | `true` | Date range and the less/more scale under the grid |
| `showProfileLink` | `true` | A link to the GitHub profile above the calendar |
| `lazy` | `true` | Wait until the calendar is within 200px of the viewport before fetching |
| `timeoutMs` | `10000` | Abort a request after this long and offer a retry |
| `fetchContributions` | `fetchGitHubContributions` | Replace the data source |
| `labels` | English | Override any of `loading`, `error`, `retry`, `yearPicker`, `showYear(year)` |
| `onSelectionChange` | | Called with `{ start, end? }` dates (`YYYY-MM-DD`), or `null` when cleared |
| `className` | | Classes on the outer element |

## Using it

- **Read a day.** Hover or focus a square for its count and date.
- **Total a range.** Click a day, and the tooltip previews the total up to wherever you
  point. Click a second day to keep that range on screen. Clicking again starts a new
  selection, and clicking outside the calendar or pressing Escape clears it. Completed
  totals are announced to screen readers; day buttons include their count and date.
- **Filter by level.** Hover or focus a shade in the legend to see only days at that
  level. Click it to keep the filter on.
- **Keyboard.** The grid is a single Tab stop that starts on today. Arrow keys move by
  day and week, Home and End move along the row, and Control+Home or Control+End jump to
  the first or latest day. Moves never wrap or land on a blank or disabled square.
- **Narrow screens.** When the year doesn't fit, the grid scrolls sideways and opens with
  today in view. Squares never shrink below 12px.
- **Tooltips.** The visual readout stays open while hovered and Escape dismisses it.
- **Reduced motion.** The pop-in, hover lift, and tooltip transforms are turned off.

Weeks run Monday to Sunday, and all dates are calendar days in UTC.

## Data source

By default the data comes from the public, keyless
[github-contributions-api.jogruber.de](https://github-contributions-api.jogruber.de/).
To use your own backend, pass a function that resolves to `{ date, count, level }` days,
where `level` runs from 0 to 4. It must reject on failure and stop when `signal` aborts.

```tsx
import { GitHubCalendar, parseContributions } from "@/components/github-calendar";

<GitHubCalendar
  username="octocat"
  fetchContributions={async (username, year, signal) => {
    const response = await fetch(`/api/contributions?user=${username}&year=${year}`, { signal });
    if (!response.ok) throw new Error("Request failed");
    return parseContributions(await response.json());
  }}
/>
```

## Any other per-day data

`ContributionCalendar` is the grid underneath, for any metric you can count per day:

```tsx
import { ContributionCalendar } from "@/components/github-calendar";

<ContributionCalendar
  days={[{ date: "2026-09-23", count: 4 }, { date: "2026-09-24", count: 1 }]}
  start={new Date("2026-01-01")}
  end={new Date("2026-12-31")}
  activeUntil={new Date()}
  unit={{ one: "workout", other: "workouts" }}
/>;
```

Without a `level` on each day, shades are quarters of the busiest day. Keep `days` the
same array between renders (state or `useMemo`), since a new array rebuilds the grid.

## How it is organised

| File | |
|---|---|
| `github-calendar.tsx` | Fetching, the year picker, loading, errors and retry |
| `calendar.tsx` | `ContributionCalendar`: rendering, pointer and keyboard handling, legend |
| `model.ts` | The calendar as plain data: layout, keyboard moves and range totals. Unit-tested |
| `tooltip.tsx` | The readout above a square, kept inside the viewport |
| `data.ts` | The default data source and response validation |
| `utils.ts`, `types.ts` | UTC date helpers and the public types |
