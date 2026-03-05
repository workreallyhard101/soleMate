export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export type OcrConfidence = 'high' | 'medium' | 'low';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  secret_phrase_hash: string | null;
  is_admin: boolean;
  is_active: boolean;
  is_deleted: boolean;
  account_deletion_date: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  submission_date: string;
  submission_end_date: string | null;
  week_ending_date: string;
  month_key: string;
  detected_steps: number | null;
  confirmed_steps: number;
  detected_date_range: string | null;
  ocr_confidence: OcrConfidence;
  proof_file_path: string;
  status: SubmissionStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  users?: Pick<Profile, 'full_name' | 'avatar_url'>;
}

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  total_steps: number;
  weeks_submitted: number;
  rank: number;
  superstar_wins?: number;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  users?: Pick<Profile, 'full_name'>;
}

export interface RateLimit {
  id: string;
  identifier: string;
  action_type: string;
  attempts: number;
  window_start: string;
  locked_until: string | null;
}

export interface OcrResult {
  rawText: string;
  detectedSteps: number | null;
  detectedDateRange: string | null;
  confidence: OcrConfidence;
  weekEndingSunday: Date | null;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  total_submissions_this_month: number;
  pending_count: number;
  flagged_count: number;
  approved_count: number;
  current_month: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
