export type Visibility = "private" | "shared" | "capsule";
export type Profile = {
  id: string;
  display_name: string;
  timezone: string;
  preferences: Record<string, string | boolean>;
};
export type Task = {
  id: string;
  space_id: string;
  created_by: string;
  assignee_id: string | null;
  title: string;
  description: string;
  due_on: string;
  status: string;
  reported_percent: number;
  verified_percent: number;
  rejections: number;
  created_at: string;
};
export type Progress = {
  id: string;
  task_id: string;
  reported_by: string;
  reported_percent: number;
  note: string;
  state: string;
  created_at: string;
};
export type Verification = {
  id: string;
  progress_id: string;
  verifier_id: string;
  decision: string;
  verified_percent: number;
  reason: string;
  created_at: string;
};
export type EntryKind =
  | "journal"
  | "mood"
  | "date"
  | "goal"
  | "watch"
  | "wish"
  | "track"
  | "transaction"
  | "budget"
  | "trip";
export type Entry = {
  id: string;
  space_id: string;
  owner_id: string;
  kind: EntryKind;
  title: string;
  visibility: Visibility;
  status: string;
  occurred_on: string;
  unlock_at: string | null;
  amount: number | null;
  progress: number;
  details: Record<string, string | number | boolean>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  entry_bodies: { content: string } | null;
};
export type CalendarEvent = {
  id: string;
  space_id: string;
  owner_id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  visibility: Visibility;
  kind: string;
  annual: boolean;
  sync_google: boolean;
  version: number;
  deleted_at: string | null;
};
export type Photo = {
  id: string;
  space_id: string;
  uploaded_by: string;
  title: string;
  storage_path: string;
  thumb_path: string;
  captured_at: string;
  uploaded_at: string;
  visibility: Visibility;
  trip_id: string | null;
  size_bytes: number;
  deleted_at: string | null;
};
export type Notification = {
  id: string;
  recipient_id: string;
  title: string;
  kind: string;
  path: string;
  read_at: string | null;
  created_at: string;
};
export type Question = { id: string; category: string; title: string };
export type Answer = {
  id: string;
  question_id: string;
  respondent_id: string;
  answer: string;
};
export type Snapshot = {
  profiles: Profile[];
  tasks: Task[];
  task_progress: Progress[];
  task_verifications: Verification[];
  entries: Entry[];
  calendar_events: CalendarEvent[];
  photos: Photo[];
  notifications: Notification[];
  questions: Question[];
  answers: Answer[];
};
