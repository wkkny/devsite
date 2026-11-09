import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

import { Tooltip as TooltipRoot, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// shadcn's tooltip restyled for the site: a light bordered surface instead of the inverted
// one, no arrow, and a short blur on the way in and out. Reduced motion drops the animation.
const SITE_TOOLTIP = cn(
  'max-w-[calc(100vw-16px)] rounded-lg border border-border bg-background px-2.5 py-1 font-medium text-foreground shadow-lg',
  // 4px of travel and 150ms in, 100ms out: the same feel as the calendar's tooltip.
  'data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1 duration-150 data-closed:duration-100',
  'data-closed:data-[side=top]:slide-out-to-bottom-1 data-closed:data-[side=bottom]:slide-out-to-top-1',
  'blur-in-[3px] blur-out-[2px] motion-reduce:animate-none!',
)

type Side = 'top' | 'right' | 'bottom' | 'left'

const GroupContext = createContext<ReturnType<typeof TooltipPrimitive.createHandle<ReactNode>> | null>(null)

/**
 * One tooltip shared by a row of neighbouring triggers. Moving from one trigger to the next, the
 * surface glides to its new place and its label cross-fades, instead of each trigger playing its
 * own exit and enter. Only the first open and the last close animate in and out.
 */
export function TooltipGroup({ children, side = 'top', gap = 8 }: { children: ReactNode; side?: Side; gap?: number }) {
  const [handle] = useState(() => TooltipPrimitive.createHandle<ReactNode>())
  return (
    <GroupContext.Provider value={handle}>
      {children}
      <TooltipPrimitive.Root handle={handle}>
        {({ payload }) => (
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner
              side={side}
              sideOffset={gap}
              className="isolate z-50 transition-[top,left,right,bottom,transform] duration-220 ease-[cubic-bezier(0.16,1,0.3,1)] data-instant:transition-none motion-reduce:transition-none"
            >
              <TooltipPrimitive.Popup
                data-slot="tooltip-content"
                className={cn(
                  SITE_TOOLTIP,
                  'z-50 inline-flex w-fit origin-(--transform-origin) items-center text-xs',
                  'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                )}
              >
                <TooltipPrimitive.Viewport className="relative whitespace-nowrap [&>[data-previous]]:absolute [&>[data-previous]]:inset-0 [&>[data-previous]]:flex [&>[data-previous]]:items-center [&>*]:transition-opacity [&>*]:duration-120 [&>[data-previous]]:opacity-0 motion-reduce:[&>*]:transition-none">
                  {payload}
                </TooltipPrimitive.Viewport>
              </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </GroupContext.Provider>
  )
}

type TooltipProps = {
  content: ReactNode
  /** The trigger. It must accept and spread props and a ref onto its DOM element. */
  children: ReactElement
  /** Ignored inside a TooltipGroup, which places every label on the group's side. */
  side?: Side
  /** Distance from the trigger in px. Ignored inside a TooltipGroup. */
  gap?: number
  disabled?: boolean
  className?: string
}

// Hover and keyboard focus open it; touch never does. The label is visual only, so a
// trigger's accessible name must not depend on it.
export function Tooltip({ content, children, side = 'top', gap = 8, disabled, className }: TooltipProps) {
  const group = useContext(GroupContext)
  if (group) return <TooltipPrimitive.Trigger handle={group} payload={content} disabled={disabled} render={children} />

  return (
    <TooltipRoot disabled={disabled}>
      <TooltipTrigger render={children} />
      {/* The last child of shadcn's popup is its arrow, which the site's style leaves out. */}
      <TooltipContent side={side} sideOffset={gap} className={cn(SITE_TOOLTIP, '[&>:last-child]:hidden', className)}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  )
}
