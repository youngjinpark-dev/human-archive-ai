// ============================================================
// Database row types (matching Supabase schema)
// ============================================================

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface Persona {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  description: string | null;
  style: string | null;
  principles: string[];
  decision_scenarios: DecisionScenario[];
  created_at: string;
  updated_at: string;
}

export interface DecisionScenario {
  situation: string;
  decision: string;
  reasoning?: string;
}

export interface InterviewSession {
  id: string;
  persona_id: string;
  phase_index: number;
  question_index: number;
  completed: boolean;
  created_at: string;
}

export interface InterviewAnswer {
  id: string;
  session_id: string;
  phase: string;
  question: string;
  answer: string;
  extracted_data: unknown;
  created_at: string;
}

export interface Chunk {
  id: string;
  persona_id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatSession {
  id: string;
  persona_id: string;
  user_id: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface FileUpload {
  id: string;
  persona_id: string;
  file_name: string;
  file_path: string;
  transcript: string | null;
  status: "uploaded" | "transcribing" | "embedding" | "done" | "error";
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  owner: string;
  allowed_personas: string[];
  active: boolean;
  created_at: string;
}
