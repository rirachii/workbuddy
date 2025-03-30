'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ChevronRight, Trash2 } from 'lucide-react';
import { useConversations } from '@/lib/hooks/useConversations';
import { formatDistanceToNow } from 'date-fns';

export default function NotesPage() {
  const { conversations, deleteConversation } = useConversations();
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedNote(expandedNote === id ? null : id);
  };

  return (
    <main className="flex min-h-screen flex-col p-4 bg-background">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Notes</h1>
        <Link href="/notes/new">
          <Button>
            <Plus size={16} className="mr-2" />
            New Recording
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {conversations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground mb-4">No notes yet. Start by recording your first note!</p>
              <Link href="/notes/new">
                <Button>
                  <Plus size={16} className="mr-2" />
                  New Recording
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          conversations.map((conversation) => (
            <Card key={conversation.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="cursor-pointer" onClick={() => toggleExpand(conversation.id)}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      Note from {formatDistanceToNow(new Date(conversation.timestamp), { addSuffix: true })}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {conversation.tasks.length} tasks identified
                    </p>
                  </div>
                  <ChevronRight
                    size={20}
                    className={`transform transition-transform ${
                      expandedNote === conversation.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </CardHeader>

              {expandedNote === conversation.id && (
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <h3 className="font-medium mb-2">Summary</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {conversation.summary}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Tasks</h3>
                    <ul className="space-y-2">
                      {conversation.tasks.map((task) => (
                        <li
                          key={task.id}
                          className={`text-sm p-2 rounded-md border ${
                            task.isPriority ? 'bg-primary/10 border-primary/20' : 'bg-muted border-muted-foreground/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <span className="font-medium">{task.text}</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                  {task.deadline}
                                </span>
                              </div>
                              {task.subtasks?.length > 0 && (
                                <ul className="mt-2 space-y-1 text-muted-foreground">
                                  {task.subtasks.map((subtask, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="text-xs">•</span>
                                      <span className="text-xs">{subtask}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {task.isPriority && (
                                <span className="inline-block mt-2 text-xs text-primary font-medium">Priority Task</span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteConversation(conversation.id)}
                      className="flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete Note
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </main>
  );
}

