"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

/**
 * App-open splash overlay.
 *
 * Renders on the very first paint (its initial render is part of the SSR HTML,
 * so app content is never briefly visible underneath). The logo fades/scales
 * in, holds, then the whole overlay fades out and unmounts. Purely cosmetic —
 * it never blocks interaction beyond its short lifetime.
 */
export function SplashScreen() {
  // "in" -> logo visible, "out" -> overlay fading away, "done" -> unmounted.
  const [phase, setPhase] = useState<"pending" | "in" | "out" | "done">("pending")

  useEffect(() => {
    // Kick off the logo fade-in on the next frame so the transition runs.
    const raf = requestAnimationFrame(() => setPhase("in"))
    // Hold the logo, then start fading the overlay out.
    const holdTimer = setTimeout(() => setPhase("out"), 1100)
    // Unmount once the overlay fade-out finishes.
    const doneTimer = setTimeout(() => setPhase("done"), 1700)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(holdTimer)
      clearTimeout(doneTimer)
    }
  }, [])

  if (phase === "done") return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ease-out"
      style={{ opacity: phase === "out" ? 0 : 1, pointerEvents: phase === "out" ? "none" : "auto" }}
    >
      <Image
        src="/app-icon.png"
        alt=""
        width={96}
        height={96}
        priority
        className="size-24 rounded-2xl shadow-lg ring-1 ring-border transition-all duration-700 ease-out"
        style={{
          opacity: phase === "pending" ? 0 : 1,
          transform: phase === "pending" ? "scale(0.94)" : "scale(1)",
        }}
      />
    </div>
  )
}
