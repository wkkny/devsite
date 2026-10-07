"use client";

import { motion, type Variants } from "motion/react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHeatCalendar } from "./context";
import type { HeatCalendarCell } from "./types";
import { cx, EASE_OUT, fmtDay, fmtRange } from "./utils";

/** Space between the tooltip and its cell, and between the tooltip and the viewport edge. */
const OFFSET = 8;

const VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.9, filter: "blur(5px)", y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    y: 0,
    transition: {
      type: "spring",
      stiffness: 380,
      damping: 30,
      mass: 0.7,
      opacity: { duration: 0.14, ease: EASE_OUT },
      filter: { duration: 0.18, ease: EASE_OUT },
    },
  },
  exit: { opacity: 0, scale: 0.94, filter: "blur(3px)", y: 4.8, transition: { duration: 0.12, ease: EASE_OUT } },
};

const REDUCED_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.14, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } },
};

type TooltipData = NonNullable<ReturnType<typeof useHeatCalendar>["tooltip"]>;

/**
 * The readout above the hovered, focused or pinned cell. It is portalled and fixed-positioned,
 * so it escapes any scrolling or clipping container around the grid.
 */
export function HeatCalendarTooltip({
  children,
  className,
}: {
  children?: ReactNode | ((data: TooltipData) => ReactNode);
  className?: string;
}) {
  const { gridRef, tooltipId, tip, tooltip, unit, reduce } = useHeatCalendar();
  const [dismissed, setDismissed] = useState<HeatCalendarCell | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const open = tooltip !== null && tip !== null && dismissed !== tip;

  const anchor = useCallback(
    () => (tip ? (gridRef.current?.querySelector<HTMLElement>(`[data-heat-cell="${tip.w}-${tip.d}"]`) ?? null) : null),
    [gridRef, tip],
  );

  const place = useCallback(() => {
    const cell = anchor();
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    const width = surfaceRef.current?.offsetWidth ?? 0;
    const height = surfaceRef.current?.offsetHeight ?? 0;
    const left = Math.max(OFFSET + width / 2, Math.min(rect.left + rect.width / 2, window.innerWidth - OFFSET - width / 2));
    const top = Math.max(OFFSET + height, rect.top - OFFSET);
    setCoords((previous) => (previous?.top === top && previous.left === left ? previous : { top, left }));
  }, [anchor]);

  // Follow the cell while open: its own size, the tooltip's size, scrolling and resizing.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const observer = new ResizeObserver(place);
    const cell = anchor();
    if (cell) observer.observe(cell);
    if (surfaceRef.current) observer.observe(surfaceRef.current);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place, anchor]);

  // Escape or a press outside the cell closes it; a touch user has no pointer to move away.
  useEffect(() => {
    if (!open) return;
    const close = () => setDismissed(tip);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !anchor()?.contains(event.target)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, tip, anchor]);

  if (typeof document === "undefined") return null;

  const content =
    tooltip &&
    (typeof children === "function"
      ? children(tooltip)
      : (children ?? (
          <>
            <span className="font-mono tabular-nums">
              {tooltip.days > 1 ? tooltip.total : tooltip.count} {unit}
            </span>
            <span className="text-muted-foreground">
              {tooltip.days > 1
                ? `${fmtRange.format(tooltip.startDate)} – ${fmtRange.format(tooltip.endDate)}`
                : fmtDay.format(tooltip.date)}
            </span>
            {tooltip.days > 1 ? <span className="text-muted-foreground">{tooltip.days} days</span> : null}
          </>
        )));

  return createPortal(
    <span
      className="pointer-events-none fixed z-[9999]"
      style={{ top: coords?.top ?? 0, left: coords?.left ?? 0, transform: "translate(-50%, -100%)" }}
    >
      <motion.span
        ref={surfaceRef}
        id={tooltipId}
        role="tooltip"
        // stays mounted for its exit animation; while closed it is out of the accessibility tree
        aria-hidden={open ? undefined : true}
        variants={reduce ? REDUCED_VARIANTS : VARIANTS}
        initial={false}
        animate={open && coords ? "animate" : "exit"}
        style={{ transformOrigin: "center bottom", maxWidth: "calc(100vw - 16px)" }}
        className={cx(
          "flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-lg",
          className,
        )}
      >
        {content}
      </motion.span>
    </span>,
    document.body,
  );
}
