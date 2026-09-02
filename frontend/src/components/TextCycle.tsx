"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

export type CycleItem = { text: string }

export function TextCycle({
  items,
  holdMs = 2400,
  className,
}: {
  items: readonly CycleItem[]
  holdMs?: number
  className?: string
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (items.length < 2) return
    const id = window.setInterval(
      () => setIndex((value) => (value + 1) % items.length),
      holdMs
    )
    return () => window.clearInterval(id)
  }, [items.length, holdMs])

  const widest = items.reduce(
    (longest, entry) => (entry.text.length > longest.length ? entry.text : longest),
    ""
  )

  return (
    <span className={`relative inline-flex align-baseline ${className ?? ""}`}>
      <span aria-hidden className="invisible whitespace-nowrap">
        {widest}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${index}-${items[index].text}`}
          initial={{ y: "60%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-60%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.6 }}
          className="absolute inset-0 flex items-baseline"
        >
          {items[index].text}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export default TextCycle
