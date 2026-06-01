export type Status = 'assigned' | 'in_progress' | 'to_check' | 'expired' | 'done' | 'not_actual' | 'ideas_backlog'
export type Role = 'admin' | 'user'

export interface Profile {
  id: string
  name: string
  initials: string
  color: string
  role: Role
  is_super?: boolean   // super-checker (owner): only they manage roles
}

export interface Project {
  id: string
  name: string
  description: string | null
  deadline: string | null   // ISO date YYYY-MM-DD or null
}

export interface ProjectMember {
  project_id: string
  profile_id: string
}

export interface Commitment {
  id: string
  title: string
  description: string
  status: Status
  project_id: string | null
  project_name: string | null
  author_id: string | null
  author_name: string | null
  executor_id: string | null
  executor_name: string | null
  checker_id: string | null
  checker_name: string | null
  deadline: string        // ISO date YYYY-MM-DD
  deadline_time: string | null  // HH:MM or null
  created_at: string
  updated_at: string      // last change (status, edit) — ISO timestamp
}

export interface CommitmentEvent {
  id: string
  type: 'created' | 'status'
  from_status: Status | null
  to_status: Status | null
  created_at: string
  actor_name: string | null
}

export interface CommitmentFormData {
  title: string
  description: string
  status: Status
  project_id: string
  executor_id: string
  checker_id: string
  deadline: string
  deadline_time: string
}
