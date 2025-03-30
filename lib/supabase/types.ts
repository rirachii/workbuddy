export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      memos: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string | null
          audio_url: string | null
          transcription: string | null
          summary: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content?: string | null
          audio_url?: string | null
          transcription?: string | null
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string | null
          audio_url?: string | null
          transcription?: string | null
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      todos: {
        Row: {
          id: string
          user_id: string
          memo_id: string | null
          title: string
          description: string | null
          is_completed: boolean
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          memo_id?: string | null
          title: string
          description?: string | null
          is_completed?: boolean
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          memo_id?: string | null
          title?: string
          description?: string | null
          is_completed?: boolean
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 