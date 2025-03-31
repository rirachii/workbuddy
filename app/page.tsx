"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, List, Settings, Play, Square, Trash2, Save } from "lucide-react"
import Link from "next/link"
import RecordingVisualizer from "@/components/recording-visualizer"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/components/providers/supabase-auth-provider"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { useRecorder } from "@/hooks/useRecorder"
import { convertToMp3, needsConversion } from "@/lib/utils/audio-converter"
import { AuthModal } from "@/components/auth-modal"
import { BottomNav } from "@/components/BottomNav"

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
    if (!user || !audioBlob) {
      toast.error("Please sign in and record audio first")
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
      <div className="w-full max-w-md flex flex-col items-center justify-between min-h-[calc(100vh-5rem)]">
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
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
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
      <BottomNav />
    </main>
  )
}
