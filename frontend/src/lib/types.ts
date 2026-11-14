export type Visibility = "shared" | "capsule";
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
  completed_at?: string | null;
};
/** A recorded change to a task: carried to another day (with its reason) or edited. */
export type TaskEvent = {
  id: string;
  task_id: string;
  /** null when the scheduler carried the task by itself. */
  actor_id: string | null;
  kind: "postpone" | "edit" | "carry" | "discard" | "restore" | "progress";
  from_date: string | null;
  to_date: string | null;
  reason: string;
  changes: Record<string, unknown>;
  created_at: string;
};
/** A fixed income, expense or saving that creates its movement on each date. */
export type FinanceRecurring = {
  id: string;
  space_id: string;
  created_by: string;
  title: string;
  amount: number;
  direction: "income" | "expense" | "saving";
  category: string;
  frequency: "weekly" | "biweekly" | "monthly" | "yearly";
  start_on: string;
  end_on: string | null;
  next_on: string;
  active: boolean;
  deleted_at: string | null;
  /** null: de los dos. */
  person?: string | null;
  goal_id?: string | null;
};
/** Something we save for, alone or together. */
export type SavingsGoal = {
  id: string;
  space_id: string;
  created_by: string;
  title: string;
  target: number;
  target_on: string | null;
  /** null: a goal for both of us. */
  person: string | null;
  deleted_at: string | null;
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
  calendar_event_id?: string | null;
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
export type EntryReaction = {
  entry_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
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
  recurrence?: string[];
  recurrence_timezone?: string;
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
export type Question = {
  id: string;
  category: string;
  title: string;
  depth?: number;
  source_id?: string | null;
  bank_key?: string | null;
  /** null for the shared bank; set for questions we wrote. */
  space_id?: string | null;
  deleted_at?: string | null;
};
export type Answer = {
  id: string;
  question_id: string;
  respondent_id: string;
  answer: string;
};
export type Snapshot = {
  calendar_overrides: {
    event_id: string;
    google_event_id: string;
    original_start: string;
    start_at: string | null;
    end_at: string | null;
    title: string | null;
    cancelled: boolean;
  }[];
  profiles: Profile[];
  tasks: Task[];
  task_progress: Progress[];
  task_verifications: Verification[];
  task_events: TaskEvent[];
  finance_recurring: FinanceRecurring[];
  savings_goals: SavingsGoal[];
  question_hidden: { space_id: string; question_id: string }[];
  entries: Entry[];
  entry_reactions: EntryReaction[];
  calendar_events: CalendarEvent[];
  photos: Photo[];
  notifications: Notification[];
  questions: Question[];
  answers: Answer[];
};
