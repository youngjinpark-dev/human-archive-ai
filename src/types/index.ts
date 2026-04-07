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

// ============================================================
// Store types
// ============================================================

export interface StoreListing {
  id: string;
  persona_id: string;
  seller_id: string;
  title: string;
  subtitle: string | null;
  description: string;
  category: string;
  tags: string[];
  thumbnail_url: string | null;
  price_krw: number;
  is_free: boolean;
  quality_score: Record<string, unknown>;
  status: "draft" | "pending_review" | "active" | "suspended" | "archived";
  view_count: number;
  trial_count: number;
  purchase_count: number;
  rating_avg: number;
  rating_count: number;
  is_high_risk: boolean;
  revenue_split_seller: number;
  created_at: string;
  updated_at: string;
}

export interface TrialSession {
  id: string;
  listing_id: string;
  user_id: string | null;
  ip_address: string | null;
  fingerprint: string | null;
  messages_today: number;
  personas_today: string[];
  trial_date: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  buyer_id: string;
  listing_id: string;
  persona_id: string;
  seller_id: string;
  amount_krw: number;
  payment_method: string | null;
  toss_payment_key: string | null;
  toss_order_id: string | null;
  status: "pending" | "confirmed" | "failed" | "refunded" | "cancelled";
  seller_amount: number | null;
  platform_amount: number | null;
  settled: boolean;
  settled_at: string | null;
  created_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

// ============================================================
// Judgment Framework types
// ============================================================

export interface JudgmentFramework {
  id: string;
  persona_id: string;
  philosophy: string | null;
  domains: string[];
  version: number;
  status: "building" | "ready" | "archived";
  created_at: string;
  updated_at: string;
}

export interface JudgmentAxis {
  id: string;
  framework_id: string;
  name: string;
  description: string | null;
  weight: number;
  domain: string | null;
  evidence_count: number;
  created_at: string;
}

export interface IfThenPattern {
  id: string;
  framework_id: string;
  condition: string;
  action: string;
  reasoning: string | null;
  axis_id: string | null;
  confidence: number;
  source_type: "interview" | "audio" | "manual";
  source_id: string | null;
  created_at: string;
}

export interface ExperienceStory {
  id: string;
  framework_id: string;
  title: string;
  summary: string;
  context: string;
  decision: string;
  outcome: string | null;
  lesson: string | null;
  related_axes: string[];
  embedding?: number[];
  source_type: "interview" | "audio" | "manual";
  source_id: string | null;
  created_at: string;
}

export type QuestionIntent =
  | "explore_why"
  | "explore_how"
  | "explore_what_if"
  | "discover_story"
  | "cross_validate"
  | "confirm";

export interface ExtractionResult {
  newAxes: { name: string; description: string; weight: number; domain: string | null }[];
  reinforcedAxes: { axisName: string; newEvidence: string }[];
  newPatterns: { condition: string; action: string; reasoning: string }[];
  newStories: {
    title: string;
    summary: string;
    context: string;
    decision: string;
    outcome: string | null;
    lesson: string | null;
  }[];
}

export interface FrameworkData {
  framework: JudgmentFramework;
  axes: JudgmentAxis[];
  patterns: IfThenPattern[];
}
