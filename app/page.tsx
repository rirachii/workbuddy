"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, List, Settings, Play, Square, Trash2, Save } from "lucide-react"
import Link from "next/link"
import RecordingVisualizer from "@/components/recording-visualizer"
import { useRouter } from "next/navigation"
import { useRecorder } from "@/hooks/useRecorder"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"

export default function Home() {
  const router = useRouter()
  const {
    recordingTime,
    isRecording,
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    resetRecording,
    formatTime
  } = useRecorder()

  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Initialize audio element when audioUrl changes
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.addEventListener('ended', () => setIsPlaying(false))
      setAudioElement(audio)
      return () => {
        audio.removeEventListener('ended', () => setIsPlaying(false))
        audio.pause()
      }
    }
    return () => setAudioElement(null)
  }, [audioUrl])

  const toggleRecording = async () => {
    if (!isRecording) {
      await startRecording()
    } else {
      stopRecording()
    }
  }

  const togglePlayback = () => {
    if (!audioElement) return
    
    if (isPlaying) {
      audioElement.pause()
      setIsPlaying(false)
    } else {
      audioElement.play()
      setIsPlaying(true)
    }
  }

  const handleSave = async () => {
    if (!audioBlob) {
      toast.error("No recording to save")
      return
    }

    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const blobArray = Array.from(uint8Array);
      
      sessionStorage.setItem('currentRecording', JSON.stringify({
        blob: blobArray,
        type: audioBlob.type || 'audio/webm;codecs=opus',
        duration: recordingTime,
        timestamp: Date.now()
      }))
      
      toast.success("Recording saved successfully!")
      
      // Navigate to the processing page
      router.push("/notes/new")
    } catch (error) {
      console.error("Error saving recording:", error)
      toast.error("Error saving recording")
    }
  }

  const handleDiscard = () => {
    resetRecording()
  }

  // Display error if there's any recording error
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  // Maximum recording time (45 minutes in seconds)
  const MAX_RECORDING_TIME = 45 * 60

  // Warning when approaching max time
  useEffect(() => {
    if (isRecording && recordingTime === MAX_RECORDING_TIME - 60) {
      toast.warning("Recording will stop in 1 minute (45 minute limit)")
    }
    
    // Auto-stop at max time
    if (isRecording && recordingTime >= MAX_RECORDING_TIME) {
      stopRecording()
      toast.info("Recording stopped - maximum length reached (45 minutes)")
    }
  }, [isRecording, recordingTime, stopRecording])

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-background">
      <div className="w-full max-w-md flex flex-col items-center justify-between min-h-screen">
        <div className="w-full pt-8">
          <h1 className="text-2xl font-bold text-center mb-2">Voice Memo AI</h1>
          <p className="text-muted-foreground text-center mb-8">Record, transcribe, and organize your thoughts</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* Visualizer and timer */}
          {isRecording && (
            <>
              <div className="mb-8">
                <RecordingVisualizer isActive={true} />
              </div>
              <div className="text-2xl font-mono mb-8 text-red-500">
                {formatTime(recordingTime)}
              </div>
            </>
          )}

          {/* Audio playback controls (only shown when recording is complete) */}
          {!isRecording && audioUrl && (
            <div className="w-full mb-8">
              <Card className="p-4">
                <CardContent className="p-0 flex flex-col items-center">
                  <div className="mb-4 w-full">
                    <RecordingVisualizer isActive={isPlaying} />
                  </div>
                  <div className="text-lg font-mono mb-4">{formatTime(recordingTime)}</div>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full"
                      onClick={togglePlayback}
                    >
                      {isPlaying ? <Square size={18} /> : <Play size={18} />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full text-red-500"
                      onClick={handleDiscard}
                    >
                      <Trash2 size={18} />
                    </Button>
                    <Button 
                      variant="default" 
                      className="rounded-full flex items-center gap-2"
                      onClick={handleSave}
                    >
                      <Save size={18} />
                      Save and Process
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recording button (only shown when no recording is in progress or no audio exists) */}
          {!audioUrl && (
            <>
              <Button
                onClick={toggleRecording}
                size="lg"
                className={`rounded-full w-20 h-20 ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}`}
              >
                {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
              </Button>

              <p className="mt-4 text-muted-foreground">
                {isRecording ? "Tap to stop recording" : "Tap to start recording"}
              </p>
            </>
          )}
        </div>

        <div className="w-full pb-8 flex justify-around">
          <Link href="/notes">
            <Button variant="ghost" size="icon" className="rounded-full">
              <List />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
