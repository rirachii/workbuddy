import { Database } from './types'
import { createClient } from '@/lib/supabase'

type Memo = Database['public']['Tables']['memos']['Insert']
type MemoRow = Database['public']['Tables']['memos']['Row']
type Todo = Database['public']['Tables']['todos']['Insert']
type TodoRow = Database['public']['Tables']['todos']['Row']

// Memo functions
export async function createMemo(memo: Omit<Memo, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await createClient()
    .from('memos')
    .insert(memo)
    .select()
    .single()
  
  if (error) throw error
  return data as MemoRow
}

export async function getMemos(userId: string) {
  const { data, error } = await createClient()
    .from('memos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as MemoRow[]
}

export async function getMemoById(id: string) {
  const { data, error } = await createClient()
    .from('memos')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as MemoRow
}

export async function updateMemo(id: string, updates: Partial<MemoRow>) {
  const { data, error } = await createClient()
    .from('memos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as MemoRow
}

export async function deleteMemo(id: string) {
  const { error } = await createClient()
    .from('memos')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// Todo functions
export async function createTodo(todo: Omit<Todo, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await createClient()
    .from('todos')
    .insert(todo)
    .select()
    .single()
  
  if (error) throw error
  return data as TodoRow
}

export async function getTodos(userId: string) {
  const { data, error } = await createClient()
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as TodoRow[]
}

export async function getTodosByMemoId(memoId: string) {
  const { data, error } = await createClient()
    .from('todos')
    .select('*')
    .eq('memo_id', memoId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as TodoRow[]
}

export async function updateTodo(id: string, updates: Partial<TodoRow>) {
  const { data, error } = await createClient()
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as TodoRow
}

export async function deleteTodo(id: string) {
  const { error } = await createClient()
    .from('todos')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function toggleTodoComplete(id: string, isCompleted: boolean) {
    const { data, error } = await createClient()
    .from('todos')
    .update({ is_completed: isCompleted })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as TodoRow
} 