export interface Task {
  id: string;
  text: string;
  deadline: string;
  subtasks: string[];
  isPriority: boolean;
}

export interface Conversation {
  id: string;
  timestamp: string;
  summary: string;
  tasks: Task[];
  rawResponse: string;
}

export interface ConversationResponse extends Conversation {
  transcription: string; // Kept for backwards compatibility
} 