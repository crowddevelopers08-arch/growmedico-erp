"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Camera, RotateCcw, LogIn, LogOut } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface CameraPunchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: "in" | "out"
  onConfirm: (photo: string | null) => void
}

export function CameraPunchDialog({ open, onOpenChange, action, onConfirm }: CameraPunchDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setLoading(true)
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      setCameraError("Camera access denied. Please allow camera permission and try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setCaptured(null)
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [open, startCamera, stopCamera])

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    // Mirror the image (since video is mirrored via CSS)
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    setCaptured(canvas.toDataURL("image/jpeg", 0.8))
    stopCamera()
  }

  const handleRetake = () => {
    setCaptured(null)
    startCamera()
  }

  const handleConfirm = () => {
    onConfirm(captured)
    onOpenChange(false)
  }

  const handleSkip = () => {
    stopCamera()
    onConfirm(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            {action === "in" ? (
              <LogIn className="size-4 text-emerald-500" />
            ) : (
              <LogOut className="size-4 text-orange-500" />
            )}
            Punch {action === "in" ? "In" : "Out"}
          </DialogTitle>
          <DialogDescription>
            Take a selfie to confirm your {action === "in" ? "check-in" : "check-out"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {/* Camera / Preview Area */}
          <div className="relative overflow-hidden rounded-xl bg-muted" style={{ aspectRatio: "4/3" }}>
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted-foreground/10">
                  <Camera className="size-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">{cameraError}</p>
                <Button variant="outline" size="sm" onClick={startCamera}>
                  Try Again
                </Button>
              </div>
            ) : captured ? (
              <img src={captured} alt="Captured" className="w-full h-full object-cover" />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                )}
                {/* Face guide overlay */}
                {!loading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="size-36 rounded-full border-2 border-white/40 border-dashed" />
                  </div>
                )}
              </>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Action Buttons */}
          {!captured ? (
            <div className="space-y-2">
              <Button
                onClick={handleCapture}
                className="w-full gap-2"
                disabled={!!cameraError || loading}
              >
                <Camera className="size-4" />
                Take Photo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="w-full text-muted-foreground"
              >
                Skip — Punch {action === "in" ? "In" : "Out"} without photo
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRetake} className="flex-1 gap-2">
                <RotateCcw className="size-4" />
                Retake
              </Button>
              <Button onClick={handleConfirm} className="flex-1 gap-2">
                {action === "in" ? (
                  <><LogIn className="size-4" /> Confirm In</>
                ) : (
                  <><LogOut className="size-4" /> Confirm Out</>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
