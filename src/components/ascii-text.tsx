import { useMemo, type CSSProperties } from 'react'
import figlet from 'figlet'
import ansiRegular from 'figlet/fonts/ANSI Regular'
import ansiShadow from 'figlet/fonts/ANSI Shadow'

import { cn } from '@/lib/utils'

figlet.defaults({ fetchFontIfMissing: false })
figlet.parseFont('ANSI Regular', ansiRegular)
figlet.parseFont('ANSI Shadow', ansiShadow)

type AsciiTextVariant = 'ansi' | 'ansi-shadow' | 'pixel'
type AsciiTextSize = 'sm' | 'md' | 'lg' | 'xl'

type AsciiTextProps = {
  text: string
  variant?: AsciiTextVariant
  size?: AsciiTextSize
  color?: string
  backgroundColor?: string
  className?: string
  style?: CSSProperties
}

type PixelBar = {
  row: number
  column: number
  width: number
  height: number
}

type PixelGlyph = {
  bars: PixelBar[]
  columns: number
  rows: number
}

const FIGLET_FONT_BY_VARIANT: Record<Exclude<AsciiTextVariant, 'pixel'>, string> = {
  ansi: 'ANSI Regular',
  'ansi-shadow': 'ANSI Shadow',
}

const FIGLET_SIZE_CLASS_BY_SIZE: Record<AsciiTextSize, string> = {
  sm: 'text-[3px] sm:text-[4px]',
  md: 'text-[4px] sm:text-[5px]',
  lg: 'text-[5px] sm:text-[6px]',
  xl: 'text-[6px] sm:text-[8px]',
}

const PIXEL_CELL_BY_SIZE: Record<AsciiTextSize, number> = {
  sm: 4,
  md: 5,
  lg: 6,
  xl: 8,
}

const PIXEL_FONT: Record<string, string[]> = {
  A: ['0110', '1001', '1111', '1001', '1001'],
  B: ['1110', '1001', '1110', '1001', '1110'],
  C: ['1111', '1000', '1000', '1000', '1111'],
  D: ['1110', '1001', '1001', '1001', '1110'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  F: ['1111', '1000', '1110', '1000', '1000'],
  G: ['1111', '1000', '1011', '1001', '1111'],
  H: ['1001', '1001', '1111', '1001', '1001'],
  I: ['111', '010', '010', '010', '111'],
  J: ['0011', '0001', '0001', '1001', '1111'],
  K: ['1001', '1010', '1100', '1010', '1001'],
  L: ['1000', '1000', '1000', '1000', '1111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['1001', '1101', '1011', '1001', '1001'],
  O: ['1111', '1001', '1001', '1001', '1111'],
  P: ['1110', '1001', '1110', '1000', '1000'],
  Q: ['1111', '1001', '1001', '1011', '1111'],
  R: ['1110', '1001', '1110', '1010', '1001'],
  S: ['1111', '1000', '1111', '0001', '1111'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  U: ['1001', '1001', '1001', '1001', '1111'],
  V: ['1001', '1001', '1001', '1001', '0110'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  X: ['1001', '1001', '0110', '1001', '1001'],
  Y: ['1001', '1001', '0110', '0010', '0010'],
  Z: ['1111', '0001', '0110', '1000', '1111'],
  ' ': ['0', '0', '0', '0', '0'],
}

const pixelGlyphCache = new Map<string, PixelGlyph>()

function AsciiText({
  variant = 'ansi-shadow',
  size = 'md',
  ...props
}: AsciiTextProps) {
  if (variant === 'pixel') {
    return <PixelText size={size} {...props} />
  }

  return <FigletText variant={variant} size={size} {...props} />
}

function FigletText({
  text,
  variant,
  size,
  color,
  backgroundColor,
  className,
  style,
}: AsciiTextProps & { variant: Exclude<AsciiTextVariant, 'pixel'>; size: AsciiTextSize }) {
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

function PixelText({
  text,
  size,
  color,
  backgroundColor,
  className,
  style,
}: AsciiTextProps & { size: AsciiTextSize }) {
  const cell = PIXEL_CELL_BY_SIZE[size]
  const glyphs = useMemo(() => {
    return Array.from(text.toUpperCase()).map(getPixelGlyph)
  }, [text])

  return (
    <div
      aria-label={text}
      className={cn('flex items-center', className)}
      style={{
        gap: cell * 2,
        color,
        backgroundColor,
        ...style,
      }}
    >
      {glyphs.map((glyph, glyphIndex) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={glyphIndex}
          aria-hidden="true"
          className="relative shrink-0"
          style={{
            width: glyph.columns * cell,
            height: glyph.rows * cell,
          }}
        >
          {glyph.bars.map((bar) => (
            <span
              key={`${bar.row}-${bar.column}-${bar.width}-${bar.height}`}
              className="absolute bg-current"
              style={{
                left: bar.column * cell,
                top: bar.row * cell,
                width: bar.width * cell,
                height: bar.height * cell,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function getPixelGlyph(character: string) {
  const cacheKey = PIXEL_FONT[character] ? character : ' '
  const cachedGlyph = pixelGlyphCache.get(cacheKey)

  if (cachedGlyph) return cachedGlyph

  const pattern = PIXEL_FONT[cacheKey]
  const columns = Math.max(...pattern.map((row) => row.length))
  const glyph = {
    bars: getPixelBars(pattern, columns),
    columns,
    rows: pattern.length,
  }

  pixelGlyphCache.set(cacheKey, glyph)

  return glyph
}

function getPixelBars(pattern: string[], columns: number) {
  const grid = pattern.map((row) => row.padEnd(columns, '0').split(''))
  const visited = grid.map((row) => row.map(() => false))
  const bars: PixelBar[] = []

  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < columns; column++) {
      if (grid[row][column] !== '1' || visited[row][column]) continue

      const horizontalWidth = getHorizontalRun(grid, visited, row, column)
      const verticalHeight = getVerticalRun(grid, visited, row, column)
      const useVertical = verticalHeight > horizontalWidth
      const width = useVertical ? 1 : horizontalWidth
      const height = useVertical ? verticalHeight : 1

      markVisited(visited, row, column, width, height)
      bars.push({ row, column, width, height })
    }
  }

  return bars
}

function getHorizontalRun(
  grid: string[][],
  visited: boolean[][],
  row: number,
  column: number,
) {
  let width = 0

  while (
    column + width < grid[row].length &&
    grid[row][column + width] === '1' &&
    !visited[row][column + width]
  ) {
    width++
  }

  return width
}

function getVerticalRun(
  grid: string[][],
  visited: boolean[][],
  row: number,
  column: number,
) {
  let height = 0

  while (
    row + height < grid.length &&
    grid[row + height][column] === '1' &&
    !visited[row + height][column]
  ) {
    height++
  }

  return height
}

function markVisited(
  visited: boolean[][],
  row: number,
  column: number,
  width: number,
  height: number,
) {
  for (let barRow = row; barRow < row + height; barRow++) {
    for (let barColumn = column; barColumn < column + width; barColumn++) {
      visited[barRow][barColumn] = true
    }
  }
}

export { AsciiText, type AsciiTextSize, type AsciiTextVariant }
