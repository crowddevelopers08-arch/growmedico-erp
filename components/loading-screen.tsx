"use client"

import Image from "next/image"

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">

        {/* Logo inside a spinning ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute size-36 rounded-full border-2 border-primary/15 border-t-primary animate-spin" />
          <div className="absolute size-36 rounded-full border-2 border-primary/10 border-b-primary/40 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
          <Image
            src="/gmlogo1.png"
            alt="Grow Medico"
            width={156}
            height={52}
            className="rounded-lg"
            priority
          />
        </div>

        {/* App name */}
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground tracking-wide">Grow Medico</p>
          <p className="text-xs text-muted-foreground">Healthcare Digital Marketing Agency</p>
        </div>

        {/* Bouncing dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="size-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
