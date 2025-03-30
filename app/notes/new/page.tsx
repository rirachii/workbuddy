"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Save, Loader2, Play, Pause } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/context/AuthContext"
import { formatTimeWithHours } from "@/lib/utils"
import { useConversations } from '@/lib/hooks/useConversations'
import { ConversationResponse } from '@/lib/types/conversation'

// Enum to track the processing stages
enum ProcessingStage {
  IDLE = "idle",
  PROCESSING = "processing",
  COMPLETE = "complete",
  ERROR = "error"
}

interface Memo {
  id: string
  user_id: string
  title: string
  audio_url: string
  transcription?: string
  summary?: string
}

export default function NewNotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session } = useAuth()
  const { addConversation } = useConversations()
  const processingStarted = useRef(false)
  
  // Processing state
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(ProcessingStage.IDLE)
  const [error, setError] = useState<string | null>(null)
  
  // Memo data
  const [memo, setMemo] = useState<Memo | null>(null)
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState<string>("")
  const [tasks, setTasks] = useState<{id: string, text: string, deadline: string}[]>([])
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [audioDuration, setAudioDuration] = useState<number>(0)

  // Load memo when component mounts
  useEffect(() => {
    const memoId = searchParams.get('id')
    if (!memoId || !session) {
      toast.error("Invalid memo ID or not signed in")
      router.push('/notes')
      return
    }

    const loadMemo = async () => {
      try {
        const { data: memo, error: memoError } = await supabase
          .from("memos")
          .select()
          .eq('id', memoId)
          .single()

        if (memoError) throw memoError
        if (!memo) throw new Error("Memo not found")
        
        // Check if memo belongs to current user
        if (memo.user_id !== session.user.id) {
          throw new Error("Unauthorized")
        }

        // Check if we have a valid storage path
        if (!memo.storage_path) {
          throw new Error("Missing storage path for audio file")
        }

        setMemo(memo)
        setTitle(memo.title)

        // Initialize audio player with signed URL
        const { data, error: signedUrlError } = await supabase
          .storage
          .from('voice-memos')
          .createSignedUrl(memo.storage_path, 3600) // 1 hour expiry

        if (signedUrlError || !data) throw new Error('Failed to get signed URL for audio file')

        const audio = new Audio(data.signedUrl)
        audio.addEventListener('ended', () => setIsPlaying(false))
        audio.addEventListener('loadedmetadata', () => {
          setAudioDuration(Math.round(audio.duration))
        })
        setAudioElement(audio)

        // Start processing if not already processed and not already started
        if (!memo.transcription && !memo.summary && !processingStarted.current) {
          processingStarted.current = true
          processAudio(memo)
        }

        return () => {
          audio.removeEventListener('ended', () => setIsPlaying(false))
          audio.pause()
        }
      } catch (error) {
        console.error("Error loading memo:", error)
        toast.error(error instanceof Error ? error.message : "Failed to load memo")
        router.push('/notes')
      }
    }

    loadMemo()
  }, [searchParams, session, router])

  const processAudio = async (memo: any) => {
    // Prevent multiple processing attempts
    if (processingStage === ProcessingStage.PROCESSING) {
      return;
    }

    try {
      console.log("Starting audio processing for memo:", memo.id);
      setProcessingStage(ProcessingStage.PROCESSING);
      
      // Ensure we have a valid session
      if (!session) {
        throw new Error('Please sign in to process audio');
      }

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          filePath: memo.storage_path,
          previousConversations: []
        })
      });

      console.log("API response status:", response.status);

      // Get the error response first if not ok
      if (!response.ok) {
        const errorData = await response.json().catch(e => ({ error: 'Failed to parse error response' }));
        console.error("API error response:", errorData);
        
        // If unauthorized, try to refresh the session once
        if (response.status === 401) {
          console.log("Attempting session refresh...");
          const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !newSession) {
            throw new Error('Session expired - Please sign in again');
          }
          
          // Retry the request once with the new session
          console.log("Retrying request with new session...");
          const retryResponse = await fetch('/api/process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newSession.access_token}`
            },
            credentials: 'include',
            body: JSON.stringify({
              filePath: memo.storage_path,
              previousConversations: []
            })
          });

          if (!retryResponse.ok) {
            const retryErrorData = await retryResponse.json().catch(e => ({ error: 'Failed to parse retry error response' }));
            console.error("Retry API error response:", retryErrorData);
            throw new Error(retryErrorData.error || `Failed to process audio after session refresh: ${retryResponse.status}`);
          }

          const data = await retryResponse.json();
          console.log("Retry API response data:", data);
          return handleProcessingResults(data, memo);
        }
        
        // Throw the error from the server
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json().catch(e => {
        console.error("Failed to parse API response:", e);
        throw new Error('Failed to parse API response');
      });
      
      console.log("API response data:", data);

      // Validate the response data with specific error messages
      if (!data) {
        throw new Error('Empty response from server');
      }
      
      if (typeof data.summary !== 'string') {
        throw new Error('Invalid or missing summary in server response');
      }
      
      if (!Array.isArray(data.tasks)) {
        throw new Error('Invalid or missing tasks array in server response');
      }
      
      if (data.tasks.length === 0) {
        throw new Error('No tasks returned from server');
      }
      
      // Validate basic task structure from Gemini
      const invalidTask = data.tasks.find(
        (task: any) => !task.text || typeof task.text !== 'string' || 
        !task.deadline || typeof task.deadline !== 'string'
      );
      
      if (invalidTask) {
        console.error('Invalid task from Gemini:', invalidTask);
        throw new Error('Invalid task structure in Gemini response');
      }

      // Transform tasks to our application format
      const priorityFocus = data.priority_focus;
      const transformedTasks = data.tasks.map((task: any) => ({
        id: crypto.randomUUID(), // Add unique ID
        text: task.text,
        deadline: task.deadline,
        subtasks: [], // Initialize empty subtasks
        isPriority: task.text === priorityFocus // Mark as priority if matches priority_focus
      }));

      // Update the data object with transformed tasks
      const processedData = {
        ...data,
        tasks: transformedTasks,
        id: `session_${Date.now()}`,
        timestamp: new Date().toISOString()
      };
      
      console.log("Transformed data:", processedData);
      await handleProcessingResults(processedData, memo);
    } catch (error) {
      console.error("Error processing audio:", error);
      setProcessingStage(ProcessingStage.ERROR);
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string'
          ? error
          : 'An unknown error occurred';
      setError(errorMessage);
      toast.error(`Error processing recording: ${errorMessage}`);
    }
  };

  // Helper function to parse relative dates into timestamps
  const parseRelativeDate = (dateStr: string): string => {
    const now = new Date();
    const lowercaseStr = dateStr.toLowerCase();
    
    // Handle common relative date formats
    if (lowercaseStr.includes('end of')) {
      if (lowercaseStr.includes('week')) {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        return endOfWeek.toISOString();
      }
      if (lowercaseStr.includes('day')) {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay.toISOString();
      }
      if (lowercaseStr.includes('month')) {
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return endOfMonth.toISOString();
      }
    }
    
    if (lowercaseStr.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      return tomorrow.toISOString();
    }
    
    if (lowercaseStr.includes('next week')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);
      return nextWeek.toISOString();
    }
    
    // Try to parse as a specific date
    const specificDate = new Date(dateStr);
    if (!isNaN(specificDate.getTime())) {
      return specificDate.toISOString();
    }
    
    // Default to end of current day if we can't parse
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    console.log(`Could not parse date "${dateStr}", defaulting to end of today:`, endOfToday.toISOString());
    return endOfToday.toISOString();
  };

  // Helper function to handle processing results
  const handleProcessingResults = async (data: any, memo: any) => {
    try {
      console.log("Processing results with data:", data);
      console.log("Memo:", memo);

      // Update memo with processing results
      const { error: updateError } = await supabase
        .from("memos")
        .update({
          transcription: data.transcription || '',
          summary: data.summary,
        })
        .eq('id', memo.id);

      if (updateError) {
        console.error("Error updating memo:", updateError);
        throw new Error(`Failed to update memo: ${updateError.message}`);
      }

      // Create todos if tasks were extracted
      if (data.tasks && data.tasks.length > 0) {
        console.log("Creating todos:", data.tasks);
        
        const todosToInsert = data.tasks.map((task: any) => {
          if (!session?.user.id) {
            throw new Error('User session not found');
          }
          
          // Parse the deadline into a proper timestamp
          const parsedDeadline = parseRelativeDate(task.deadline);
          console.log(`Parsed deadline "${task.deadline}" to:`, parsedDeadline);
          
          return {
            user_id: session.user.id,
            memo_id: memo.id,
            title: task.text,
            due_date: parsedDeadline,
            is_completed: false,
          };
        });

        console.log("Inserting todos:", todosToInsert);

        const { error: todosError } = await supabase
          .from("todos")
          .insert(todosToInsert);

        if (todosError) {
          console.error("Error creating todos:", todosError);
          throw new Error(`Failed to create todos: ${todosError.message}`);
        }
      }

      setSummary(data.summary);
      setTasks(data.tasks);
      
      // Type check the data before adding to conversations
      if (!data.id || !data.timestamp || !Array.isArray(data.tasks)) {
        throw new Error('Invalid conversation data structure');
      }
      
      addConversation(data as ConversationResponse);
      
      setProcessingStage(ProcessingStage.COMPLETE);
      toast.success("Processing complete!");
    } catch (error) {
      console.error("Error in handleProcessingResults:", error);
      throw error instanceof Error ? error : new Error('Failed to process results');
    }
  };

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
    if (!memo) return

    try {
      // Update memo title
      const { error: updateError } = await supabase
        .from("memos")
        .update({ title })
        .eq('id', memo.id)

      if (updateError) throw updateError

      toast.success("Memo saved successfully!")
      router.push("/notes")
    } catch (error) {
      console.error("Error saving memo:", error)
      toast.error("Failed to save memo")
    }
  }

  return (
    <main className="container max-w-4xl py-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/notes" className="flex items-center gap-2">
          <ArrowLeft size={20} />
          Back to Notes
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Audio Player */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlayback}
              disabled={!audioElement}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </Button>
            <div className="text-sm text-muted-foreground">
              {formatTimeWithHours(audioDuration)}
            </div>
          </div>

          {/* Processing Status */}
          {processingStage === ProcessingStage.PROCESSING && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing your audio...
            </div>
          )}

          {/* Results */}
          {processingStage === ProcessingStage.COMPLETE && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-muted-foreground">{summary}</p>
              </div>

              {tasks.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Tasks</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {tasks.map(task => (
                      <li key={task.id} className="text-muted-foreground">
                        {task.text} (Due: {task.deadline})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {processingStage === ProcessingStage.ERROR && (
            <div className="text-red-500">
              Error processing audio: {error}
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={processingStage === ProcessingStage.PROCESSING}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
