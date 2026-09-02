"use client"

import { useEffect, useRef } from "react"

const PULL = 0.28
const REACH = 42
const STIFFNESS = 105
const DAMPING = 13.5
const INSET = 2

type MagneticButtonProps = {
  href: string
  label: string
  icon?: React.ReactNode
  external?: boolean
  className?: string
}

export function MagneticButton({
  href,
  label,
  icon,
  external = true,
  className,
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLAnchorElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const button = buttonRef.current
    const content = contentRef.current
    if (!button || !content) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reduced.matches) return
    if (window.matchMedia("(pointer: coarse)").matches) return

    let frame = 0
    let last = performance.now()
    let x = 0
    let y = 0
    let vx = 0
    let vy = 0
    let targetX = 0
    let targetY = 0

    const onMove = (event: MouseEvent) => {
      const rect = button.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const w = rect.width
      const h = rect.height
      const outsideX = Math.max(0, Math.abs(px - w / 2) - w / 2)
      const outsideY = Math.max(0, Math.abs(py - h / 2) - h / 2)
      const falloff = Math.max(0, 1 - Math.hypot(outsideX, outsideY) / REACH)
      targetX = (px - w / 2) * PULL * falloff
      targetY = (py - h / 2) * PULL * falloff
    }

    const onLeave = () => {
      targetX = 0
      targetY = 0
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const ax = (STIFFNESS * (targetX - x) - DAMPING * vx) * dt
      const ay = (STIFFNESS * (targetY - y) - DAMPING * vy) * dt
      vx += ax
      vy += ay
      x += vx * dt
      y += vy * dt

      const maxX = Math.max(0, content.clientWidth / 2 + INSET)
      const maxY = Math.max(0, content.clientHeight / 2 + INSET)
      const cx = Math.max(-maxX, Math.min(maxX, x))
      const cy = Math.max(-maxY, Math.min(maxY, y))
      content.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    window.addEventListener("mousemove", onMove)
    button.addEventListener("mouseleave", onLeave)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("mousemove", onMove)
      button.removeEventListener("mouseleave", onLeave)
      if (content) content.style.transform = "translate3d(0, 0, 0)"
    }
  }, [])

  return (
    <a
      ref={buttonRef}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:border-white/30 hover:bg-white/[0.08] ${className ?? ""}`}
    >
      <span ref={contentRef} className="inline-flex items-center gap-2 will-change-transform">
        {icon}
        {label}
      </span>
    </a>
  )
}

export default MagneticButton
