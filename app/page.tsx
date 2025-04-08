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

// IndexedDB setup
const DB_NAME = 'audioBackupDB';
const STORE_NAME = 'audioFiles';
const DB_VERSION = 1;

async function initDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveToIndexedDB(key: string, blob: Blob) {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, key);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getFromIndexedDB(key: string): Promise<Blob | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromIndexedDB(key: string) {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

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
  const MAX_RECORDING_TIME = 10 * 60 // 10 minutes

  // Warning for recording time limits
  useEffect(() => {
    if (isRecording) {
      // Warning when approaching max time
      if (recordingTime === MAX_RECORDING_TIME - 60) {
        toast.warning("Recording will stop in 1 minute (10 minute limit)")
      }
      
      // Auto-stop at max time
      if (recordingTime >= MAX_RECORDING_TIME) {
        stopRecording()
        toast.info("Recording stopped - maximum length reached (10 minutes)")
      }
    }
  }, [isRecording, recordingTime, stopRecording])

  // Check minimum recording time when stopping
  const handleStopRecording = () => {
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

    try {
      setIsSaving(true)

      // Generate unique filename early for both backup and upload
      const timestamp = new Date().getTime()
      const filename = `${timestamp}-${user.id}.mp3`
      const backupKey = `backup-${filename}`

      // Log original audio details
      console.log('Original audio:', {
        size: audioBlob.size,
        type: audioBlob.type,
        needsConversion: needsConversion(audioBlob)
      });

      // Convert to MP3 if needed
      let finalBlob: Blob;
      try {
        if (needsConversion(audioBlob)) {
          console.log('Converting audio to MP3...');
          finalBlob = await convertToMp3(audioBlob);
          console.log('Conversion complete:', {
            originalSize: audioBlob.size,
            convertedSize: finalBlob.size,
            convertedType: finalBlob.type
          });
        } else {
          console.log('Audio is already MP3, no conversion needed');
          finalBlob = audioBlob;
        }

        // Save to IndexedDB as backup
        console.log('Saving backup to IndexedDB...');
        await saveToIndexedDB(backupKey, finalBlob);
        console.log('Backup saved successfully');

      } catch (error) {
        console.error("Error in conversion or backup:", error);
        throw new Error("Failed to process audio recording. Please try again.");
      }

      console.log('Uploading to Supabase:', {
        filename,
        size: finalBlob.size,
        type: finalBlob.type
      });

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

      // Delete backup after successful upload
      try {
        await deleteFromIndexedDB(backupKey);
        console.log('Backup deleted successfully');
      } catch (deleteError) {
        console.warn('Failed to delete backup, but upload was successful:', deleteError);
      }

      toast.success("Recording saved! Processing your audio...")
      resetRecording()
      
      // Redirect to the new note page with the memo ID
      router.push(`/notes/new?id=${memo.id}`)
    } catch (error) {
      console.error("Error saving recording:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(errorMessage)
      
      // If there was an error, let the user know their recording is backed up
      toast.info("Don't worry! Your recording is safely backed up in your browser.")
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

  // Add cleanup function for old backups
  useEffect(() => {
    const cleanupOldBackups = async () => {
      try {
        const db = await initDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        
        request.onsuccess = async () => {
          const keys = request.result as string[];
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          
          for (const key of keys) {
            // Extract timestamp from key format: backup-{timestamp}-{userId}.mp3
            const timestamp = parseInt(key.split('-')[1]);
            if (timestamp < oneDayAgo) {
              await deleteFromIndexedDB(key);
              console.log('Deleted old backup:', key);
            }
          }
        };
      } catch (error) {
        console.warn('Failed to cleanup old backups:', error);
      }
    };

    cleanupOldBackups();
  }, []);

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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Welcome to Ghosted AI 👋</DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Free Plan Features:</h3>
                <ul className="list-disc pl-4 space-y-2">
                  <li>Up to 50 voice memos during beta</li>
                  <li>10-minute maximum recording duration</li>
                  <li>Basic AI analysis of your job search experiences</li>
                  <li>Simple todo task management</li>
                  <li>Basic voice memo organization</li>
                </ul>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-semibold text-base mb-3">Pro Plan - Coming Soon! 🚀</h3>
                  <ul className="list-disc pl-4 space-y-2">
                    <li>Unlimited voice memos</li>
                    <li>Extended recording duration (up to 1 hour)</li>
                    <li>Advanced AI analysis and insights</li>
                    <li>Calendar integration for job search tracking</li>
                    <li>Export capabilities (PDF, Audio formats)</li>
                    <li>Priority support</li>
                  </ul>
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                  Start with our free plan today and get early access to pro features when they launch!
                </p>
              </div>
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
        <h1 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
            Ghosted AI
            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              Beta
            </span>
          </h1>          
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
