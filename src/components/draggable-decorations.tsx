import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { motion, useDragControls, useMotionValue } from 'motion/react'
import { AiOutlineOpenAI } from 'react-icons/ai'
import { FaLinux } from 'react-icons/fa'
import { FiPlus, FiX } from 'react-icons/fi'
import {
  SiAndroid,
  SiArchlinux,
  SiDocker,
  SiExpress,
  SiFastapi,
  SiGit,
  SiIos,
  SiNextdotjs,
  SiOpencode,
  SiPython,
  SiReact,
  SiTailwindcss,
  SiTanstack,
  SiTypescript,
} from 'react-icons/si'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const desktopDragQuery = '(min-width: 768px) and (hover: hover) and (pointer: fine)'
const storageKey = 'kritiraj-draggable-layout-v1'
const storageLifetime = 7 * 24 * 60 * 60 * 1000
const addableItems = [
  { label: 'Next.js', icon: SiNextdotjs },
  { label: 'React', icon: SiReact },
  { label: 'Python', icon: SiPython },
  { label: 'FastAPI', icon: SiFastapi },
  { label: 'Express', icon: SiExpress },
  { label: 'TanStack Start', icon: SiTanstack },
  { label: 'OpenCode', icon: SiOpencode },
  { label: 'Android', icon: SiAndroid },
  { label: 'iOS', icon: SiIos },
  { label: 'Docker', icon: SiDocker },
  { label: 'Linux', icon: FaLinux },
  { label: 'Arch Linux', icon: SiArchlinux },
  { label: 'Git', icon: SiGit },
] as const
const starterItems = [
  { id: 'typescript', label: 'TypeScript logo', top: 'calc(12% - 1rem)', align: 'left', icon: <SiTypescript aria-hidden="true" className="size-7" /> },
  { id: 'tailwind', label: 'Tailwind CSS logo', top: 'calc(52% - 1rem)', align: 'left', icon: <SiTailwindcss aria-hidden="true" className="size-7" /> },
  { id: 'openai', label: 'OpenAI logo', top: 'calc(28% - 1rem)', align: 'right', icon: <AiOutlineOpenAI aria-hidden="true" className="size-8" /> },
  { id: 'laptop', label: 'Laptop emoji', top: 'calc(68% - 1rem)', align: 'right', icon: <span aria-hidden="true" className="text-3xl leading-none">💻</span> },
] as const

type AddableItem = (typeof addableItems)[number]
type StarterItemId = (typeof starterItems)[number]['id']
type Position = { left: number; top: number }
type AddedItem = { id: number; choiceLabel: AddableItem['label']; position: Position }
type DecorationLayout = {
  version: 1
  expiresAt: number | null
  visibleStarterIds: StarterItemId[]
  starterPositions: Partial<Record<StarterItemId, Position>>
  addedItems: AddedItem[]
}

function defaultLayout(): DecorationLayout {
  return {
    version: 1,
    expiresAt: null,
    visibleStarterIds: starterItems.map((item) => item.id),
    starterPositions: {},
    addedItems: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPosition(value: unknown): value is Position {
  return isRecord(value) && typeof value.left === 'number' && Number.isFinite(value.left)
    && typeof value.top === 'number' && Number.isFinite(value.top)
}

function loadLayout(): DecorationLayout {
  const fallback = defaultLayout()
  if (typeof window === 'undefined') return fallback

  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return fallback

    const value: unknown = JSON.parse(stored)
    if (!isRecord(value) || value.version !== 1 || typeof value.expiresAt !== 'number'
      || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey)
      return fallback
    }

    const savedIds = Array.isArray(value.visibleStarterIds) ? value.visibleStarterIds : fallback.visibleStarterIds
    const visibleStarterIds = starterItems.filter((item) => savedIds.includes(item.id)).map((item) => item.id)
    const savedPositions = isRecord(value.starterPositions) ? value.starterPositions : {}
    const starterPositions: DecorationLayout['starterPositions'] = {}
    for (const item of starterItems) {
      const position = savedPositions[item.id]
      if (isPosition(position)) starterPositions[item.id] = position
    }

    const addedItems: AddedItem[] = []
    const seenIds = new Set<number>()
    if (Array.isArray(value.addedItems)) {
      for (const item of value.addedItems) {
        if (!isRecord(item) || typeof item.id !== 'number' || !Number.isInteger(item.id)
          || item.id < 0 || seenIds.has(item.id) || !isPosition(item.position)) continue
        const choice = addableItems.find((option) => option.label === item.choiceLabel)
        if (!choice) continue
        seenIds.add(item.id)
        addedItems.push({ id: item.id, choiceLabel: choice.label, position: item.position })
      }
    }

    return { version: 1, expiresAt: value.expiresAt, visibleStarterIds, starterPositions, addedItems }
  } catch {
    try { window.localStorage.removeItem(storageKey) } catch { /* Storage may be unavailable. */ }
    return fallback
  }
}

