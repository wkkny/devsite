# GitHubCalendar

A drop-in GitHub contributions calendar for React. It shows one calendar year at a time,
with a year picker, legend, tooltip, keyboard navigation and range selection. Days after
today render as disabled squares.

```tsx
import { GitHubCalendar } from "@/components/github-calendar";

<GitHubCalendar username="octocat" />;
```

## Copying it into another project

Copy this whole folder. It imports nothing from the rest of this site.

It needs:

- React 19 and `react-dom`
- [`motion`](https://motion.dev) (`motion/react`)
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
| `unit` | `"contributions"` | Noun after every count |
| `showYearPicker` | `"auto"` | `"auto"` shows it only when there is more than one year |
| `showLegend` | `true` | Date range and the less/more scale under the grid |
| `showProfileLink` | `true` | A link to the GitHub profile above the calendar |
| `lazy` | `true` | Wait until the calendar is within 200px of the viewport before fetching |
| `timeoutMs` | `10000` | Abort a request after this long and offer a retry |
| `fetchContributions` | `fetchGitHubContributions` | Replace the data source |
| `labels` | English | Override any of `loading`, `error`, `retry`, `yearPicker`, `showYear(year)` |
| `onSelectionChange` | | Called when a day or range is selected or cleared |
| `className` | | Classes on the outer element |

## Behaviour

- Weeks run Monday to Sunday, and all dates are calendar days in UTC.
- Click or press Enter on a day to pin it. Pick a second day to total the range, and press
  Escape to clear it.
- The grid is a single tab stop. Arrow keys move between days, Home and End move along the
  row, and Control+Home or Control+End jump to the first or latest day.
- Below 640px the grid scrolls sideways and opens at the current week.
- With `prefers-reduced-motion`, the entrance wave and hover lift are turned off.

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

## Lower-level parts

`HeatCalendar` is the data-agnostic grid underneath. Use it for any per-day metric. Pass
`values` (0 to 1) and `counts` indexed `[week][day]`, then compose `HeatCalendarGrid`,
`HeatCalendarTooltip` and `HeatCalendarLegend` as children. Custom parts can read the
shared state with `useHeatCalendar()`. See `types.ts` for every prop.
