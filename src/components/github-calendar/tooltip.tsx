"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Space between the tooltip and its square, and between the tooltip and the viewport edge. */
const OFFSET = 8;

/**
 * The readout above a square. It is portalled and fixed-positioned, so the calendar's
 * scrolling container cannot clip it, and it is kept inside the viewport.
 */
export function CalendarTooltip({
  id,
  open,
  anchorKey,
  getAnchor,
  children,
}: {
  id: string;
  open: boolean;
  /** Changes whenever the anchor does, so the tooltip re-measures. */
  anchorKey: string | number | null;
  getAnchor: () => HTMLElement | null;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  // Keep showing the last content while the closing transition plays.
  const [content, setContent] = useState<ReactNode>(children);
  if (open && content !== children) setContent(children);
  const visible = open && position !== null;
  // Once open, it glides from square to square instead of jumping. Opening places it directly.
  const [glide, setGlide] = useState(false);
  useEffect(() => {
    if (!visible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frame = requestAnimationFrame(() => setGlide(true));
    return () => {
      cancelAnimationFrame(frame);
      setGlide(false);
    };
  }, [visible]);

  useLayoutEffect(() => {
    const anchor = getAnchor();
    if (!open || !anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = surfaceRef.current?.offsetWidth ?? 0;
      const height = surfaceRef.current?.offsetHeight ?? 0;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, OFFSET + width / 2),
        window.innerWidth - OFFSET - width / 2,
      );
      const top = Math.max(rect.top - OFFSET, OFFSET + height);
      setPosition((current) => (current?.top === top && current.left === left ? current : { top, left }));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    if (surfaceRef.current) observer.observe(surfaceRef.current);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorKey, getAnchor]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <span
      className="pointer-events-none fixed z-50"
      style={{
        top: 0,
        left: 0,
        transform: `translate3d(${position?.left ?? 0}px, ${position?.top ?? 0}px, 0) translate(-50%, -100%)`,
        transition: glide ? "transform 110ms cubic-bezier(0.16, 1, 0.3, 1)" : undefined,
        // its natural width, not the space left between `left` and the viewport edge
        width: "max-content",
        visibility: position ? undefined : "hidden",
      }}
    >
      <span
        ref={surfaceRef}
        id={id}
        role="tooltip"
        // stays mounted for the closing transition; out of the accessibility tree while closed
        aria-hidden={visible ? undefined : true}
        data-open={visible ? "" : undefined}
        style={{ maxWidth: "calc(100vw - 16px)", transformOrigin: "center bottom" }}
        className="flex translate-y-1 scale-95 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground opacity-0 blur-[2px] shadow-lg transition-[opacity,translate,scale,filter] duration-150 ease-out motion-reduce:transition-opacity data-open:translate-y-0 data-open:scale-100 data-open:opacity-100 data-open:blur-[0px]"
      >
        {content}
      </span>
    </span>,
    document.body,
  );
}