type DraggableItemProps = {
  label: string
  boundsRef: RefObject<HTMLDivElement | null>
  helpId: string
  top: string
  align: 'left' | 'right'
  left?: number
  onPositionChange?: (position: Position) => void
  onRemove?: () => void
  children: ReactNode
}

function DraggableItem({ label, boundsRef, helpId, top, align, left, onPositionChange, onRemove, children }: DraggableItemProps) {
  const itemRef = useRef<HTMLDivElement>(null)
  const [fixedTop, setFixedTop] = useState(top)
  const [fixedLeft] = useState(left)
  const dragControls = useDragControls()
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  useLayoutEffect(() => {
    const item = itemRef.current
    if (item) setFixedTop(`${item.offsetTop}px`)
  }, [])

  const keepInBounds = useCallback(() => {
    const bounds = boundsRef.current
    const item = itemRef.current
    if (!bounds || !item || !bounds.clientWidth || !bounds.clientHeight) return

    const minX = -item.offsetLeft
    const maxX = bounds.clientWidth - item.offsetLeft - item.offsetWidth
    const minY = -item.offsetTop
    const maxY = bounds.clientHeight - item.offsetTop - item.offsetHeight
    const nextX = Math.min(Math.max(x.get(), minX), maxX)
    const nextY = Math.min(Math.max(y.get(), minY), maxY)
    x.set(nextX)
    y.set(nextY)
    return { left: Math.round(item.offsetLeft + nextX), top: Math.round(item.offsetTop + nextY) }
  }, [boundsRef, x, y])

  useEffect(() => {
    const bounds = boundsRef.current
    if (!bounds) return

    const observer = new ResizeObserver(keepInBounds)
    observer.observe(bounds)
    window.addEventListener('resize', keepInBounds)
    keepInBounds()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', keepInBounds)
    }
  }, [boundsRef, keepInBounds])

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 24 : 8
    switch (event.key) {
      case 'ArrowLeft':
        x.set(x.get() - step)
        break
      case 'ArrowRight':
        x.set(x.get() + step)
        break
      case 'ArrowUp':
        y.set(y.get() - step)
        break
      case 'ArrowDown':
        y.set(y.get() + step)
        break
      case 'Home':
        x.set(0)
        y.set(0)
        break
      case 'Backspace':
      case 'Delete':
        if (!onRemove) return
        event.preventDefault()
        onRemove()
        return
      default:
        return
    }
    event.preventDefault()
    const position = keepInBounds()
    if (position) onPositionChange?.(position)
  }

  return (
    <motion.div
      ref={itemRef}
      className={cn('group/draggable pointer-events-auto absolute touch-none select-none', onRemove ? 'size-18' : 'size-14')}
      style={{
        x,
        y,
        top: fixedTop,
        left: fixedLeft ?? (align === 'left' ? 'max(12px, calc(50% - 30rem))' : undefined),
        right: fixedLeft === undefined && align === 'right'
          ? onRemove ? 'calc(max(12px, calc(50% - 30rem)) - 1rem)' : 'max(12px, calc(50% - 30rem))'
          : undefined,
      }}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={boundsRef}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={() => {
        const position = keepInBounds()
        if (position) onPositionChange?.(position)
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={helpId}
        className={cn(
          'flex cursor-grab items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring',
          onRemove ? 'absolute bottom-0 left-0 size-14' : 'size-full',
        )}
        onPointerDown={(event) => dragControls.start(event)}
        onKeyDown={moveWithKeyboard}
      >
        {children}
      </button>
      {onRemove ? (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={`Remove ${label}`}
          className="pointer-events-none absolute right-0 top-0 rounded-full opacity-0 shadow-sm group-hover/draggable:pointer-events-auto group-hover/draggable:opacity-100 group-focus-within/draggable:pointer-events-auto group-focus-within/draggable:opacity-100"
          onClick={onRemove}
        >
          <FiX aria-hidden="true" />
        </Button>
      ) : null}
    </motion.div>
  )
}

export function DraggableDecorations() {
  const bounds = useRef<HTMLDivElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const [layout, setLayout] = useState(loadLayout)
  const nextItemId = useRef(layout.addedItems.reduce((next, item) => Math.max(next, item.id + 1), 0))
  const [resetEpoch, setResetEpoch] = useState(0)
  const [showDecorations, setShowDecorations] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(desktopDragQuery).matches,
  )

  useEffect(() => {
    try {
      if (layout.expiresAt === null) window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, JSON.stringify(layout))
    } catch { /* Storage may be unavailable. */ }
  }, [layout])

  useEffect(() => {
    if (layout.expiresAt === null) return
    const remaining = layout.expiresAt - Date.now()
    const clearLayout = () => {
      setLayout(defaultLayout())
      setResetEpoch((epoch) => epoch + 1)
    }
    if (remaining <= 0) {
      clearLayout()
      return
    }
    const timeout = window.setTimeout(clearLayout, remaining)
    return () => window.clearTimeout(timeout)
  }, [layout.expiresAt])

  useEffect(() => {
    const mediaQuery = window.matchMedia(desktopDragQuery)
    const update = () => setShowDecorations(mediaQuery.matches)
    mediaQuery.addEventListener('change', update)
    update()

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  function addItem(choice: AddableItem) {
    const area = bounds.current
    if (!area) return

    const index = nextItemId.current++
    const areaRect = area.getBoundingClientRect()
    const itemSize = 72
    const column = index % 4
    const row = Math.floor(index / 4) % 3
    const left = Math.min(Math.max(88 + column * 80 - areaRect.left, 0), Math.max(area.clientWidth - itemSize, 0))
    const top = Math.min(
      Math.max(window.innerHeight - 112 - row * 80 - areaRect.top, 0),
      Math.max(area.clientHeight - itemSize, 0),
    )

    setLayout((current) => ({
      ...current,
      expiresAt: Date.now() + storageLifetime,
      addedItems: [...current.addedItems, { id: index, choiceLabel: choice.label, position: { left, top } }],
    }))
  }

  function removeItem(id: number) {
    addButtonRef.current?.focus()
    setLayout((current) => ({
      ...current,
      expiresAt: Date.now() + storageLifetime,
      addedItems: current.addedItems.filter((item) => item.id !== id),
    }))
  }

  function removeStarterItem(id: StarterItemId) {
    addButtonRef.current?.focus()
    setLayout((current) => ({
      ...current,
      expiresAt: Date.now() + storageLifetime,
      visibleStarterIds: current.visibleStarterIds.filter((item) => item !== id),
    }))
  }

  function saveStarterPosition(id: StarterItemId, position: Position) {
    setLayout((current) => ({
      ...current,
      expiresAt: Date.now() + storageLifetime,
      starterPositions: { ...current.starterPositions, [id]: position },
    }))
  }

  function saveAddedPosition(id: number, position: Position) {
    setLayout((current) => ({
      ...current,
      expiresAt: Date.now() + storageLifetime,
      addedItems: current.addedItems.map((item) => item.id === id ? { ...item, position } : item),
    }))
  }

  if (!showDecorations) return null

  return (
    <>
      <div
        role="group"
        aria-label="Draggable decorations"
        className="pointer-events-none absolute inset-x-0 top-96 bottom-0 z-30"
      >
        <p id="draggable-decorations-help" className="sr-only">
          Drag with a pointer, or use the arrow keys to move a focused icon. Press Home to reset it. Press Delete or Backspace to remove it.
        </p>
        <div ref={bounds} className="absolute inset-4">
          {starterItems.filter((item) => layout.visibleStarterIds.includes(item.id)).map((item) => {
            const position = layout.starterPositions[item.id]
            return (
              <DraggableItem
                key={`${resetEpoch}-${item.id}`}
                label={item.label}
                boundsRef={bounds}
                helpId="draggable-decorations-help"
                top={position ? `${position.top}px` : item.top}
                align={item.align}
                left={position?.left}
                onPositionChange={(nextPosition) => saveStarterPosition(item.id, nextPosition)}
                onRemove={() => removeStarterItem(item.id)}
              >
                {item.icon}
              </DraggableItem>
            )
          })}
          {layout.addedItems.map((item) => {
            const choice = addableItems.find((option) => option.label === item.choiceLabel)
            if (!choice) return null
            const Icon = choice.icon
            return (
              <DraggableItem
                key={`${resetEpoch}-added-${item.id}`}
                label={`${choice.label} logo`}
                boundsRef={bounds}
                helpId="draggable-decorations-help"
                top={`${item.position.top}px`}
                align="left"
                left={item.position.left}
                onPositionChange={(position) => saveAddedPosition(item.id, position)}
                onRemove={() => removeItem(item.id)}
              >
                <Icon aria-hidden="true" className="size-7" />
              </DraggableItem>
            )
          })}
        </div>
      </div>
      <div className="fixed bottom-6 left-6 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button ref={addButtonRef} variant="outline" size="icon-lg" aria-label="Add a draggable item" />}>
            <FiPlus aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Add an item</DropdownMenuLabel>
              {addableItems.map((choice) => {
                const Icon = choice.icon
                return (
                  <DropdownMenuItem key={choice.label} onClick={() => addItem(choice)}>
                    <Icon aria-hidden="true" />
                    {choice.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
