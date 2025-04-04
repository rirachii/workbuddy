"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Play, Square, Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { useUser } from "@/components/providers/supabase-provider"
import { createClient } from "@/lib/supabase"
import { useRecorder } from "@/hooks/useRecorder"
import { convertToMp3, needsConversion } from "@/lib/utils/audio-converter"
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
import AuthModal from "@/components/auth-modal"
import { saveToIndexedDB, getFromIndexedDB, deleteFromIndexedDB } from "@/lib/utils/indexedDB"

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
  const userContext = useUser()
  const user = userContext?.user
  const [isSaving, setIsSaving] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const supabase = createClient()
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)
  const [audioData, setAudioData] = useState<Float32Array>()
  const analyserRef = useRef<AnalyserNode>()
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    // Show auth modal if user is not signed in and userContext is loaded
    if (userContext !== null && !user) {
      setShowAuthModal(true)
    } else {
      setShowAuthModal(false)
    }
  }, [user, userContext])

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

    setIsSaving(true)
    try {
      // Save to IndexedDB as backup
      const backupKey = `backup_${Date.now()}`
      await saveToIndexedDB(backupKey, audioBlob)

      // Convert to MP3 if needed
      let finalBlob = audioBlob
      if (needsConversion(audioBlob)) {
        finalBlob = await convertToMp3(audioBlob)
      }

      // Upload to Supabase Storage
      const fileName = `recording_${Date.now()}.mp3`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(`${user.id}/${fileName}`, finalBlob, {
          contentType: 'audio/mpeg',
          cacheControl: '3600'
        })

      if (uploadError) throw uploadError

      // Create record in recordings table
      const { error: dbError } = await supabase
        .from('recordings')
        .insert({
          user_id: user.id,
          file_path: uploadData.path,
          duration: recordingTime,
          status: 'pending'
        })

      if (dbError) throw dbError

      // Clean up backup from IndexedDB
      await deleteFromIndexedDB(backupKey)

      toast.success("Recording saved successfully!")
      router.push('/recordings')
    } catch (error) {
      console.error('Error saving recording:', error)
      toast.error("Failed to save recording. Your recording is backed up locally.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    resetRecording()
  }

  // Audio visualization setup
  useEffect(() => {
    if (!audioElement) return

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)

    const source = audioContext.createMediaElementSource(audioElement)
    source.connect(analyser)
    analyser.connect(audioContext.destination)

    analyserRef.current = analyser

    const updateData = () => {
      if (!analyserRef.current) return
      analyserRef.current.getFloatFrequencyData(dataArray)
      setAudioData(new Float32Array(dataArray))
      animationFrameRef.current = requestAnimationFrame(updateData)
    }

    updateData()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      audioContext.close()
    }
  }, [audioElement])

  // If userContext is null, show loading state
  if (userContext === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 pb-20 bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pb-20 bg-background">
      {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />}
      
      <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome to Ghosted AI</DialogTitle>
            <DialogDescription>
              Record your dating app conversations and get AI feedback on what went wrong and how to improve.
              <br /><br />
              To get started:
              <ol className="list-decimal list-inside mt-2">
                <li>Record yourself reading your conversation</li>
                <li>Include both sides of the chat</li>
                <li>Record for at least 5 minutes</li>
                <li>Get personalized feedback and tips</li>
              </ol>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWelcomeDialog(false)}>Get Started</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-64 h-64">
                <AudioSphere audioData={audioData} isRecording={isRecording} />
              </div>
              
              <div className="text-2xl font-bold">
                {formatTime(recordingTime)}
              </div>

              <div className="flex space-x-4">
                {!audioUrl ? (
                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    onClick={toggleRecording}
                  >
                    {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={togglePlayback}
                    >
                      {isPlaying ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={handleDiscard}
                    >
                      <Trash2 className="h-6 w-6" />
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </main>
  )
}
