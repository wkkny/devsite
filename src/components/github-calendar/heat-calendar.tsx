"use client";
// beui.dev/charts/heat-calendar

import { HeatCalendarContext, useHeatCalendarModel } from "./context";
import { HeatCalendarGrid } from "./grid";
import { HeatCalendarLegend } from "./legend";
import { HeatCalendarTooltip } from "./tooltip";
import type { HeatCalendarProps } from "./types";
import { cx } from "./utils";

/**
 * The data-agnostic grid: pass `values` and `counts` per week and day. Compose Grid, Tooltip
 * and Legend as children, or omit children for the complete chart. `className` replaces the
 * default `w-fit` width.
 */
export function HeatCalendar({ children, className, ...props }: HeatCalendarProps) {
  const model = useHeatCalendarModel(props);
  return (
    <HeatCalendarContext.Provider value={model}>
      <div className={cx("max-w-full", className ?? "w-fit")}>
        {children === undefined ? (
          <>
            <HeatCalendarGrid>
              <HeatCalendarTooltip />
            </HeatCalendarGrid>
            <HeatCalendarLegend />
          </>
        ) : (
          children
        )}
      </div>
    </HeatCalendarContext.Provider>
  );
}

export { useHeatCalendar } from "./context";
export { HeatCalendarGrid } from "./grid";
export { HeatCalendarLegend } from "./legend";
export { HeatCalendarTooltip } from "./tooltip";
