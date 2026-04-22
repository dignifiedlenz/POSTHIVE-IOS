// ===== NOTIFICATIONS =====
export type NotificationType =
  | 'comment_added'
  | 'comment_reply'
  | 'comment_mention'
  | 'comment_resolved'
  | 'version_uploaded'
  | 'version_signed_off'
  | 'deliverable_created'
  | 'deliverable_status_changed'
  | 'deliverable_due_soon'
  | 'deliverable_overdue'
  | 'todo_assigned'
  | 'todo_due_soon'
  | 'todo_overdue'
  | 'todo_completed'
  | 'project_created'
  | 'project_deadline_approaching'
  | 'project_assigned'
  | 'workspace_invite'
  | 'workspace_member_joined'
  | 'dropzone_file_uploaded'
  | 'transfer_downloaded'
  | 'transcription_completed'
  | 'upload_completed';

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  project_id?: string;
  deliverable_id?: string;
  version_id?: string;
  comment_id?: string;
  todo_id?: string;
  actor_id?: string;
  seen_at?: string;
  read_at?: string;
  created_at: string;
}

// ===== TODOS =====
export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Todo {
  id: string;
  workspace_id: string;
  project_id?: string;
  deliverable_id?: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date?: string;
  due_time?: string;
  estimated_minutes?: number;
  assigned_to?: string;
  assigned_name?: string;
  created_by: string;
  completed_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
  deliverable_name?: string;
  is_private?: boolean;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority: TodoPriority;
  due_date?: string;
  due_time?: string;
  estimated_minutes?: number;
  assigned_to?: string;
  project_id?: string;
  deliverable_id?: string;
  is_private?: boolean;
}

// ===== DELIVERABLES =====
export type DeliverableType =
  | 'video'
  | 'image'
  | 'pdf'
  | 'audio'
  | 'document'
  | 'image_gallery';
export type DeliverableStatus = 'draft' | 'review' | 'approved' | 'final';

export interface Deliverable {
  id: string;
  project_id: string;
  project_name?: string;
  name: string;
  description?: string;
  type: DeliverableType;
  status: DeliverableStatus;
  due_date?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  current_version?: number;
  unread_comment_count?: number;
  comment_count?: number;
  /** image_gallery: counts from gallery_items + assets (dashboard RPC). */
  photo_count?: number;
  video_count?: number;
  latest_version?: Version;
}

export interface Version {
  id: string;
  deliverable_id: string;
  version_number: number;
  /** Resolved playback URL for the player (Cloudflare/Bunny HLS when available, otherwise CDN/storage). */
  file_url: string;
  thumbnail_url?: string;
  uploaded_at: string;
  status?: string;
  /** Storage backend identifier — e.g. 'cloudflare', 'bunny', 'b2', 'r2'. */
  provider?: string;
  /** Cloudflare Stream / Bunny Stream HLS manifest URL (raw, before fallbacks). */
  playback_url?: string;
  // Playback URLs (resolved from asset)
  bunny_cdn_url?: string;
  processing_status?: string;
  // Storage URLs for downloads (original files)
  storage_url?: string;
}

// ===== COMMENTS =====
export interface CommentAuthor {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  content: string;
  author: CommentAuthor;
  created_at: string;
  start_time?: number;
  end_time?: number;
  timestamp?: number;
  version_number: number;
  completed?: boolean;
  completed_by?: string;
  completed_at?: string;
  parent_id?: string;
  replies?: Comment[];
  is_client_comment?: boolean;
}

// ===== PROJECTS =====
export interface ProjectClient {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  status: 'active' | 'completed' | 'archived';
  due_date?: string;
  created_at: string;
  updated_at: string;
  deliverable_count?: number;
  client?: ProjectClient;
  client_name?: string;
}

// ===== WORKSPACE =====
export type WorkspaceTier = 'free' | 'team' | 'pro' | 'enterprise';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  role?: string;
  tier?: WorkspaceTier;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

// ===== AUTH =====
export interface AuthState {
  user: User | null;
  session: Session | null;
  workspace: Workspace | null;
  loading: boolean;
  error: string | null;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: User;
}

// ===== CLIENTS =====
export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  company?: string;
  email?: string;
  created_at: string;
}

// ===== CREATE INPUTS =====
export type ProjectType = 'photo' | 'video' | 'mixed';

export interface CreateProjectInput {
  name: string;
  description?: string;
  deadline?: string; // YYYY-MM-DD
  client_id?: string;
  project_type?: ProjectType;
}

export interface CreateDeliverableInput {
  name: string;
  description?: string;
  type: DeliverableType;
  due_date?: string; // YYYY-MM-DD (not required for image_gallery)
  due_time?: string; // HH:mm
}

export interface CreateEventInput {
  title: string;
  description?: string;
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  is_all_day?: boolean;
  location?: string;
  meeting_link?: string;
  project_id?: string;
  visibility?: 'workspace' | 'private';
}

// ===== CALENDAR EVENTS =====
export interface CalendarEvent {
  id: string;
  workspace_id: string;
  source_type: 'google' | 'posthive';
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string | null;
  meeting_link: string | null;
  calendar_name: string | null;
  calendar_color: string | null;
  created_by: string | null;
  project_id: string | null;
  visibility?: 'workspace' | 'private';
}

// ===== SERIES =====
export interface Series {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  created_at: string;
  updated_at?: string;
  created_by: string;
  item_count: number;
}

// ===== WORKSPACE MEMBERS =====
export interface WorkspaceMember {
  user_id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

// ===== DRIVE =====
export interface DriveAsset {
  id: string;
  name: string;
  display_name?: string;
  type: string;
  file_size?: number | null;
  mime_type?: string | null;
  parent_folder_id?: string | null;
  folder_path?: string | null;
  folder_color?: string | null;
  is_folder: boolean;
  bunny_cdn_url?: string | null;
  playback_url?: string | null;
  storage_url?: string | null;
  storage_path?: string | null;
  provider?: string | null;
  uploaded_at?: string;
  tags?: string[] | null;
  processing_status?: string | null;
}

