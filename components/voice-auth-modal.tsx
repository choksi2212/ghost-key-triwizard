"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mic, MicOff, Play, Pause, RotateCcw, Shield, Volume2, AlertCircle } from "lucide-react"
import { useVoiceAuth } from "@/hooks/use-voice-auth"
import { Progress } from "@/components/ui/progress"

interface VoiceAuthModalProps {
  isOpen: boolean
  onClose: () => void
  username: string
  onSuccess: () => void
}

const PASSPHRASE = "I'll Always Choose You"

export function VoiceAuthModal({ isOpen, onClose, username, onSuccess }: VoiceAuthModalProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [result, setResult] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null)

  const {
    isRecording,
    audioBlob,
    audioUrl,
    recordingTime,
    isProcessing,
    processingProgress,
    extractedFeatures,
    startRecording,
    stopRecording,
    resetRecording,
    verifyVoice,
  } = useVoiceAuth()

  const handleStartRecording = async () => {
    try {
      await startRecording()
      setResult(null)
    } catch (error) {
      setResult({
        type: "error",
        message: "🚨 Microphone access denied. Please allow microphone permissions.",
      })
    }
  }

  const handleStopRecording = () => {
    stopRecording()
  }

  const handlePlayback = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      setIsPlaying(true)

      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => setIsPlaying(false)

      audio.play().catch(() => {
        setIsPlaying(false)
        setResult({ type: "error", message: "Failed to play audio" })
      })
    }
  }

  const handleVerifyVoice = async () => {
    if (!audioBlob) {
      setResult({ type: "error", message: "Please record your voice first." })
      return
    }

    setIsVerifying(true)
    try {
      const success = await verifyVoice(username, audioBlob)

      if (success) {
        setResult({
          type: "success",
          message: "✅ VOICE AUTHENTICATION SUCCESSFUL\n🛡️ ACCESS GRANTED\n\nVoice biometric patterns matched.",
        })
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      } else {
        setResult({
          type: "error",
          message:
            "❌ VOICE AUTHENTICATION FAILED\n🚫 Voice biometric patterns do not match\n\nDetected anomalies in voice characteristics.",
        })
      }
    } catch (error) {
      setResult({
        type: "error",
        message: "🚨 Voice verification error. Please try again.",
      })
    }
    setIsVerifying(false)
  }

  const handleRetake = () => {
    resetRecording()
    setResult(null)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800/95 dark:bg-slate-900/95 border-slate-700/50 dark:border-slate-600/50 backdrop-blur-sm max-w-4xl w-[900px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100 dark:text-slate-200">
            <Volume2 className="w-5 h-5 text-orange-400" />
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Voice Authentication Required
            </span>
          </DialogTitle>
          <DialogDescription className="text-slate-400 dark:text-slate-500">
            🔐 Keystroke authentication failed. Please verify your identity using voice biometrics.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 p-4">
          <div className="space-y-6">
            {/* Security Alert */}
            <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
              <div className="flex items-center gap-2 text-orange-300 text-sm">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Security Fallback Activated</span>
              </div>
              <p className="text-xs text-orange-400/80 mt-1">
                Multiple keystroke authentication failures detected. Voice verification required.
              </p>
            </div>

            {/* Passphrase */}
            <div className="p-4 rounded-lg border border-orange-500/30">
              <div
                className="p-4 -m-4 rounded-lg"
                style={{
                  background: "linear-gradient(to right, rgba(251, 146, 60, 0.1), rgba(239, 68, 68, 0.1))",
                }}
              >
                <h3 className="text-sm font-semibold text-slate-200 dark:text-slate-300 mb-2">
                  📝 Speak the passphrase:
                </h3>
                <p className="text-lg font-mono text-orange-300 dark:text-orange-400 text-center py-2 bg-slate-700/30 dark:bg-slate-800/30 rounded border border-slate-600/30">
                  "{PASSPHRASE}"
                </p>
              </div>
            </div>

            {/* Recording Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <Button
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    className={`w-16 h-16 rounded-full transition-all duration-300 ${
                      isRecording
                        ? "bg-red-600/80 hover:bg-red-500 animate-pulse"
                        : "bg-orange-600/80 hover:bg-orange-500"
                    } border-2 ${
                      isRecording ? "border-red-400/50" : "border-orange-400/50"
                    } shadow-lg hover:shadow-xl transform hover:scale-105`}
                  >
                    {isRecording ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                  </Button>

                  {isRecording && (
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                      <span className="text-xs font-mono text-red-400">{formatTime(recordingTime)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {isRecording ? "🔴 Recording... Click to stop" : "🎤 Click to start recording"}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            {/* Audio Preview */}
            {audioBlob && (
              <div className="p-3 bg-slate-700/30 dark:bg-slate-800/30 rounded-lg border border-slate-600/30">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    onClick={handlePlayback}
                    disabled={isPlaying}
                    size="sm"
                    className="bg-blue-600/80 hover:bg-blue-500 border border-blue-500/50"
                  >
                    {isPlaying ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                    {isPlaying ? "Playing" : "Preview"}
                  </Button>

                  <Button
                    onClick={handleRetake}
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700/50"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Retake
                  </Button>
                </div>
              </div>
            )}

            {audioBlob && (
              <div className="p-3 bg-slate-700/30 dark:bg-slate-800/30 rounded-lg border border-slate-600/30 mt-3">
                <div className="flex items-center gap-2 text-orange-300 text-xs mb-2">
                  <AlertCircle className="w-3 h-3" />
                  <span className="font-medium">Voice Biometric Analysis</span>
                </div>

                {isProcessing ? (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <div className="text-slate-400">Spectral Analysis:</div>
                    <div className="text-slate-300">Processing... {processingProgress}%</div>
                    <div className="text-slate-400">Prosodic Features:</div>
                    <div className="text-slate-300">Analyzing...</div>
                    <div className="text-slate-400">Voice Quality:</div>
                    <div className="text-slate-300">Measuring...</div>
                    <div className="text-slate-400">Temporal Features:</div>
                    <div className="text-slate-300">Calculating...</div>
                  </div>
                ) : extractedFeatures ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                      <div className="text-slate-400">MFCC Features:</div>
                      <div className="text-slate-300 font-mono">
                        {extractedFeatures.mfccMean?.length || 0} coefficients
                      </div>

                      <div className="text-slate-400">Spectral Centroid:</div>
                      <div className="text-slate-300 font-mono">
                        {extractedFeatures.spectralCentroidMean?.toFixed(2) || "N/A"} Hz
                      </div>

                      <div className="text-slate-400">Zero Crossing Rate:</div>
                      <div className="text-slate-300 font-mono">{extractedFeatures.zcrMean?.toFixed(4) || "N/A"}</div>

                      <div className="text-slate-400">RMS Energy:</div>
                      <div className="text-slate-300 font-mono">{extractedFeatures.rmsMean?.toFixed(4) || "N/A"}</div>

                      <div className="text-slate-400">Pitch (F0):</div>
                      <div className="text-slate-300 font-mono">
                        {extractedFeatures.pitchMean?.toFixed(1) || "N/A"} Hz
                      </div>

                      <div className="text-slate-400">Voice Quality:</div>
                      <div className="text-slate-300 font-mono">
                        J: {extractedFeatures.jitter?.toFixed(4) || "N/A"}, S:{" "}
                        {extractedFeatures.shimmer?.toFixed(4) || "N/A"}
                      </div>
                    </div>

                    <div className="mt-2 p-2 bg-slate-600/20 rounded text-xs">
                      <div className="text-green-400 font-medium mb-1">✅ Ready for Authentication</div>
                      <div className="text-slate-400">Voice pattern extracted and ready for comparison</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">🎤 Record audio to analyze voice biometric features</div>
                )}
              </div>
            )}
          </div>
          {/* Action Buttons */}
          <div className="flex gap-3 col-span-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/50"
            >
              Cancel
            </Button>

            <Button
              onClick={handleVerifyVoice}
              disabled={!audioBlob || isVerifying || isProcessing}
              className="flex-1 bg-gradient-to-r from-orange-600/80 to-red-600/80 hover:from-orange-500 hover:to-red-500 border border-orange-500/50"
            >
              {isVerifying || isProcessing ? (
                <>
                  <Shield className="w-4 h-4 mr-2 animate-spin" />
                  {isProcessing ? `Processing... ${processingProgress}%` : "Verifying..."}
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Authenticate
                </>
              )}
            </Button>
          </div>

          {(isVerifying || isProcessing) && (
            <div className="space-y-2 mt-3 col-span-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Processing voice biometrics...</span>
                <span className="text-slate-400">{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="h-1 bg-slate-700" />
            </div>
          )}

          {/* Result Messages */}
          {result && (
            <Alert
              className={`transition-all duration-300 backdrop-blur-sm col-span-2 ${
                result.type === "success"
                  ? "border-green-500/50 bg-green-500/10 text-green-300"
                  : result.type === "error"
                    ? "border-red-500/50 bg-red-500/10 text-red-300"
                    : "border-orange-500/50 bg-orange-500/10 text-orange-300"
              }`}
            >
              <AlertDescription className="whitespace-pre-line font-medium font-mono text-xs">
                {result.message}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
