import type { ReactElement, ReactNode } from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"

// Moving between triggers inside one provider skips the delay after the first tooltip.
function TooltipProvider({ delay = 120, closeDelay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} closeDelay={closeDelay} {...props} />
}

type TooltipProps = {
  content: ReactNode
  /** The trigger. It must accept and spread props and a ref onto its DOM element. */
  children: ReactElement
  side?: "top" | "right" | "bottom" | "left"
  /** Distance from the trigger in px. */
  gap?: number
  disabled?: boolean
  className?: string
}

// Hover and keyboard focus open it; touch never does. The label is visual only, so a
// trigger's accessible name must not depend on it.
function Tooltip({ content, children, side = "top", gap = 8, disabled, className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={gap} collisionPadding={8} className="z-50">
          <TooltipPrimitive.Popup
            data-slot="tooltip"
            className={cn(
              "max-w-[calc(100vw-16px)] origin-(--transform-origin) rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-lg",
              // rises in from the trigger with a short blur; reduced motion keeps only the fade
              "transition-[opacity,scale,translate,filter] duration-150 ease-out motion-reduce:transition-opacity",
              "data-starting-style:scale-90 data-starting-style:opacity-0 data-starting-style:blur-[5px]",
              "data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:blur-[3px] data-ending-style:duration-100",
              "data-[side=top]:data-starting-style:translate-y-2 data-[side=bottom]:data-starting-style:-translate-y-2",
              "data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2",
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip, TooltipProvider }
