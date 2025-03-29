"use client"

import { useState, useEffect, useCallback } from "react"
import { VoiceRecorder } from "@/lib/voice-recorder"

export function useVoiceRecorder() {
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    // Initialize recorder
    const voiceRecorder = new VoiceRecorder()
    setRecorder(voiceRecorder)

    // Cleanup function
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } else if (interval) {
      clearInterval(interval)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isRecording])

  const startRecording = useCallback(async () => {
    if (!recorder) return

    try {
      await recorder.startRecording()
      setIsRecording(true)
      setRecordingTime(0)
      setAudioBlob(null)
      setAudioUrl(null)
    } catch (error) {
      console.error("Failed to start recording:", error)
    }
  }, [recorder])

  const stopRecording = useCallback(async () => {
    if (!recorder || !recorder.isRecording()) return

    try {
      const blob = await recorder.stopRecording()
      const url = URL.createObjectURL(blob)

      setIsRecording(false)
      setAudioBlob(blob)
      setAudioUrl(url)

      return { blob, url }
    } catch (error) {
      console.error("Failed to stop recording:", error)
      setIsRecording(false)
    }
  }, [recorder])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }, [])

  return {
    isRecording,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    formatTime,
  }
}

