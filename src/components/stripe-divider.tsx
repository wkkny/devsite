import { cn } from '@/lib/utils'

type StripeDividerProps = {
  className?: string
  line?: 'none' | 'top' | 'bottom' | 'both'
}

function StripeDivider({ className, line = 'none' }: StripeDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'stripe-divider h-8 border-x border-line',
        line === 'top' && 'screen-line-top',
        line === 'bottom' && 'screen-line-bottom',
        line === 'both' && 'screen-line-top screen-line-bottom',
        className,
      )}
    />
  )
}

export { StripeDivider }
