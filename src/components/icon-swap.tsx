import type { AnimatePresenceProps, HTMLMotionProps } from "motion/react"
import { AnimatePresence, motion } from "motion/react"

export function IconSwap(props: React.PropsWithChildren<AnimatePresenceProps>) {
  return <AnimatePresence mode="popLayout" initial={false} {...props} />
}

type MotionElement = typeof motion.div | typeof motion.span

export function IconSwapItem({
  as: Component = motion.div,
  ...props
}: HTMLMotionProps<"div"> & {
  as?: MotionElement
}) {
  return (
    <Component
      initial={{ opacity: 0, scale: 0.25 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.25 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      {...props}
    />
  )
}
