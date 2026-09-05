import { lazy, Suspense, useMemo, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'

const FigletText = lazy(() => import('@/components/ascii-figlet'))

type AsciiTextVariant = 'ansi' | 'ansi-shadow' | 'pixel'
type AsciiTextSize = 'sm' | 'md' | 'lg' | 'xl'
type AsciiTextAnimation = 'none' | 'stagger' | 'wave' | 'tetris'
type AsciiTextAnimationDirection = 'ltr' | 'rtl' | 'ttb' | 'btt'

type AsciiTextProps = {
  text: string
  variant?: AsciiTextVariant
  size?: AsciiTextSize
  color?: string
  backgroundColor?: string
  className?: string
  style?: CSSProperties
  animation?: AsciiTextAnimation
  animationDirection?: AsciiTextAnimationDirection
  animationKey?: string | number
}

type SharedTextProps = Omit<AsciiTextProps, 'variant' | 'size'> & {
  size: AsciiTextSize
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

const PIXEL_CELL_BY_SIZE = {
  sm: 5,
  md: 7,
  lg: 9,
  xl: 12,
} satisfies Record<AsciiTextSize, number>

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

  return (
    <Suspense fallback={null}>
      <FigletText variant={variant} size={size} {...props} />
    </Suspense>
  )
}

function PixelText({
  text,
  size,
  color,
  backgroundColor,
  className,
  style,
  animation = 'none',
  animationDirection = 'btt',
  animationKey,
}: SharedTextProps) {
  const cell = PIXEL_CELL_BY_SIZE[size]
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = animation !== 'none' && animationKey !== undefined && !prefersReducedMotion
  const glyphs = useMemo(() => {
    return Array.from(text.toUpperCase()).map(getPixelGlyph)
  }, [text])

  return (
    <div
      aria-label={text}
      className={cn('flex items-center', className)}
      style={{ gap: cell * 2, color, backgroundColor, ...style }}
    >
      {glyphs.map((glyph, index) => (
        <PixelGlyphView
          key={`${text[index] ?? ' '}-${index}`}
          glyph={glyph}
          cell={cell}
          animation={animation}
          animationDirection={animationDirection}
          shouldAnimate={shouldAnimate}
          animationKey={animationKey}
        />
      ))}
    </div>
  )
}

function PixelGlyphView({
  glyph,
  cell,
  animation,
  animationDirection,
  shouldAnimate,
  animationKey,
}: {
  glyph: PixelGlyph
  cell: number
  animation: AsciiTextAnimation
  animationDirection: AsciiTextAnimationDirection
  shouldAnimate: boolean
  animationKey?: string | number
}) {
  return (
    <div
      aria-hidden="true"
      className="relative shrink-0"
      style={{
        width: glyph.columns * cell,
        height: glyph.rows * cell,
      }}
    >
      {glyph.bars.map((bar, index) => (
        <PixelBarView
          key={`${bar.row}-${bar.column}-${bar.width}-${bar.height}`}
          bar={bar}
          cell={cell}
          columns={glyph.columns}
          rows={glyph.rows}
          index={index}
          animation={animation}
          animationDirection={animationDirection}
          shouldAnimate={shouldAnimate}
          animationKey={animationKey}
        />
      ))}
    </div>
  )
}

function PixelBarView({
  bar,
  cell,
  columns,
  rows,
  index,
  animation,
  animationDirection,
  shouldAnimate,
  animationKey,
}: {
  bar: PixelBar
  cell: number
  columns: number
  rows: number
  index: number
  animation: AsciiTextAnimation
  animationDirection: AsciiTextAnimationDirection
  shouldAnimate: boolean
  animationKey?: string | number
}) {
  const style = {
    left: bar.column * cell,
    top: bar.row * cell,
    width: bar.width * cell,
    height: bar.height * cell,
    transformOrigin: 'center',
  }

  if (!shouldAnimate) {
    return <span className="absolute bg-current" style={style} />
  }

  return (
    <motion.span
      key={animationKey}
      className="absolute bg-current"
      initial={getPixelBarInitial(
        animation,
        animationDirection,
        bar,
        columns,
        rows,
        cell,
      )}
      animate={getPixelBarAnimate(
        animation,
        animationDirection,
        bar,
        columns,
        rows,
        cell,
      )}
      transition={getPixelBarTransition(
        animation,
        animationDirection,
        index,
        bar,
      )}
      style={style}
    />
  )
}

function getPixelGlyph(character: string) {
  const key = character in PIXEL_FONT ? character : ' '
  const cachedGlyph = pixelGlyphCache.get(key)

  if (cachedGlyph) return cachedGlyph

  const pattern = PIXEL_FONT[key]
  const columns = Math.max(...pattern.map((row) => row.length))
  const glyph: PixelGlyph = {
    bars: getPixelBars(pattern, columns),
    columns,
    rows: pattern.length,
  }

  pixelGlyphCache.set(key, glyph)
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
      const bar = {
        row,
        column,
        width: useVertical ? 1 : horizontalWidth,
        height: useVertical ? verticalHeight : 1,
      }

      markVisited(visited, bar)
      bars.push(bar)
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

function markVisited(visited: boolean[][], bar: PixelBar) {
  for (let row = bar.row; row < bar.row + bar.height; row++) {
    for (let column = bar.column; column < bar.column + bar.width; column++) {
      visited[row][column] = true
    }
  }
}

const TETRIS_DROP_DEPTH = 6
const TETRIS_OVERSHOOT_RATIO = 0.55

type TetrisStart = { axis: 'x' | 'y'; from: number }

function isVerticalDirection(direction: AsciiTextAnimationDirection) {
  return direction === 'ttb' || direction === 'btt'
}

function getTetrisStartOffset(
  direction: AsciiTextAnimationDirection,
  bar: PixelBar,
  columns: number,
  rows: number,
  cell: number,
): TetrisStart {
  switch (direction) {
    case 'btt':
      return { axis: 'y', from: (rows - bar.row + TETRIS_DROP_DEPTH) * cell }
    case 'ltr':
      return { axis: 'x', from: -(bar.column + TETRIS_DROP_DEPTH) * cell }
    case 'rtl':
      return { axis: 'x', from: (columns - bar.column + TETRIS_DROP_DEPTH) * cell }
    default:
      return { axis: 'y', from: -(bar.row + TETRIS_DROP_DEPTH) * cell }
  }
}

function getPixelBarInitial(
  animation: AsciiTextAnimation,
  direction: AsciiTextAnimationDirection,
  bar: PixelBar,
  columns: number,
  rows: number,
  cell: number,
) {
  if (animation === 'tetris') {
    const start = getTetrisStartOffset(direction, bar, columns, rows, cell)

    return start.axis === 'x'
      ? { opacity: 1, x: start.from }
      : { opacity: 1, y: start.from }
  }

  return {
    opacity: 0,
    scale: animation === 'stagger' ? 0.75 : 1,
    ...getDirectionalOffset(direction, animation === 'wave' ? 4 : cell * 1.5),
  }
}

function getPixelBarAnimate(
  animation: AsciiTextAnimation,
  direction: AsciiTextAnimationDirection,
  bar: PixelBar,
  columns: number,
  rows: number,
  cell: number,
) {
  if (animation === 'tetris') {
    const start = getTetrisStartOffset(direction, bar, columns, rows, cell)
    const overshoot = cell * TETRIS_OVERSHOOT_RATIO
    const keyframes = [start.from, -Math.sign(start.from) * overshoot, 0]

    return start.axis === 'x'
      ? { opacity: 1, x: keyframes }
      : { opacity: 1, y: keyframes }
  }

  return {
    opacity: 1,
    scale: 1,
    x: direction === 'ltr' || direction === 'rtl' ? 0 : undefined,
    y: direction === 'ttb' || direction === 'btt' ? 0 : undefined,
  }
}

function getPixelBarTransition(
  animation: AsciiTextAnimation,
  direction: AsciiTextAnimationDirection,
  index: number,
  bar: PixelBar,
) {
  if (animation === 'tetris') {
    return {
      delay: isVerticalDirection(direction)
        ? bar.row * 0.055 + bar.column * 0.012
        : bar.column * 0.055 + bar.row * 0.012,
      duration: 0.4,
      times: [0, 0.78, 1],
      ease: 'easeOut' as const,
    }
  }

  if (animation === 'wave') {
    return {
      delay: index * 0.045,
      duration: 0.34,
      ease: 'easeOut',
    } as const
  }

  return {
    delay: index * 0.035,
    duration: 0.28,
    ease: 'easeOut',
  } as const
}

function getDirectionalOffset(
  direction: AsciiTextAnimationDirection,
  distance: number,
) {
  if (direction === 'ltr') return { x: -distance }
  if (direction === 'rtl') return { x: distance }
  if (direction === 'ttb') return { y: -distance }

  return { y: distance }
}

export {
  AsciiText,
  type AsciiTextAnimation,
  type AsciiTextAnimationDirection,
  type AsciiTextSize,
  type AsciiTextVariant,
}
