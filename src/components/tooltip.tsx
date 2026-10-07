import type { ReactElement, ReactNode } from 'react'
import { cn } from 'cn'

import { Tooltip as TooltipRoot, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// shadcn's tooltip restyled for the site: a light bordered surface instead of the inverted
// one, no arrow, and a short blur on the way in and out. Reduced motion drops the animation.
const SITE_TOOLTIP = cn(
  'max-w-[calc(100vw-16px)] rounded-lg border border-border bg-background px-2.5 py-1 font-medium text-foreground shadow-lg',
  '[&>:last-child]:hidden',
  'blur-in-[5px] blur-out-[3px] motion-reduce:animate-none!',
)

type TooltipProps = {
  content: ReactNode
  /** The trigger. It must accept and spread props and a ref onto its DOM element. */
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Distance from the trigger in px. */
  gap?: number
  disabled?: boolean
  className?: string
}

// Hover and keyboard focus open it; touch never does. The label is visual only, so a
// trigger's accessible name must not depend on it.
export function Tooltip({ content, children, side = 'top', gap = 8, disabled, className }: TooltipProps) {
  return (
    <TooltipRoot disabled={disabled}>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} sideOffset={gap} className={cn(SITE_TOOLTIP, className)}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  )
}
