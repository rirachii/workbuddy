"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Save, Loader2, Play, Pause, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/components/providers/supabase-auth-provider"
import { getSupabaseClient } from "@/lib/supabase/client"
import { formatTimeWithHours } from "@/lib/utils"
import { useConversations } from '@/lib/hooks/useConversations'
import { ConversationResponse } from '@/lib/types/conversation'
import { BottomNav } from "@/components/BottomNav"
import { Badge } from "@/components/ui/badge"

// Enum to track the processing stages
enum ProcessingStage {
  IDLE = "idle",
  PROCESSING = "processing",
  COMPLETE = "complete",
  ERROR = "error"
}

// Types
interface Task {
  id: string;
  text: string;
  deadline: string;
  subtasks: string[];
  isPriority: boolean;
}

interface ProcessedData {
  id: string;
  timestamp: string;
  summary: string;
  transcription: string;
  tasks: Task[];
  priority_focus?: string;
  rawResponse: string;
}

interface Memo {
  id: string;
  user_id: string;
  title: string;
  storage_path: string | null;
  transcription: string | null;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
  content: string | null;
}

function NewNotePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const { addConversation } = useConversations()
  const processingStarted = useRef(false)
  
  // Processing state
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(ProcessingStage.IDLE)
  const [error, setError] = useState<string | null>(null)
  
  // Memo data
  const [memo, setMemo] = useState<Memo | null>(null)
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState<string>("")
  const [tasks, setTasks] = useState<Task[]>([])
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [audioDuration, setAudioDuration] = useState<number>(0)

  // Load memo when component mounts
  useEffect(() => {
    const memoId = searchParams.get('id')
    if (!memoId || !user) {
      if (!authLoading) {
        toast.error("Invalid memo ID or not signed in")
        router.push('/notes')
      }
      return
    }

    const loadMemo = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: memo, error: memoError } = await supabase
          .from("memos")
          .select()
          .eq('id', memoId)
          .single()

        if (memoError) throw memoError
        if (!memo) throw new Error("Memo not found")
        
        // Check if memo belongs to current user
        if (memo.user_id !== user.id) {
          throw new Error("Unauthorized")
        }

        // Check if we have a valid storage path
        if (!memo.storage_path) {
          throw new Error("Missing storage path for audio file")
        }

        setMemo(memo)
        setTitle(memo.title || "New Memo")
      } catch (error) {
        console.error("Error loading memo:", error)
        toast.error(error instanceof Error ? error.message : "Failed to load memo")
        router.push('/notes')
      }
    }

    loadMemo()
  }, [searchParams, user, authLoading, router])

  // Initialize audio player in a separate effect
  useEffect(() => {
    if (!memo?.storage_path) return

    const initAudio = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error: signedUrlError } = await supabase
          .storage
          .from('voice-memos')
          .createSignedUrl(memo.storage_path!, 3600) // 1 hour expiry

        if (signedUrlError || !data) throw new Error('Failed to get signed URL for audio file')

        const audio = new Audio(data.signedUrl)
        
        const handleEnded = () => setIsPlaying(false)
        const handleMetadata = () => setAudioDuration(Math.round(audio.duration))
        
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('loadedmetadata', handleMetadata)
        setAudioElement(audio)
      } catch (error) {
        console.error("Error initializing audio:", error)
        toast.error("Failed to initialize audio player")
      }
    }

    initAudio()
  }, [memo?.storage_path])

  // Handle already processed memos
  useEffect(() => {
    if (!memo || !memo.summary) return
    
    setSummary(memo.summary)
    setProcessingStage(ProcessingStage.COMPLETE)
        
    // Load existing todos
    const loadTodos = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: todos, error: todosError } = await supabase
          .from("todos")
          .select("*")
          .eq('memo_id', memo.id)
        
        if (!todosError && todos) {
          // Convert todos to tasks format
          const loadedTasks: Task[] = todos.map((todo: any) => ({
            id: todo.id,
            text: todo.title,
            deadline: todo.due_date || "No deadline",
            subtasks: [],
            isPriority: false // Will set the first one as priority below
          }))
          
          // Set the first task as priority
          if (loadedTasks.length > 0) {
            loadedTasks[0].isPriority = true
          }
          
          setTasks(loadedTasks)
        }
      } catch (error) {
        console.error("Error loading todos:", error)
      }
    }
    
    loadTodos()
  }, [memo])
  
  // Start processing for new memos
  useEffect(() => {
    if (!memo || processingStarted.current || memo.summary || memo.transcription) return
    
    const triggerProcessing = () => {
      processingStarted.current = true
      setProcessingStage(ProcessingStage.PROCESSING)
      
      // Use setTimeout to break the call stack
      setTimeout(() => {
        processAudio(memo).catch(error => {
          console.error("Error in processing:", error)
          setProcessingStage(ProcessingStage.ERROR)
          setError(error instanceof Error ? error.message : "Unknown processing error")
          processingStarted.current = false
          
          // Add a fallback task when processing fails
          const fallbackTask: Task = {
            id: crypto.randomUUID(),
            text: "Review this recording",
            deadline: "End of week",
            subtasks: [],
            isPriority: true
          };
          
          // Set a default summary and task
          setSummary("Processing failed. Please add a summary manually.")
          setTasks([fallbackTask])
          
          // Still mark as complete so user can edit manually
          setProcessingStage(ProcessingStage.COMPLETE)
          
          toast.error("Automatic processing failed. You can edit tasks manually.")
        })
      }, 10)
    }
    
    triggerProcessing()
  }, [memo])

  const processAudio = async (memo: Memo) => {
    // Don't call this function if already processing
    if (!memo || !memo.storage_path || !user) {
      throw new Error('Invalid memo or user data')
    }

    try {
      console.log("Processing audio for memo:", memo.id)
      
      // Check recording count
      const supabase = getSupabaseClient()
      const { count: recordingCount, error: countError } = await supabase
        .from('memos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (countError) {
        throw new Error('Failed to check recording count')
      }

      if (recordingCount && recordingCount >= 50) {
        throw new Error('You have reached the maximum limit of 50 recordings for the beta version. Pro version coming soon!')
      }
      
      // Fetch previous memos with their summaries and todos (limit to 3 instead of 5 to reduce data)
      const { data: previousMemos, error: memosError } = await supabase
        .from('memos')
        .select(`
          id,
          summary,
          created_at,
          todos (
            id,
            title,
            due_date,
            is_completed
          )
        `)
        .eq('user_id', user.id)
        .neq('id', memo.id) // Exclude current memo
        .order('created_at', { ascending: false })
        .limit(3) // Reduced from 5 to 3 to minimize payload

      if (memosError) {
        throw new Error('Failed to fetch conversation history')
      }

      // Format previous memos into conversations - with simplified approach
      const previousConversations = previousMemos.map(memo => {
        const tasks = (memo.todos || []).map(todo => ({
          id: todo.id,
          text: todo.title,
          deadline: todo.due_date || 'No deadline set',
          isPriority: false,
          subtasks: []
        }))
        
        // Set first task as priority if it exists
        if (tasks.length > 0) {
          tasks[0].isPriority = true
        }
        
        return {
          id: memo.id,
          timestamp: memo.created_at || new Date().toISOString(),
          summary: memo.summary || '',
          tasks: tasks
        }
      })

      // Get authentication session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No active session - please sign in again')
      }

      console.log('Starting request to edge function...')
      const response = await fetch('https://ragulxwhrwzzeifoqilx.supabase.co/functions/v1/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          filePath: memo.storage_path,
          previousConversations
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Edge function error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Parse the JSON response - handle potential errors
      let data: ProcessedData
      try {
        data = await response.json()
      } catch (e) {
        console.error("Error parsing response:", e)
        throw new Error("Failed to parse server response")
      }
      
      if (!data || !data.summary) {
        throw new Error('Invalid response from server')
      }
      
      // Transform tasks to our application format with simplified error handling
      let transformedTasks: Task[] = []
      
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        transformedTasks = data.tasks.map((task: any) => ({
          id: task.id || crypto.randomUUID(),
          text: task.text || "Untitled task",
          deadline: task.deadline || "End of week",
          subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
          isPriority: task.text === data.priority_focus
        }))
      } else {
        // Create a default task if none returned
        transformedTasks = [{
          id: crypto.randomUUID(),
          text: "Review this recording",
          deadline: "End of week",
          subtasks: [],
          isPriority: true
        }]
      }

      const processedData: ProcessedData = {
        id: data.id || `session_${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        summary: data.summary,
        transcription: data.transcription || '',
        tasks: transformedTasks,
        priority_focus: data.priority_focus,
        rawResponse: JSON.stringify(data)
      }
      
      // Update UI state first to prevent blocking
      setSummary(processedData.summary)
      setTasks(processedData.tasks)
      setProcessingStage(ProcessingStage.COMPLETE)
      
      // Then save to database in the background
      await handleProcessingResults(processedData, memo)
    } catch (error) {
      console.error("Error processing audio:", error)
      setProcessingStage(ProcessingStage.ERROR)
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string'
          ? error
          : 'An unknown error occurred'
      setError(errorMessage)
      toast.error(`Error processing recording: ${errorMessage}`)
      throw error // rethrow to allow caller to handle
    }
  }

  // Helper function to parse relative dates into timestamps
  const parseRelativeDate = (dateStr: string): string => {
    const now = new Date()
    const lowercaseStr = dateStr.toLowerCase()
    
    // Handle common relative date formats
    if (lowercaseStr.includes('end of')) {
      if (lowercaseStr.includes('week')) {
        const endOfWeek = new Date(now)
        endOfWeek.setDate(now.getDate() + (7 - now.getDay()))
        endOfWeek.setHours(23, 59, 59, 999)
        return endOfWeek.toISOString()
      }
      if (lowercaseStr.includes('day')) {
        const endOfDay = new Date(now)
        endOfDay.setHours(23, 59, 59, 999)
        return endOfDay.toISOString()
      }
      if (lowercaseStr.includes('month')) {
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        return endOfMonth.toISOString()
      }
    }
    
    if (lowercaseStr.includes('tomorrow')) {
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)
      tomorrow.setHours(23, 59, 59, 999)
      return tomorrow.toISOString()
    }
    
    if (lowercaseStr.includes('next week')) {
      const nextWeek = new Date(now)
      nextWeek.setDate(now.getDate() + 7)
      nextWeek.setHours(23, 59, 59, 999)
      return nextWeek.toISOString()
    }
    
    // Handle "in X days/weeks/months"
    const inMatch = lowercaseStr.match(/in\s+(\d+)\s+(day|week|month|hour)s?/)
    if (inMatch) {
      const amount = parseInt(inMatch[1])
      const unit = inMatch[2]
      const future = new Date(now)
      
      if (unit === 'day') {
        future.setDate(now.getDate() + amount)
      } else if (unit === 'week') {
        future.setDate(now.getDate() + (amount * 7))
      } else if (unit === 'month') {
        future.setMonth(now.getMonth() + amount)
      } else if (unit === 'hour') {
        future.setHours(now.getHours() + amount)
      }
      
      future.setHours(23, 59, 59, 999)
      return future.toISOString()
    }
    
    // Handle day names (next Monday, Tuesday, etc.)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    for (let i = 0; i < dayNames.length; i++) {
      if (lowercaseStr.includes(dayNames[i])) {
        const targetDay = i
        const current = now.getDay()
        const daysToAdd = (targetDay + 7 - current) % 7
        
        // If today is the target day and we just say "Monday", we mean next Monday
        const daysOffset = (daysToAdd === 0 && !lowercaseStr.includes('this')) ? 7 : daysToAdd
        
        const futureDate = new Date(now)
        futureDate.setDate(now.getDate() + daysOffset)
        futureDate.setHours(23, 59, 59, 999)
        return futureDate.toISOString()
      }
    }
    
    // Try to parse as a specific date
    const specificDate = new Date(dateStr)
    if (!isNaN(specificDate.getTime())) {
      return specificDate.toISOString()
    }
    
    // Default to end of current day if we can't parse
    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)
    console.log(`Could not parse date "${dateStr}", defaulting to end of today:`, endOfToday.toISOString())
    return endOfToday.toISOString()
  }

  const handleProcessingResults = async (data: ProcessedData, memo: Memo) => {
    try {
      const supabase = getSupabaseClient()

      // Update the memo with processing results
      const { error: updateError } = await supabase
        .from('memos')
        .update({
          summary: data.summary,
          transcription: data.transcription || '',
          raw_response: data.rawResponse,
          processed_at: new Date().toISOString()
        })
        .eq('id', memo.id)

      if (updateError) {
        console.error("Error updating memo:", updateError)
        throw updateError
      }

      // Create tasks
      if (data.tasks && data.tasks.length > 0 && user?.id) {
        const tasksToInsert = data.tasks.map(task => ({
          memo_id: memo.id,
          title: task.text,
          due_date: task.deadline,
          is_priority: task.isPriority || false,
          is_completed: false,
          user_id: user.id,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        const { error: tasksError } = await supabase
          .from('todos')
          .insert(tasksToInsert)

        if (tasksError) {
          console.error("Error inserting tasks:", tasksError)
          throw tasksError
        }
      }

      // Delete the audio file from storage after successful processing
      if (memo.storage_path) {
        const { error: deleteError } = await supabase
          .storage
          .from('voice-memos')
          .remove([memo.storage_path])

        if (deleteError) {
          console.error("Error deleting audio file:", deleteError)
          // Don't throw here - we don't want to fail the whole operation if deletion fails
          toast.error("Note saved but couldn't delete temporary audio file")
        }
      }

      // Cast ProcessedData to ConversationResponse
      const conversation: ConversationResponse = {
        id: data.id,
        timestamp: data.timestamp,
        summary: data.summary,
        transcription: data.transcription || '',
        tasks: data.tasks,
        rawResponse: data.rawResponse
      }
      
      addConversation(conversation)
      toast.success("Processing complete!")
      
    } catch (error) {
      console.error("Error in handleProcessingResults:", error)
      // Don't throw here - we don't want to show errors to the user for background operations
      // The UI is already updated with the data
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
    if (!memo) return

    try {
      const supabase = getSupabaseClient()
      
      // Set a valid transcription if it failed (for DB constraints)
      const transcription = memo.transcription || "No automatic transcription available"
      
      // Update memo title and summary
      const { error: updateError } = await supabase
        .from("memos")
        .update({ 
          title,
          summary,
          transcription
        })
        .eq('id', memo.id)

      if (updateError) throw updateError

      // Delete existing todos for this memo
      const { error: deleteTodosError } = await supabase
        .from("todos")
        .delete()
        .eq('memo_id', memo.id)

      if (deleteTodosError) throw deleteTodosError

      // Create updated todos - make sure there's at least one if empty
      const tasksToSave = tasks.length > 0 ? tasks : [{
        id: crypto.randomUUID(),
        text: "Review this recording",
        deadline: "End of week",
        subtasks: [],
        isPriority: true
      }];
      
      const todosToInsert = tasksToSave.map((task) => {
        if (!user?.id) {
          throw new Error('User not found')
        }
        
        // Handle potentially invalid dates gracefully
        let parsedDeadline;
        try {
          parsedDeadline = parseRelativeDate(task.deadline)
        } catch (e) {
          // Use tomorrow if parsing fails
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(23, 59, 59, 999)
          parsedDeadline = tomorrow.toISOString()
        }
        
        return {
          user_id: user.id,
          memo_id: memo.id,
          title: task.text || "Untitled task",
          due_date: parsedDeadline,
          is_completed: false,
        }
      })

      const { error: todosError } = await supabase
        .from("todos")
        .insert(todosToInsert)

      if (todosError) throw todosError

      // Update the conversation in local storage
      const conversation: ConversationResponse = {
        id: memo.id,
        timestamp: memo.created_at || new Date().toISOString(),
        summary: summary,
        transcription: transcription,
        tasks: tasksToSave,
        rawResponse: JSON.stringify({
          id: memo.id,
          timestamp: memo.created_at,
          summary: summary,
          transcription: transcription,
          tasks: tasksToSave
        })
      }
      
      addConversation(conversation)

      toast.success("Memo saved successfully!")
      router.push("/notes")
    } catch (error) {
      console.error("Error saving memo:", error)
      toast.error("Failed to save memo")
    }
  }

  return (
    <main className="container max-w-4xl py-4 pb-20 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/notes" className="flex items-center gap-2">
          <ArrowLeft size={20} />
          Back to Notes
        </Link>
      </div>

      <BetaNotice />

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
                {error ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">Automatic processing failed. You can enter a summary manually:</p>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      className="w-full p-2 border rounded-md min-h-[100px]"
                      placeholder="Enter your summary here..."
                    />
                  </div>
                ) : (
                  <p className="text-muted-foreground">{summary}</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Tasks</h3>
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <div key={task.id} className="p-3 border rounded-md">
                      <div className="grid gap-3">
                        <div>
                          <label htmlFor={`task-${index}`} className="text-sm font-medium mb-1 block">
                            Task
                          </label>
                          <Input
                            id={`task-${index}`}
                            value={task.text}
                            onChange={(e) => {
                              const updatedTasks = [...tasks];
                              updatedTasks[index] = { ...task, text: e.target.value };
                              setTasks(updatedTasks);
                            }}
                          />
                        </div>
                        <div>
                          <label htmlFor={`deadline-${index}`} className="text-sm font-medium mb-1 block">
                            Deadline
                          </label>
                          <Input
                            id={`deadline-${index}`}
                            value={task.deadline}
                            onChange={(e) => {
                              const updatedTasks = [...tasks];
                              updatedTasks[index] = { ...task, deadline: e.target.value };
                              setTasks(updatedTasks);
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              id={`priority-${index}`} 
                              checked={task.isPriority}
                              onChange={(e) => {
                                const updatedTasks = [...tasks];
                                updatedTasks[index] = { ...task, isPriority: e.target.checked };
                                setTasks(updatedTasks);
                              }}
                              className="h-4 w-4"
                            />
                            <label htmlFor={`priority-${index}`} className="text-sm">
                              Priority task
                            </label>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const updatedTasks = [...tasks];
                              updatedTasks.splice(index, 1);
                              setTasks(updatedTasks);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      const newTask: Task = {
                        id: crypto.randomUUID(),
                        text: "",
                        deadline: "End of week",
                        subtasks: [],
                        isPriority: false
                      };
                      setTasks([...tasks, newTask]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add new task
                  </Button>
                </div>
              </div>
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
      <BottomNav />
    </main>
  )
}

const BetaNotice = () => {
  return (
    <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">BETA</Badge>
        <span className="text-sm text-muted-foreground">
          Free for up to 50 recordings during beta
        </span>
      </div>
      <Badge variant="outline" className="text-muted-foreground">
        Pro version coming soon
      </Badge>
    </div>
  )
}

export default function NewNotePage() {
  return (
    <Suspense fallback={
      <main className="container max-w-4xl py-4 pb-20 space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/notes" className="flex items-center gap-2">
            <ArrowLeft size={20} />
            Back to Notes
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="h-10 animate-pulse bg-muted rounded" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 w-3/4 animate-pulse bg-muted rounded" />
              <div className="h-4 w-1/2 animate-pulse bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
        <BottomNav />
      </main>
    }>
      <NewNotePageContent />
    </Suspense>
  )
}
