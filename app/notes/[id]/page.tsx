"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Play, Pause, Calendar, Clock, Send } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

// Mock data for demo purposes
const mockNoteDetails = {
  "1": {
    title: "Weekly Team Meeting",
    date: "March 29, 2025",
    duration: "12:34",
    transcription: `
      Hello team, let's go over our agenda for today. First, we need to discuss the Q2 goals and how we're tracking against our KPIs. 
      
      Sarah, can you give us an update on the marketing campaign? Great, so we're seeing a 15% increase in engagement compared to last quarter. 
      
      Next, let's talk about the upcoming product launch. John, what's the status on the development timeline? 
      
      OK, so we're on track for the May 15th launch date. We need to ensure the documentation is ready by April 30th.
      
      Action items: 
      1. Sarah to finalize the marketing assets by next Friday
      2. John to provide a detailed development update by Wednesday
      3. I'll schedule a follow-up meeting with the client for next Monday
      4. Everyone should review the launch plan by end of week
    `,
    summary:
      "Discussed Q2 goals and KPI tracking. Marketing campaign showing 15% increase in engagement. Product launch on track for May 15th. Documentation needed by April 30th. Action items assigned to team members with specific deadlines.",
    tasks: [
      { id: "t1", text: "Sarah to finalize marketing assets", deadline: "April 5, 2025" },
      { id: "t2", text: "John to provide development update", deadline: "April 3, 2025" },
      { id: "t3", text: "Schedule follow-up client meeting", deadline: "April 1, 2025" },
      { id: "t4", text: "Team to review launch plan", deadline: "March 31, 2025" },
    ],
  },
  "2": {
    title: "Project Brainstorming",
    date: "March 28, 2025",
    duration: "08:21",
    transcription: `
      Let's brainstorm ideas for the new mobile app design. I'm thinking we should focus on user experience first.
      
      The main pain points from our user research are navigation complexity and form completion on mobile devices.
      
      What if we implement a step-by-step wizard for complex tasks? And maybe use biometric authentication to simplify the login process?
      
      For accessibility, we should ensure high contrast options and voice navigation capabilities.
      
      Key features to include:
      - Simplified navigation with bottom tabs
      - Progressive disclosure for complex forms
      - Dark mode and high contrast options
      - Voice commands for common actions
      - Haptic feedback for interactions
    `,
    summary:
      "Brainstormed mobile app design focusing on UX improvements. Identified navigation complexity and form completion as key pain points. Proposed solutions include step-by-step wizards, biometric authentication, and enhanced accessibility features like high contrast options and voice navigation.",
    tasks: [
      { id: "t1", text: "Create wireframes for simplified navigation", deadline: "April 10, 2025" },
      { id: "t2", text: "Research biometric authentication options", deadline: "April 7, 2025" },
      { id: "t3", text: "Develop accessibility guidelines", deadline: "April 15, 2025" },
    ],
  },
  "3": {
    title: "Client Call - Acme Corp",
    date: "March 27, 2025",
    duration: "15:47",
    transcription: `
      Hello John, thanks for taking my call. I wanted to discuss the current project status and timeline.
      
      As we discussed last time, we need to have the first phase completed by the end of Q2. Are we still on track for that?
      
      Great. Now, regarding the budget, we've allocated an additional $25,000 for the enhanced features you proposed. Can you provide a breakdown of how that will be used?
      
      I see. And when can we expect to see the updated proposal with the timeline and budget details?
      
      Perfect. Let's plan for a follow-up meeting after we review the proposal. I'll also need you to prepare a presentation for our board meeting on April 20th.
      
      Before we wrap up, any other concerns or questions you'd like to address?
    `,
    summary:
      "Client requested updates on project timeline and budget. First phase deadline confirmed for end of Q2. Additional $25,000 allocated for enhanced features. Need to prepare detailed proposal with timeline and budget breakdown by next Friday. Client also requested a presentation for their April 20th board meeting.",
    tasks: [
      { id: "t1", text: "Prepare updated proposal with timeline", deadline: "April 5, 2025" },
      { id: "t2", text: "Create budget breakdown for enhanced features", deadline: "April 3, 2025" },
      { id: "t3", text: "Develop board presentation", deadline: "April 18, 2025" },
    ],
  },
  new: {
    title: "New Recording",
    date: "March 29, 2025",
    duration: "02:15",
    transcription: `
      Reminder to follow up with the design team about the new website mockups. We need to finalize the homepage layout by Wednesday.
      
      Also, don't forget to schedule the quarterly review meeting with the finance department. It should happen before April 15th.
      
      Ideas for the team building event:
      - Cooking class
      - Escape room
      - Outdoor adventure day
      
      Need to book something by the end of next week.
    `,
    summary:
      "Reminder to follow up with design team about website mockups, with homepage layout due by Wednesday. Schedule quarterly review with finance before April 15th. Team building event ideas include cooking class, escape room, or outdoor adventure day. Booking deadline is end of next week.",
    tasks: [
      { id: "t1", text: "Follow up with design team", deadline: "April 1, 2025" },
      { id: "t2", text: "Schedule finance department review", deadline: "April 10, 2025" },
      { id: "t3", text: "Book team building event", deadline: "April 5, 2025" },
    ],
  },
}

