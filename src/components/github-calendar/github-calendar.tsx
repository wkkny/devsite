"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ContributionCalendar } from "./calendar";
import { type ContributionDay, fetchGitHubContributions } from "./data";
import type { GitHubCalendarLabels, GitHubCalendarProps } from "./types";
import { cx, utcDay } from "./utils";

const DEFAULT_LABELS: GitHubCalendarLabels = {
  loading: "Loading GitHub activity…",
  error: "GitHub activity is unavailable right now.",
  retry: "Retry GitHub activity",
  yearPicker: "Contribution year",
  showYear: (year) => `Show ${year} activity`,
};

const YEAR_BUTTON =
  "inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-input bg-transparent px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring aria-pressed:bg-muted";

const NO_DAYS: ContributionDay[] = [];

const utcYear = () => new Date().getUTCFullYear();

/**
 * A drop-in GitHub contributions calendar: one calendar year at a time, Monday-first weeks in
 * UTC, with a year picker, legend, tooltip, keyboard navigation and range selection. Days after
 * today show as disabled squares. `<GitHubCalendar username="octocat" />` is all it needs.
 */
export function GitHubCalendar({
  username,
  fromYear,
  defaultYear,
  color = "var(--primary)",
  unit,
  showYearPicker = "auto",
  showLegend = true,
  showProfileLink = true,
  lazy = true,
  timeoutMs = 10_000,
  fetchContributions = fetchGitHubContributions,
  labels,
  onSelectionChange,
  className,
}: GitHubCalendarProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const firstYear = fromYear ?? utcYear();
  const lastYear = Math.max(firstYear, utcYear());
  const [year, setYear] = useState(() => Math.min(lastYear, Math.max(firstYear, defaultYear ?? lastYear)));
  const [contributionsByKey, setContributionsByKey] = useState<Record<string, ContributionDay[]>>({});
  const [hasEntered, setHasEntered] = useState(() => typeof IntersectionObserver === "undefined");
  const [status, setStatus] = useState<{ key: string; kind: "loading" | "retrying" | "error" } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  // the latest fetcher, so an inline function does not restart the request on every render
  const fetchRef = useRef(fetchContributions);
  useLayoutEffect(() => {
    fetchRef.current = fetchContributions;
  });

  const ready = hasEntered || !lazy;
  const key = `${username}:${year}`;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  // Days after today show as disabled squares, since they have no data yet.
  const today = utcDay(new Date());
  const contributions = contributionsByKey[key];
  const isLoaded = contributions !== undefined;
  const isRetrying = !isLoaded && status?.key === key && status.kind === "retrying";
  const isLoading = isRetrying || (!isLoaded && status?.key === key && status.kind === "loading");
  const hasError = !isLoaded && status?.key === key && status.kind === "error";
  const pickerVisible = showYearPicker === "auto" ? years.length > 1 : showYearPicker;

  // Wait until the calendar is near the viewport before the first request.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || ready) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setHasEntered(true);
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!ready && attempt === 0) return;
    if (isLoaded) return;

    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    async function loadContributions() {
      // Keep a retry marked as one, so only a retried year shows the busy Retry control.
      setStatus((current) => (current?.key === key && current.kind === "retrying" ? current : { key, kind: "loading" }));

      try {
        const days = (await fetchRef.current(username, year, controller.signal)).filter((day) =>
          day.date.startsWith(`${year}-`),
        );
        if (!controller.signal.aborted) {
          // Move focus only if the visitor is still on the retry control that will disappear.
          if (document.activeElement === retryButtonRef.current) {
            sectionRef.current?.querySelector<HTMLButtonElement>('[role="grid"] button[tabindex="0"]')?.focus();
          }
          setContributionsByKey((current) => ({ ...current, [key]: days }));
          setStatus(null);
        }
      } catch {
        if (timedOut || !controller.signal.aborted) setStatus({ key, kind: "error" });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadContributions();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [ready, key, username, year, attempt, isLoaded, timeoutMs]);

  return (
    <div ref={sectionRef} className={cx("w-full", className)} aria-busy={isLoading}>
      {showProfileLink && (
        <a
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          href={`https://github.com/${encodeURIComponent(username)}`}
          target="_blank"
          rel="noreferrer"
        >
          {username}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17 17 7M7 7h10v10" />
          </svg>
        </a>
      )}
      {pickerVisible && (
        <div className="mb-3 flex justify-end">
          <div role="group" aria-label={text.yearPicker} className="flex w-fit items-center gap-2">
            {years.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === year}
                aria-label={text.showYear(option)}
                className={YEAR_BUTTON}
                onClick={() => setYear(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
      <ContributionCalendar
        key={key}
        days={contributions ?? NO_DAYS}
        start={yearStart}
        end={yearEnd}
        activeUntil={today}
        unit={unit}
        color={color}
        showLegend={showLegend}
        onSelectionChange={onSelectionChange}
      />
      {isLoading && <p role="status" className="mt-3 text-sm text-muted-foreground">{text.loading}</p>}
      {hasError && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {text.error}
        </p>
      )}
      {(hasError || isRetrying) && (
        <button
          ref={retryButtonRef}
          type="button"
          aria-disabled={isLoading}
          className="mt-2 rounded text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-50"
          onClick={() => {
            if (isLoading) return;
            setStatus({ key, kind: "retrying" });
            setAttempt((current) => current + 1);
          }}
        >
          {text.retry}
        </button>
      )}
    </div>
  );
}
