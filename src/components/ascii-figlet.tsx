import { useMemo } from 'react'
import figlet from 'figlet'
import ansiRegular from 'figlet/fonts/ANSI Regular'
import ansiShadow from 'figlet/fonts/ANSI Shadow'

import { cn } from '@/lib/utils'

figlet.defaults({ fetchFontIfMissing: false })
figlet.parseFont('ANSI Regular', ansiRegular)
figlet.parseFont('ANSI Shadow', ansiShadow)

export type FigletTextVariant = 'ansi' | 'ansi-shadow'
export type FigletTextSize = 'sm' | 'md' | 'lg' | 'xl'

const FIGLET_FONT_BY_VARIANT = {
  ansi: 'ANSI Regular',
  'ansi-shadow': 'ANSI Shadow',
} satisfies Record<FigletTextVariant, string>

const FIGLET_SIZE_CLASS_BY_SIZE = {
  sm: 'text-[3px] sm:text-[4px]',
  md: 'text-[4px] sm:text-[5px]',
  lg: 'text-[5px] sm:text-[6px]',
  xl: 'text-[6px] sm:text-[8px]',
} satisfies Record<FigletTextSize, string>

function FigletText({
  text,
  variant,
  size,
  color,
  backgroundColor,
  className,
  style,
}: {
  text: string
  variant: FigletTextVariant
  size: FigletTextSize
  color?: string
  backgroundColor?: string
  className?: string
  style?: React.CSSProperties
}) {
  const ascii = useMemo(() => {
    return figlet.textSync(text, {
      font: FIGLET_FONT_BY_VARIANT[variant],
      horizontalLayout: 'default',
      verticalLayout: 'default',
      whitespaceBreak: true,
    })
  }, [text, variant])

  return (
    <pre
      aria-label={text}
      className={cn(
        'font-mono leading-none tracking-normal',
        FIGLET_SIZE_CLASS_BY_SIZE[size],
        className,
      )}
      style={{ color, backgroundColor, ...style }}
    >
      {ascii}
    </pre>
  )
}

export default FigletText