export default function NotePage() {
  const params = useParams()
  const noteId = params.id as string
  const note = mockNoteDetails[noteId as keyof typeof mockNoteDetails]

  const [isPlaying, setIsPlaying] = useState(false)
  const [question, setQuestion] = useState("")
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([])

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
    // In a real app, we would control audio playback here
  }

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    // In a real app, we would use AI to generate an answer based on the transcription
    // For demo purposes, we'll use predefined answers
    let answer = ""

    if (question.toLowerCase().includes("deadline") || question.toLowerCase().includes("due")) {
      answer =
        "Based on your notes, the homepage layout is due by Wednesday, April 2nd. The quarterly review needs to be scheduled before April 15th."
    } else if (question.toLowerCase().includes("team building") || question.toLowerCase().includes("event")) {
      answer =
        "You mentioned three team building options: a cooking class, an escape room, or an outdoor adventure day. You need to book this by the end of next week (April 5th)."
    } else if (question.toLowerCase().includes("design") || question.toLowerCase().includes("mockup")) {
      answer =
        "You need to follow up with the design team about the website mockups, specifically to finalize the homepage layout by Wednesday."
    } else {
      answer =
        "I found this information in your notes: You need to follow up with the design team, schedule a quarterly review with finance, and book a team building event soon."
    }

    setAnswers([...answers, { question, answer }])
    setQuestion("")
  }

  if (!note) {
    return <div>Note not found</div>
  }

  return (
    <main className="flex min-h-screen flex-col p-4 bg-background">
      <div className="flex items-center mb-4">
        <Link href="/notes">
          <Button variant="ghost" size="icon" className="mr-2">
            <ArrowLeft />
          </Button>
        </Link>
        <h1 className="text-xl font-bold truncate">{note.title}</h1>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar size={14} className="mr-1" />
          {note.date}
          <span className="mx-1">•</span>
          <Clock size={14} className="mr-1" />
          {note.duration}
        </div>

        <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={togglePlayback}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? "Pause" : "Play"}
        </Button>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-0">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm">{note.summary}</p>
            </CardContent>
          </Card>

          <div className="mt-6">
            <h2 className="text-lg font-medium mb-3">Ask about this note</h2>
            <form onSubmit={handleQuestionSubmit} className="flex gap-2">
              <Input
                placeholder="Ask a question about this note..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Send size={18} />
              </Button>
            </form>

            <div className="mt-4 space-y-4">
              {answers.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="bg-secondary p-3 rounded-lg text-sm">
                    <p className="font-medium">You asked:</p>
                    <p>{item.question}</p>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-lg text-sm">
                    <p className="font-medium">AI response:</p>
                    <p>{item.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transcript" className="mt-0">
          <Card>
            <CardContent className="pt-4">
              <pre className="text-sm whitespace-pre-wrap font-sans">{note.transcription}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Extracted Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {note.tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2">
                    <input type="checkbox" id={task.id} className="mt-1" />
                    <div>
                      <label htmlFor={task.id} className="text-sm font-medium">
                        {task.text}
                      </label>
                      <p className="text-xs text-muted-foreground">Due: {task.deadline}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}

