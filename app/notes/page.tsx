'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ChevronRight, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/supabase-auth-provider';
import { getSupabaseClient } from '@/lib/supabase/client';
import { BottomNav } from "@/components/BottomNav"

interface Todo {
  id: string;
  title: string;
  due_date: string | null;
  is_completed: boolean | null;
  memo_id: string;
  user_id: string;
  created_at: string | null;
  updated_at: string | null;
  description: string | null;
}

interface Memo {
  id: string;
  title: string;
  summary: string | null;
  created_at: string | null;
  storage_path: string | null;
  todos: Todo[];
  user_id: string;
}

export default function NotesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const toggleExpand = (id: string) => {
    setExpandedNote(expandedNote === id ? null : id);
  };

  // Fetch memos and their associated todos
  useEffect(() => {
    const fetchMemos = async () => {
      if (!user?.id) {
        if (!authLoading) {
          toast.error("Please sign in to view your notes");
        }
        return;
      }

      try {
        setIsLoading(true);
        const supabase = getSupabaseClient();
        
        // Fetch memos
        const { data: memosData, error: memosError } = await supabase
          .from('memos')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (memosError) throw memosError;

        // Fetch todos for all memos
        const { data: todosData, error: todosError } = await supabase
          .from('todos')
          .select('*')
          .eq('user_id', user.id)
          .in('memo_id', memosData.map(memo => memo.id));

        if (todosError) throw todosError;

        // Combine memos with their todos
        const memosWithTodos = memosData.map(memo => ({
          ...memo,
          todos: todosData.filter(todo => todo.memo_id === memo.id) || [],
          created_at: memo.created_at || new Date().toISOString()
        }));

        setMemos(memosWithTodos as Memo[]);
      } catch (error) {
        console.error('Error fetching memos:', error);
        toast.error('Failed to load notes');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemos();
  }, [user, authLoading]);

  const deleteMemo = async (memoId: string) => {
    try {
      const supabase = getSupabaseClient();
      
      // Delete associated todos first
      const { error: todosError } = await supabase
        .from('todos')
        .delete()
        .eq('memo_id', memoId);

      if (todosError) throw todosError;

      // Then delete the memo
      const { error: memoError } = await supabase
        .from('memos')
        .delete()
        .eq('id', memoId);

      if (memoError) throw memoError;

      // Update local state
      setMemos(memos.filter(memo => memo.id !== memoId));
      toast.success('Note deleted successfully');
    } catch (error) {
      console.error('Error deleting memo:', error);
      toast.error('Failed to delete note');
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col p-4 bg-background">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading notes...</p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 pb-20 bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">My Notes</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {memos.length} of 50 recordings used
            </p>
            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              Free Plan
            </span>
          </div>
        </div>
        <Link href="/">
          <Button>
            <Plus size={16} className="mr-2" />
            New Recording
          </Button>
        </Link>
      </div>

      {memos.length >= 45 && (
        <div className="mb-4 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold text-sm mb-2">Almost at capacity! 🎉</h3>
          <p className="text-sm text-muted-foreground">
            You're approaching the free plan limit of 50 recordings. Pro plan coming soon with unlimited recordings and advanced features!
          </p>
        </div>
      )}

      <div className="space-y-4">
        {memos.length === 0 ? (
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
          memos.map((memo) => (
            <Card key={memo.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="cursor-pointer" onClick={() => toggleExpand(memo.id)}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {memo.title || `Note from ${memo.created_at ? 
                        formatDistanceToNow(new Date(memo.created_at), { addSuffix: true }) : 
                        'Unknown date'}`}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {memo.todos.length} tasks identified
                    </p>
                  </div>
                  <ChevronRight
                    size={20}
                    className={`transform transition-transform ${
                      expandedNote === memo.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </CardHeader>

              {expandedNote === memo.id && (
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <h3 className="font-medium mb-2">Summary</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {memo.summary}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Tasks</h3>
                    <ul className="space-y-2">
                      {memo.todos.map((todo) => (
                        <li
                          key={todo.id}
                          className={`text-sm p-2 rounded-md border ${
                            todo.is_completed ? 'bg-muted border-muted-foreground/20' : 'bg-primary/10 border-primary/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{todo.title}</span>
                                  {/* Show a star or indicator for priority tasks - assuming first task is priority */}
                                  {memo.todos.indexOf(todo) === 0 && (
                                    <span className="inline-block text-xs text-primary font-medium">Priority</span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                  {todo.due_date ? formatDistanceToNow(new Date(todo.due_date), { addSuffix: true }) : 'No due date'}
                                </span>
                              </div>
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
                      onClick={() => deleteMemo(memo.id)}
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
      <BottomNav />
    </main>
  );
}

