"use client"

import { useState, useRef, useCallback } from "react"
import { processVoiceAudio } from "@/utils/voice-feature-extractor"

interface VoiceAuthHook {
  isRecording: boolean
  audioBlob: Blob | null
  audioUrl: string | null
  recordingTime: number
  isProcessing: boolean
  processingProgress: number
  extractedFeatures: any
  startRecording: () => Promise<void>
  stopRecording: () => void
  resetRecording: () => void
  registerVoice: (username: string, samples: Blob[]) => Promise<boolean>
  verifyVoice: (username: string, sample: Blob) => Promise<boolean>
}

export function useVoiceAuth(): VoiceAuthHook {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [extractedFeatures, setExtractedFeatures] = useState<any>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      })

      mediaRecorderRef.current = mediaRecorder

      const chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())

        // Extract features immediately
        try {
          setIsProcessing(true)
          setProcessingProgress(20)

          const { features } = await processVoiceAudio(blob)
          setExtractedFeatures(features)
          setProcessingProgress(100)
        } catch (error) {
          console.error("Failed to extract features:", error)
          setExtractedFeatures(null)
        } finally {
          setIsProcessing(false)
          setTimeout(() => setProcessingProgress(0), 1000)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Error accessing microphone:", error)
      throw new Error("Microphone access denied")
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  const resetRecording = useCallback(() => {
    setAudioBlob(null)
    setExtractedFeatures(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setRecordingTime(0)
  }, [audioUrl])

  const registerVoice = useCallback(async (username: string, samples: Blob[]): Promise<boolean> => {
    try {
      setIsProcessing(true)
      setProcessingProgress(0)

      // Process each sample to extract voice features
      const processedSamples = []

      for (let i = 0; i < samples.length; i++) {
        setProcessingProgress(((i + 1) / samples.length) * 80) // 80% for processing

        const { features } = await processVoiceAudio(samples[i])
        processedSamples.push({
          index: i,
          blob: samples[i],
          features,
        })
      }

      setProcessingProgress(90) // 90% for upload preparation

      const formData = new FormData()
      formData.append("username", username)

      // Add each sample blob
      samples.forEach((sample, index) => {
        formData.append(`sample_${index}`, sample, `voice_sample_${index}.webm`)
      })

      // Add extracted features as JSON
      formData.append("features", JSON.stringify(processedSamples.map((sample) => sample.features)))

      setProcessingProgress(95) // 95% for server upload

      const response = await fetch("/api/voice/register", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      setProcessingProgress(100)

      return result.success
    } catch (error) {
      console.error("Voice registration failed:", error)
      return false
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }, [])

  const verifyVoice = useCallback(async (username: string, sample: Blob): Promise<boolean> => {
    try {
      setIsProcessing(true)
      setProcessingProgress(30)

      // Process the sample to extract voice features
      const { features } = await processVoiceAudio(sample)

      setProcessingProgress(70)

      const formData = new FormData()
      formData.append("username", username)
      formData.append("voice_sample", sample, "voice_verification.webm")
      formData.append("features", JSON.stringify(features))

      setProcessingProgress(90)

      const response = await fetch("/api/voice/verify", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      setProcessingProgress(100)

      return result.success
    } catch (error) {
      console.error("Voice verification failed:", error)
      return false
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }, [])

  return {
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
    registerVoice,
    verifyVoice,
  }
}
