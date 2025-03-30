"use client"

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Play, Pause, Calendar, Clock, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useConversations } from '@/lib/hooks/useConversations';
import { Conversation } from '@/lib/types/conversation';
import { formatDistanceToNow } from 'date-fns';

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const { conversations, deleteConversation } = useConversations();
  const [note, setNote] = useState<Conversation | null>(null);

  useEffect(() => {
    const noteId = params.id as string;
    const foundNote = conversations.find(conv => conv.id === noteId);
    if (foundNote) {
      setNote(foundNote);
    }
  }, [params.id, conversations]);

  const handleDelete = () => {
    if (note) {
      deleteConversation(note.id);
      router.push('/notes');
    }
  };

  if (!note) {
    return (
      <main className="flex min-h-screen flex-col p-4 bg-background">
        <div className="flex items-center mb-6">
          <Link href="/notes">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Note not found</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/notes">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            Note from {formatDistanceToNow(new Date(note.timestamp), { addSuffix: true })}
          </h1>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="flex items-center gap-2"
        >
          <Trash2 size={14} />
          Delete Note
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{note.summary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {note.tasks.map((task) => (
                <li
                  key={task.id}
                  className={`p-3 rounded-md border ${
                    task.isPriority ? 'bg-primary/10 border-primary/20' : 'bg-muted border-muted-foreground/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{task.text}</p>
                      {task.subtasks?.length > 0 && (
                        <ul className="mt-2 space-y-1 text-muted-foreground">
                          {task.subtasks.map((subtask, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-sm">•</span>
                              <span className="text-sm">{subtask}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {task.isPriority && (
                        <span className="inline-block mt-2 text-xs text-primary font-medium">Priority Task</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {task.deadline}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

