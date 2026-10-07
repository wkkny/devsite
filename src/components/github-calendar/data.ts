/** One day from the contributions API. `level` is GitHub's 0 to 4 shade. */
export type ContributionDay = {
  date: string;
  count: number;
  level: number;
};

/** Loads one calendar year of contributions. Must reject on failure and honour `signal`. */
export type FetchContributions = (username: string, year: number, signal: AbortSignal) => Promise<ContributionDay[]>;

function isContributionDay(value: unknown): value is ContributionDay {
  if (typeof value !== "object" || value === null) return false;

  const day = value as Record<string, unknown>;

  return (
    typeof day.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    typeof day.count === "number" &&
    Number.isInteger(day.count) &&
    day.count >= 0 &&
    typeof day.level === "number" &&
    Number.isInteger(day.level) &&
    day.level >= 0 &&
    day.level <= 4
  );
}

/** Validates a `{ contributions: ContributionDay[] }` payload and returns its days. */
export function parseContributions(data: unknown): ContributionDay[] {
  if (typeof data !== "object" || data === null || !("contributions" in data)) {
    throw new Error("Invalid GitHub contributions response");
  }

  const contributions = data.contributions;

  if (!Array.isArray(contributions) || !contributions.every(isContributionDay)) {
    throw new Error("Invalid GitHub contributions response");
  }

  return contributions;
}

/** The default source: the public, keyless github-contributions-api.jogruber.de. */
export const fetchGitHubContributions: FetchContributions = async (username, year, signal) => {
  const response = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=${year}`,
    { signal },
  );
  if (!response.ok) throw new Error("Unable to fetch GitHub contributions");
  return parseContributions(await response.json());
};
