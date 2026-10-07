export const DAY_MS = 86_400_000;

/** Joins class names, skipping falsy parts. */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Midnight UTC of the UTC calendar day `date` falls on. Every date in the calendar is one of these. */
export function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** UTC has no daylight-saving shifts, so whole days are exact multiples of DAY_MS. */
export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** The Monday on or before `date`. Calendar columns run Monday to Sunday. */
export function mondayOf(date: Date) {
  const day = utcDay(date);
  return addDays(day, -((day.getUTCDay() + 6) % 7));
}

/** `YYYY-MM-DD`, the key days are matched on. */
export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export const formatDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export const formatDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

export const formatMonth = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });
