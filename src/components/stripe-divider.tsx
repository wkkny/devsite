import { cn } from '@/lib/utils'

type StripeDividerProps = {
  className?: string
}

function StripeDivider({ className }: StripeDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('stripe-divider h-8 border-x border-line', className)}
    />
  )
}

export { StripeDivider }
