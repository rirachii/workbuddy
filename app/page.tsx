"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, List, Settings, Play, Square, Trash2, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/components/providers/supabase-auth-provider"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useRecorder } from "@/hooks/useRecorder"
import { convertToMp3, needsConversion } from "@/lib/utils/audio-converter"
import { AuthModal } from "@/components/auth-modal"
import { BottomNav } from "@/components/BottomNav"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import dynamic from "next/dynamic"

// Dynamically import AudioSphere with no SSR
const AudioSphere = dynamic<any>(() => import("@/components/AudioSphere"), { ssr: false })

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
  const { user, isLoading } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const supabase = getSupabaseClient()
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)
  const [audioData, setAudioData] = useState<Float32Array>()
  const analyserRef = useRef<AnalyserNode>()
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    // Show auth modal if user is not signed in and not loading
    if (!isLoading && !user) {
      setShowAuthModal(true)
    } else {
      setShowAuthModal(false)
    }
  }, [user, isLoading])

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

  useEffect(() => {
    // Check if it's the first visit
    const hasVisited = localStorage.getItem('ghosted_ai_visited')
    if (!hasVisited) {
      setShowWelcomeDialog(true)
      localStorage.setItem('ghosted_ai_visited', 'true')
    }
  }, [])

  // Recording time limits (in seconds)
  const MIN_RECORDING_TIME = 5 * 60
  const MAX_RECORDING_TIME = 30 * 60

  // Warning for recording time limits
  useEffect(() => {
    if (isRecording) {
      // Warning when approaching max time
      if (recordingTime === MAX_RECORDING_TIME - 60) {
        toast.warning("Recording will stop in 1 minute (30 minute limit)")
      }
      
      // Auto-stop at max time
      if (recordingTime >= MAX_RECORDING_TIME) {
        stopRecording()
        toast.info("Recording stopped - maximum length reached (30 minutes)")
      }
    }
  }, [isRecording, recordingTime, stopRecording])

  // Check minimum recording time when stopping
  const handleStopRecording = () => {
    if (recordingTime < MIN_RECORDING_TIME) {
      toast.warning("Please record for at least 5 minutes to get meaningful feedback")
    }
    stopRecording()
  }

  const toggleRecording = async () => {
    if (!isRecording) {
      await startRecording()
    } else {
      handleStopRecording()
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
    if (!user || !audioBlob) {
      toast.error("Please sign in and record audio first")
      return
    }

    // Add file size validation
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (audioBlob.size > MAX_FILE_SIZE) {
      toast.error("Recording is too large. Maximum size is 100MB")
      return
    }

    // Add file type validation
    const allowedTypes = ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp3'];
    if (!allowedTypes.includes(audioBlob.type)) {
      toast.error("Invalid audio format")
      return
    }

    try {
      setIsSaving(true)

      // Convert to MP3 if needed
      let finalBlob: Blob;
      try {
        finalBlob = needsConversion(audioBlob) 
          ? await convertToMp3(audioBlob)
          : audioBlob;
      } catch (error) {
        console.error("Error converting audio:", error);
        throw new Error("Failed to convert audio recording. Please try again.");
      }
      
      // Generate unique filename
      const timestamp = new Date().getTime()
      const filename = `${timestamp}-${user.id}.mp3`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("voice-memos")
        .upload(`${user.id}/${filename}`, finalBlob, {
          contentType: "audio/mp3",
          cacheControl: "3600",
        })

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to upload audio file: " + uploadError.message);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("voice-memos")
        .getPublicUrl(`${user.id}/${filename}`)

      // Create initial memo with just the audio URL
      const { data: memo, error: memoError } = await supabase
        .from("memos")
        .insert({
          user_id: user.id,
          title: `Voice Memo ${new Date().toLocaleString()}`,
          storage_path: `${user.id}/${filename}`,
        })
        .select()
        .single()

      if (memoError) {
        console.error("Memo creation error:", memoError);
        throw new Error("Failed to create memo: " + memoError.message);
      }

      if (!memo) {
        throw new Error("Failed to create memo: No data returned");
      }

      toast.success("Recording saved! Processing your audio...")
      resetRecording()
      
      // Redirect to the new note page with the memo ID
      router.push(`/notes/new?id=${memo.id}`)
    } catch (error) {
      console.error("Error saving recording:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
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

  // Initialize audio analyzer when recording starts
  useEffect(() => {
    if (isRecording) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      // Get microphone stream
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const source = audioContext.createMediaStreamSource(stream)
          source.connect(analyser)

          // Start analyzing audio
          const dataArray = new Float32Array(analyser.frequencyBinCount)
          const updateData = () => {
            analyser.getFloatTimeDomainData(dataArray)
            setAudioData(dataArray)
            animationFrameRef.current = requestAnimationFrame(updateData)
          }
          updateData()
        })
        .catch(err => {
          console.error("Error accessing microphone:", err)
          toast.error("Could not access microphone")
        })

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        audioContext.close()
      }
    }
  }, [isRecording])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin">
          <Loader2 className="h-8 w-8" />
        </div>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pb-20 bg-background">
      {showAuthModal && <AuthModal isOpen={showAuthModal} onOpenChange={setShowAuthModal} />}
      
      <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Welcome to Ghosted AI 👋</DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <p>
                We understand job searching can be tough and sometimes frustrating. 
                Ghosted AI is your safe space to:
              </p>
              <ul className="list-disc pl-4 space-y-2">
                <li>Vent about your job search experiences (5-30 minutes)</li>
                <li>Share your interview stories, rejections, or ghosting experiences</li>
                <li>Talk through your career concerns and challenges</li>
              </ul>
              <p className="font-medium pt-2">
                After each recording, our AI will:
              </p>
              <ul className="list-disc pl-4 space-y-2">
                <li>Provide empathetic, constructive feedback</li>
                <li>Identify patterns in your job search</li>
                <li>Suggest specific next steps and actions</li>
                <li>Help track your progress over time</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWelcomeDialog(false)}>
              Got it, let's start!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-md flex flex-col items-center justify-between min-h-[calc(100vh-5rem)]">
        <div className="w-full pt-8">
          <h1 className="text-2xl font-bold text-center mb-2">Ghosted AI</h1>
          <p className="text-muted-foreground text-center mb-8">Your AI companion for navigating the tough job market</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* Audio Sphere */}
          <div className="mb-8 w-full">
            <AudioSphere isRecording={isRecording} audioData={audioData} />
          </div>

          {/* Timer */}
          {isRecording && (
            <div className="text-2xl font-mono mb-8 text-red-500">
              {formatTime(recordingTime)}
            </div>
          )}

          {/* Audio playback controls */}
          {!isRecording && audioUrl && (
            <div className="w-full mb-8">
              <Card className="p-4">
                <CardContent className="p-0 flex flex-col items-center">
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
                    <div className="flex flex-col items-center gap-2">
                      <Button 
                        variant="default" 
                        className="rounded-full flex items-center gap-2"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        Save and Process
                      </Button>
                      {isSaving && (
                        <div className="flex flex-col items-center text-sm text-muted-foreground animate-pulse">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                          </div>
                          <p className="mt-2">Converting and uploading your recording...</p>
                          <p className="text-xs mt-1">Please don't refresh the page</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recording button */}
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
      </div>
      <BottomNav />
    </main>
  )
}
