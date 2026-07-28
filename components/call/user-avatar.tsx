"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
  xl: "size-28 text-3xl",
} as const

export interface UserAvatarProps {
  name: string
  avatar?: string | null
  initials: string
  size?: keyof typeof SIZES
  /** Show a presence dot: true = online (green), false = offline (grey). */
  online?: boolean
  /** Soft pulsing ring — used on the calling/ringing screens. */
  pulse?: boolean
  className?: string
}

/** Avatar with optional presence dot and ringing pulse. Used everywhere a
 *  person appears in the call UI. */
export function UserAvatar({ name, avatar, initials, size = "md", online, pulse, className }: UserAvatarProps) {
  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {pulse && (
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" aria-hidden />
      )}
      <Avatar className={cn(SIZES[size], "relative ring-2 ring-background")}>
        <AvatarImage src={avatar ?? undefined} alt={name} />
        <AvatarFallback className="bg-primary/10 font-medium text-primary">{initials}</AvatarFallback>
      </Avatar>
      {online !== undefined && (
        <span
          className={cn(
            "absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-background",
            online ? "bg-success" : "bg-muted-foreground",
          )}
          title={online ? "Online" : "Offline"}
        />
      )}
    </div>
  )
}
