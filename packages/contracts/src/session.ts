export interface Session {
  session_id: string;
  expires_at: string;
}

export interface SessionData {
  id: string;
  pairing_id?: string;
  case_id?: string;
  session_data?: unknown;
  created_at: string;
  expires_at: string;
  last_accessed_at: string;
}
