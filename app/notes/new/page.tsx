"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Save, Loader2, Upload, Play, Pause } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { StorageService } from "@/lib/services/storage-service"
import { GeminiService } from "@/lib/services/gemini-service"
import { config } from "@/lib/config"
import { formatTimeWithHours } from "@/lib/utils"

// Enum to track the processing stages
enum ProcessingStage {
  IDLE = "idle",
  UPLOADING = "uploading",
  TRANSCRIBING = "transcribing",
  SUMMARIZING = "summarizing",
  EXTRACTING = "extracting",
  COMPLETE = "complete",
  ERROR = "error"
}

export default function NewNotePage() {
  const router = useRouter()
  
  // Processing state
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(ProcessingStage.IDLE)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // Audio data
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [cloudStorageUrl, setCloudStorageUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  
  // Processed data
  const [title, setTitle] = useState("New Recording")
  const [transcription, setTranscription] = useState<string>("")
  const [summary, setSummary] = useState<string>("")
  const [tasks, setTasks] = useState<{id: string, text: string, deadline: string}[]>([])
  
  // Services
  const storageService = new StorageService({
    projectId: config.googleCloud.projectId,
    bucketName: config.googleCloud.bucketName
  })
  
  const geminiService = new GeminiService({
    apiKey: config.gemini.apiKey,
    endpoint: config.gemini.endpoint
  })

  // Initialize audio from recording or localstorage
  useEffect(() => {
    // Attempt to retrieve recording data from localStorage or state management
    // In a real app, this might come from a state management store like Redux
    const loadAudioFromSessionStorage = () => {
      try {
        // For demo purposes, we'll check if a recording exists in localStorage
        const storedAudio = sessionStorage.getItem('currentRecording')
        
        if (storedAudio) {
          const { blob, duration } = JSON.parse(storedAudio)
          if (blob) {
            // In a real app, you'd deserialize the blob from storage
            // This is a simplified version for the demo
            const blobData = new Blob([new Uint8Array(Object.values(blob))], { type: 'audio/webm' })
            setAudioBlob(blobData)
            
            // Create a URL for audio playback
            const url = URL.createObjectURL(blobData)
            setAudioUrl(url)
            
            // Set duration if available
            if (duration) {
              setAudioDuration(duration)
            }
            
            return true
          }
        }
        return false
      } catch (error) {
        console.error("Error loading audio from storage:", error)
        return false
      }
    }
    
    // If we can't load from storage, check if there's data in the URL params
    // This would be for when the user is redirected from the recording page
    const checkUrlParams = () => {
      const params = new URLSearchParams(window.location.search)
      const recordingId = params.get('recordingId')
      
      if (recordingId) {
        // In a real app, you'd fetch the recording by ID from your database
        console.log("Recording ID from URL:", recordingId)
        // This would be where you'd load recording data by ID
      }
    }
    
    // Try to load audio from various sources
    const hasAudio = loadAudioFromSessionStorage()
    if (!hasAudio) {
      checkUrlParams()
    }
    
    // Clean up audio URL on unmount
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [])

  // Process the audio through the GCS -> Gemini flow
  const processAudio = async () => {
    if (!audioBlob) {
      toast.error("No audio recording found")
      return
    }
    
    try {
      // Reset any previous error
      setError(null)
      
      // 1. Upload to Google Cloud Storage
      setProcessingStage(ProcessingStage.UPLOADING)
      setProgress(10)
      
      const uploadResult = await storageService.uploadAudio(
        audioBlob, 
        `recording_${Date.now()}.webm`
      )
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || "Failed to upload recording")
      }
      
      setCloudStorageUrl(uploadResult.url)
      setProgress(30)
      
      // 2. Process with Gemini API
      setProcessingStage(ProcessingStage.TRANSCRIBING)
      setProgress(40)
      
      const geminiResult = await geminiService.processAudioFromUrl(uploadResult.url)
      
      // 3. Update with processing results
      setProcessingStage(ProcessingStage.SUMMARIZING)
      setProgress(70)
      setTranscription(geminiResult.transcription)
      
      setProcessingStage(ProcessingStage.EXTRACTING)
      setProgress(90)
      setSummary(geminiResult.summary)
      setTasks(geminiResult.tasks)
      
      // 4. Complete
      setProcessingStage(ProcessingStage.COMPLETE)
      setProgress(100)
      
      toast.success("Processing complete!")
      
    } catch (error) {
      console.error("Error processing audio:", error)
      setProcessingStage(ProcessingStage.ERROR)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
      toast.error("Error processing recording")
    }
  }

  // Set up audio playback functionality
  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.addEventListener('ended', () => setIsPlaying(false))
      audio.addEventListener('loadedmetadata', () => {
        setAudioDuration(Math.round(audio.duration))
      })
      
      setAudioElement(audio)
      
      return () => {
        audio.removeEventListener('ended', () => setIsPlaying(false))
        audio.pause()
      }
    }
  }, [audioUrl])

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

  // Start processing when component mounts if we have audio data
  useEffect(() => {
    if (audioBlob && processingStage === ProcessingStage.IDLE) {
      // Start processing after a short delay to allow the UI to render
      const timer = setTimeout(() => {
        processAudio()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [audioBlob, processingStage])

  const handleSave = () => {
    // In a real app, we would save the note to a database
    // along with the transcription, summary, and tasks
    toast.success("Note saved successfully!")
    
    // Clean up the audio URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    
    // Clean up localStorage
    sessionStorage.removeItem('currentRecording')
    
    router.push("/notes")
  }

  const handleManualUpload = () => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'audio/*'
    fileInput.onchange = (e) => {
      const target = e.target as HTMLInputElement
      if (target.files && target.files[0]) {
        const file = target.files[0]
        
        if (file.size > 100 * 1024 * 1024) { // 100MB limit
          toast.error("File too large. Maximum size is 100MB.")
          return
        }
        
        // Set a title based on the filename
        setTitle(file.name.replace(/\.[^/.]+$/, ""))
        
        // Create a blob and URL for the file
        const blob = file
        setAudioBlob(blob)
        
        // Revoke previous URL if exists
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl)
        }
        
        // Create a new URL for the file
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        
        // Reset processing state
        setProcessingStage(ProcessingStage.IDLE)
        setProgress(0)
        
        // Start processing
        // Process will start automatically via useEffect
      }
    }
    fileInput.click()
  }
  
  // Helper function to render the processing state message
  const getProcessingMessage = () => {
    switch (processingStage) {
      case ProcessingStage.UPLOADING:
        return "Uploading recording to secure storage..."
      case ProcessingStage.TRANSCRIBING:
        return "Transcribing audio..."
      case ProcessingStage.SUMMARIZING:
        return "Generating summary..."
      case ProcessingStage.EXTRACTING:
        return "Extracting tasks and insights..."
      case ProcessingStage.COMPLETE:
        return "Processing complete!"
      case ProcessingStage.ERROR:
        return `Error processing recording: ${error}`
      default:
        return "Preparing to process recording..."
    }
  }

  return (
    <main className="flex min-h-screen flex-col p-4 bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">New Note</h1>
        </div>
        
        {/* Manual upload button for existing audio files */}
        <Button variant="outline" size="sm" onClick={handleManualUpload}>
          <Upload size={16} className="mr-2" />
          Upload Audio
        </Button>
      </div>

      {/* Audio preview (if available and not yet processed) */}
      {audioUrl && processingStage === ProcessingStage.IDLE && (
        <Card className="w-full mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Audio Recording</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="text-lg font-mono mb-4">
              {formatTimeWithHours(audioDuration)}
            </div>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button 
              variant="default" 
              className="mt-4 w-full"
              onClick={processAudio}
            >
              Process Audio
            </Button>
          </CardContent>
        </Card>
      )}

      {processingStage !== ProcessingStage.IDLE && processingStage !== ProcessingStage.COMPLETE && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Processing your recording</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-center text-center">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <p>{getProcessingMessage()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {processingStage === ProcessingStage.COMPLETE && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Note Title
            </label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Processing Complete</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Transcription</h3>
                <p className="text-sm text-muted-foreground">
                  {transcription ? 
                    `${transcription.slice(0, 150)}...` : 
                    "Your recording has been transcribed"}
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-1">Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {summary}
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-1">Tasks</h3>
                <p className="text-sm text-muted-foreground">
                  {tasks.length > 0 ? 
                    `${tasks.length} tasks were identified with suggested deadlines` : 
                    "No tasks were identified in this recording"}
                </p>
                {tasks.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {tasks.slice(0, 2).map((task) => (
                      <li key={task.id} className="text-xs text-muted-foreground flex items-start gap-1">
                        <span>•</span>
                        <span>{task.text} (Due: {task.deadline})</span>
                      </li>
                    ))}
                    {tasks.length > 2 && (
                      <li className="text-xs text-muted-foreground">
                        <span>• And {tasks.length - 2} more tasks...</span>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="flex items-center gap-2">
              <Save size={16} />
              Save Note
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
