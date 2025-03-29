import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Clock, Calendar, Tag } from "lucide-react"
import Link from "next/link"

// Mock data for demo purposes
const mockNotes = [
  {
    id: "1",
    title: "Weekly Team Meeting",
    date: "March 29, 2025",
    duration: "12:34",
    summary:
      "Discussed Q2 goals, marketing strategy, and upcoming product launch. Action items assigned to team members.",
    tags: ["meeting", "team", "planning"],
  },
  {
    id: "2",
    title: "Project Brainstorming",
    date: "March 28, 2025",
    duration: "08:21",
    summary: "Generated ideas for the new mobile app design. Focus on user experience and accessibility features.",
    tags: ["brainstorming", "design", "app"],
  },
  {
    id: "3",
    title: "Client Call - Acme Corp",
    date: "March 27, 2025",
    duration: "15:47",
    summary: "Client requested timeline updates and budget review. Need to prepare proposal by next Friday.",
    tags: ["client", "call", "proposal"],
  },
  {
    id: "new",
    title: "New Recording",
    date: "March 29, 2025",
    duration: "02:15",
    summary: "Your recording has been transcribed and summarized. Tap to view details.",
    tags: ["new"],
  },
]

export default function NotesPage() {
  return (
    <main className="flex min-h-screen flex-col p-4 bg-background">
      <div className="flex items-center mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" className="mr-2">
            <ArrowLeft />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Your Notes</h1>
      </div>

      <div className="grid gap-4">
        {mockNotes.map((note) => (
          <Link href={`/notes/${note.id}`} key={note.id}>
            <Card className={note.id === "new" ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <CardTitle>{note.title}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Calendar size={14} />
                  {note.date}
                  <span className="mx-1">•</span>
                  <Clock size={14} />
                  {note.duration}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm text-muted-foreground line-clamp-2">{note.summary}</p>
              </CardContent>
              <CardFooter>
                <div className="flex flex-wrap gap-1">
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full flex items-center"
                    >
                      <Tag size={10} className="mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}

