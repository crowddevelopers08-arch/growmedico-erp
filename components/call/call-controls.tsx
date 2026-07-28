"use client"

import {
  Maximize2, Mic, MicOff, Minimize2, Monitor, MonitorOff,
  Phone, PhoneOff, SwitchCamera, Video, VideoOff,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** A single round control button with a tooltip. */
function ControlButton({
  onClick, label, active, danger, accept, disabled, children,
}: {
  onClick?: () => void
  label: string
  active?: boolean // "on" state (e.g. mic live) — neutral surface
  danger?: boolean // destructive (end call) — red
  accept?: boolean // affirmative (answer) — green
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-full transition-all",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-40",
            danger && "bg-destructive text-white hover:bg-destructive/90",
            accept && "bg-success text-white hover:bg-success/90",
            !danger && !accept && active && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            // "muted/off" state — filled so it reads as toggled off.
            !danger && !accept && active === false && "bg-foreground/10 text-foreground hover:bg-foreground/15",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export interface CallControlsProps {
  variant: "voice" | "video"
  micEnabled: boolean
  cameraEnabled?: boolean
  screenSharing?: boolean
  fullscreen?: boolean
  minimized?: boolean
  onToggleMic: () => void
  onToggleCamera?: () => void
  onToggleScreenShare?: () => void
  onSwitchCamera?: () => void
  onToggleFullscreen?: () => void
  onToggleMinimize?: () => void
  onEnd: () => void
  className?: string
}

/** The in-call control bar. Renders only the controls relevant to the call
 *  type; every button is optional so voice reuses the same component. */
export function CallControls({
  variant, micEnabled, cameraEnabled, screenSharing, fullscreen,
  onToggleMic, onToggleCamera, onToggleScreenShare, onSwitchCamera,
  onToggleFullscreen, onEnd, className,
}: CallControlsProps) {
  const isVideo = variant === "video"
  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <ControlButton label={micEnabled ? "Mute" : "Unmute"} active={micEnabled} onClick={onToggleMic}>
        {micEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
      </ControlButton>

      {isVideo && onToggleCamera && (
        <ControlButton label={cameraEnabled ? "Camera off" : "Camera on"} active={cameraEnabled} onClick={onToggleCamera}>
          {cameraEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
        </ControlButton>
      )}

      {isVideo && onSwitchCamera && (
        <ControlButton label="Switch camera" active onClick={onSwitchCamera}>
          <SwitchCamera className="size-5" />
        </ControlButton>
      )}

      {isVideo && onToggleScreenShare && (
        <ControlButton label={screenSharing ? "Stop sharing" : "Share screen"} active={screenSharing} onClick={onToggleScreenShare}>
          {screenSharing ? <MonitorOff className="size-5" /> : <Monitor className="size-5" />}
        </ControlButton>
      )}

      {isVideo && onToggleFullscreen && (
        <ControlButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} active onClick={onToggleFullscreen}>
          {fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </ControlButton>
      )}

      <ControlButton label="End call" danger onClick={onEnd}>
        <PhoneOff className="size-5" />
      </ControlButton>
    </div>
  )
}

/** Answer/decline pair used by the incoming modal. */
export function AnswerControls({
  onAccept, onReject, className,
}: {
  onAccept: () => void
  onReject: () => void
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-center gap-10", className)}>
      <ControlButton label="Decline" danger onClick={onReject}>
        <PhoneOff className="size-6" />
      </ControlButton>
      <ControlButton label="Accept" accept onClick={onAccept}>
        <Phone className="size-6" />
      </ControlButton>
    </div>
  )
}
