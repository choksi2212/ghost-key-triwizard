"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Shield, Lock, Key, Fingerprint, Cpu, Volume2 } from "lucide-react"
import { useKeystrokeAnalyzer } from "@/hooks/use-keystroke-analyzer"
import { AnomalyHeatmap } from "./anomaly-heatmap"
import { VoiceRegistration } from "./voice-registration"
import { VoiceAuthModal } from "./voice-auth-modal"

const PASSWORD_LENGTH = 11
const SAMPLES_REQUIRED = 10

export function KeystrokeCapture() {
  const [mode, setMode] = useState<"auth" | "register">("auth")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")


//by yas: checks if next iterated pass matches with the first pass if yes then next else exp error
const [initialPassword, setInitialPassword] = useState<string | null>(null)


  const [result, setResult] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null)
  const [sampleCount, setSampleCount] = useState(0)
  const [privacyMode, setPrivacyMode] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [heatmapData, setHeatmapData] = useState<number[]>([])

  // Voice authentication states
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [showVoiceAuth, setShowVoiceAuth] = useState(false)
  const [showVoiceRegistration, setShowVoiceRegistration] = useState(false)
  const [isVoiceRegistered, setIsVoiceRegistered] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)
  const { captureKeystrokes, extractFeatures, trainModel, authenticate, resetCapture, isCapturing, keystrokeData } =
    useKeystrokeAnalyzer()

  // Add Enter key handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (mode === "auth") {
        handleAuth()
      } else {
        handleRegister()
      }
    } else {
      captureKeystrokes(e, "keydown")
    }
  }

  const handleAuth = async () => {
    if (!username || !password) {
      setResult({ type: "error", message: "Please enter both username and password" })
      return
    }

    try {
      const features = extractFeatures(keystrokeData)

      // Call the authenticate API directly
      const response = await fetch("/api/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, features, password }),
      })

      const authResult = await response.json()
      console.log("Auth result:", authResult)

      // Handle the response based on the actual API structure
      if (authResult.authenticated) {
        setResult({
          type: "success",
          message: `✅ AUTHENTICATION SUCCESSFUL\nBiometric Error: ${(authResult.reconstructionError || 0).toFixed(5)}\n🛡️ ACCESS GRANTED`,
        })
        setHeatmapData(authResult.deviations || [])
        setShowHeatmap(true)
        setFailedAttempts(0) // Reset failed attempts on success

        // Log the authentication attempt
        await logAuthAttempt(username, true, authResult.reconstructionError || 0)
      } else {
        const newFailedAttempts = failedAttempts + 1
        setFailedAttempts(newFailedAttempts)

        setResult({
          type: "error",
          message: `❌ AUTHENTICATION FAILED (Attempt ${newFailedAttempts}/2)\nBiometric Error: ${(authResult.reconstructionError || 0).toFixed(5)}\n🚫 ACCESS DENIED\nReason: ${authResult.reason || "Authentication failed"}`,
        })
        setHeatmapData(authResult.deviations || [])
        setShowHeatmap(true)

        // Log the authentication attempt
        await logAuthAttempt(username, false, authResult.reconstructionError || 0)

        // Trigger voice authentication after 2 failed attempts
        if (newFailedAttempts >= 2) {
          setShowVoiceAuth(true)
          setResult({
            type: "error",
            message: `🚨 MULTIPLE AUTHENTICATION FAILURES\n🎤 Voice authentication required for security verification`,
          })
        }
      }
    } catch (error) {
      console.error("Authentication error:", error)
      setResult({ type: "error", message: `🚨 SECURITY BREACH DETECTED: ${error}` })
    }

    resetForm()
  }

  const handleRegister = async () => {
  if (!username || !password) {
    setResult({ type: "error", message: "Please enter both username and password" })
    return
  }

  if (initialPassword === null) {
    // First password input — store it
    setInitialPassword(password)
  } else if (password !== initialPassword) {
    // Mismatch with initial password — show error
    setResult({ type: "error", message: "🚫 Password mismatch! Use the same passphrase as the first sample." })
    resetForm()
    return
  }

  try {
    const features = extractFeatures(keystrokeData)
    const success = await trainModel(username, features, sampleCount, privacyMode)

    if (success) {
      const newCount = sampleCount + 1
      setSampleCount(newCount)

      if (newCount >= SAMPLES_REQUIRED) {
        setResult({
          type: "success",
          message: `✅ BIOMETRIC PROFILE CREATED\n🤖 Neural Network Trained for ${username}\n🔒 Security Clearance: ACTIVE`,
        })
        setSampleCount(0)
        setInitialPassword(null) // Reset initial password for next user
        setShowVoiceRegistration(true)
      } else {
        setResult({
          type: "info",
          message: `📊 Biometric Sample ${newCount}/${SAMPLES_REQUIRED} Captured\n⌨️ Continue keystroke pattern analysis`,
        })
      }

      resetCapture()
    }
  } catch (error) {
    setResult({ type: "error", message: `🚨 TRAINING ERROR: ${error}` })
  }

  resetForm()
}
  

  const handleVoiceAuthSuccess = () => {
    setFailedAttempts(0)
    setResult({
      type: "success",
      message: `✅ VOICE AUTHENTICATION SUCCESSFUL\n🛡️ ACCESS GRANTED VIA BIOMETRIC FALLBACK`,
    })
  }

  const handleVoiceRegistrationComplete = () => {
    setIsVoiceRegistered(true)
    setShowVoiceRegistration(false)
    setMode("auth")
    setResult({
      type: "success",
      message: `🎉 COMPLETE BIOMETRIC PROFILE CREATED\n⌨️ Keystroke + 🎤 Voice Authentication Ready`,
    })
  }

  const resetForm = () => {
    setPassword("")
    if (passwordRef.current) {
      passwordRef.current.focus()
    }
  }

  const logAuthAttempt = async (user: string, success: boolean, error: number) => {
    try {
      await fetch("/api/log-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          username: user,
          result: success ? "Pass" : "Fail",
          mse: error,
          ip: "localhost",
          userAgent: navigator.userAgent,
        }),
      })
    } catch (logError) {
      console.error("Failed to log auth attempt:", logError)
    }
  }

  // Show voice registration if in register mode and keystroke training is complete
  if (showVoiceRegistration) {
    return <VoiceRegistration username={username} onComplete={handleVoiceRegistrationComplete} />
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-700/50 dark:border-slate-600/50 shadow-2xl backdrop-blur-sm transition-all duration-300 hover:shadow-cyan-500/10">
        <CardHeader
          className="border-b border-slate-700/50 dark:border-slate-600/50"
          style={{
            background: "linear-gradient(to right, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.8))",
          }}
        >
          <CardTitle className="flex items-center justify-between text-slate-100 dark:text-slate-200">
            <span className="flex items-center gap-3">
              {mode === "auth" ? (
                <Shield className="w-6 h-6 text-cyan-400" />
              ) : (
                <Fingerprint className="w-6 h-6 text-blue-400" />
              )}
              <span className="text-xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {mode === "auth" ? "Multi-Modal Biometric Authentication" : "Biometric Profile Training"}
              </span>
            </span>
            <div className="flex gap-2">
              <Button
                variant={mode === "auth" ? "default" : "outline"}
                size="sm"
                onClick={() => {
    setMode("auth")
    setInitialPassword(null) // clear it when switching mode
  }}
                className={
                  mode === "auth"
                    ? "bg-cyan-600/80 hover:bg-cyan-500 text-white border-cyan-500/50"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700/50"
                }
              >
                <Shield className="w-4 h-4 mr-2" />
                Authenticate
              </Button>
              <Button
                variant={mode === "register" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("register")}
                className={
                  mode === "register"
                    ? "bg-blue-600/80 hover:bg-blue-500 text-white border-blue-500/50"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700/50"
                }
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                Register
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-slate-400 dark:text-slate-500">
            {mode === "auth"
              ? "🔐 Secure access through keystroke dynamics with voice fallback authentication"
              : "📝 Create biometric profile with keystroke + voice pattern recognition"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 bg-slate-800/30 dark:bg-slate-900/30">
          {/* Security Features Banner */}
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="px-3 py-1 bg-cyan-500/10 text-cyan-300 rounded-full text-xs font-medium border border-cyan-500/30 backdrop-blur-sm flex items-center gap-1">
              <Fingerprint className="w-3 h-3" />
              Keystroke Dynamics
            </div>
            <div className="px-3 py-1 bg-purple-500/10 text-purple-300 rounded-full text-xs font-medium border border-purple-500/30 backdrop-blur-sm flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              Voice Biometrics
            </div>
            <div className="px-3 py-1 bg-orange-500/10 text-orange-300 rounded-full text-xs font-medium border border-orange-500/30 backdrop-blur-sm">
              🛡️ Multi-Factor Security
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="username"
                className="text-slate-300 dark:text-slate-400 font-medium flex items-center gap-2"
              >
                <Key className="w-4 h-4 text-cyan-400" />
                Security Identifier
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter security ID"
                className="bg-slate-700/50 dark:bg-slate-800/50 border-slate-600/50 dark:border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 dark:focus:border-cyan-400/50 transition-all duration-300"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-slate-300 dark:text-slate-400 font-medium flex items-center gap-2"
              >
                <Lock className="w-4 h-4 text-cyan-400" />
                Biometric Passphrase
              </Label>
              <Input
                ref={passwordRef}
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => captureKeystrokes(e, "keyup")}
                placeholder="Enter passphrase for analysis"
                className="font-mono text-lg bg-slate-700/50 dark:bg-slate-800/50 border-slate-600/50 dark:border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 dark:focus:border-cyan-400/50 transition-all duration-300"
              />
              <p className="text-xs text-slate-500 dark:text-slate-600 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                Press Enter to {mode === "auth" ? "authenticate" : "capture biometric sample"}
              </p>
            </div>
          </div>

          {mode === "register" && (
            <>
              <div className="flex items-center space-x-3 p-4 bg-slate-700/30 dark:bg-slate-800/30 rounded-lg border border-slate-600/30 dark:border-slate-700/30">
                <Checkbox
                  id="privacy"
                  checked={privacyMode}
                  onCheckedChange={(checked) => setPrivacyMode(checked as boolean)}
                  className="border-slate-500 dark:border-slate-600"
                />
                <Label htmlFor="privacy" className="text-sm text-slate-400 dark:text-slate-500">
                  🔒 Privacy Mode (Raw keystroke vectors will not be stored)
                </Label>
              </div>

              {sampleCount > 0 && (
                <div className="space-y-3 p-4 rounded-lg border border-blue-500/30 dark:border-blue-400/30">
                  <div
                    className="p-4 -m-4 rounded-lg"
                    style={{
                      background: "linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(6, 182, 212, 0.1))",
                    }}
                  >
                    <Label className="text-slate-300 dark:text-slate-400 font-medium flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      Keystroke Pattern Training Progress
                    </Label>
                    <Progress
                      value={(sampleCount / SAMPLES_REQUIRED) * 100}
                      className="h-3 bg-slate-700 dark:bg-slate-800 mt-2"
                    />
                    <p className="text-sm text-slate-400 dark:text-slate-500 flex items-center gap-2 mt-2">
                      <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                      {sampleCount}/{SAMPLES_REQUIRED} keystroke vectors captured
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Failed attempts warning */}
          {mode === "auth" && failedAttempts > 0 && failedAttempts < 2 && (
            <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
              <div className="flex items-center gap-2 text-orange-300 text-sm">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Security Alert</span>
              </div>
              <p className="text-xs text-orange-400/80 mt-1">
                Authentication failed {failedAttempts}/2 times. Voice authentication will be required after 2 failures.
              </p>
            </div>
          )}

          <Button
            onClick={mode === "auth" ? handleAuth : handleRegister}
            className={`w-full transition-all duration-300 ${
              mode === "auth"
                ? "bg-gradient-to-r from-cyan-600/80 to-cyan-700/80 hover:from-cyan-500 hover:to-cyan-600 border border-cyan-500/50"
                : "bg-gradient-to-r from-blue-600/80 to-blue-700/80 hover:from-blue-500 hover:to-blue-600 border border-blue-500/50"
            } text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-medium backdrop-blur-sm`}
            disabled={isCapturing}
          >
            {mode === "auth" ? (
              <>
                <Shield className="w-5 h-5 mr-2" />
                INITIATE AUTHENTICATION
              </>
            ) : (
              <>
                <Fingerprint className="w-5 h-5 mr-2" />
                CAPTURE BIOMETRIC DATA
              </>
            )}
          </Button>

          {result && (
            <Alert
              className={`transition-all duration-300 backdrop-blur-sm ${
                result.type === "success"
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 dark:text-cyan-400"
                  : result.type === "error"
                    ? "border-red-500/50 bg-red-500/10 text-red-300 dark:text-red-400"
                    : "border-blue-500/50 bg-blue-500/10 text-blue-300 dark:text-blue-400"
              }`}
            >
              <AlertDescription className="whitespace-pre-line font-medium font-mono text-sm">
                {result.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {showHeatmap && heatmapData.length > 0 && <AnomalyHeatmap data={heatmapData} />}

      {/* Voice Authentication Modal */}
      <VoiceAuthModal
        isOpen={showVoiceAuth}
        onClose={() => setShowVoiceAuth(false)}
        username={username}
        onSuccess={handleVoiceAuthSuccess}
      />
    </div>
  )
}
