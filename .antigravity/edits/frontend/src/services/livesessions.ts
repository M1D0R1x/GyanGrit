// services/livesessions.ts
import { apiGet, apiPost } from "./api";

export type SessionStatus = "scheduled" | "live" | "ended";

export type LiveSession = {
  id:                 number;
  title:              string;
  status:             SessionStatus;
  section_id:         number;
  subject_id:         number | null;
  subject_name:       string | null;
  teacher_name:       string;
  livekit_room_name:  string;
  scheduled_at:       string;
  started_at:         string | null;
  ended_at:           string | null;
  description:        string;
  attendance_count?:  number;
};

export type LiveToken = {
  token:       string;
  room_name:   string;
  livekit_url: string;
  identity:    string;
  can_publish: boolean;
};

export type Attendee = {
  student_id:   number;
  student_name: string;
  joined_at:    string;
  left_at:      string | null;
  is_present:   boolean;
};

// Teacher
export const listMySessions = () =>
  apiGet<LiveSession[]>("/live/sessions/");

export const createSession = (body: {
  title: string; section_id: number; subject_id?: number;
  description?: string; scheduled_at?: string;
}) => apiPost<LiveSession>("/live/sessions/", body);

export const startSession = (id: number) =>
  apiPost<LiveSession>(`/live/sessions/${id}/start/`, {});

export const endSession = (id: number) =>
  apiPost<LiveSession>(`/live/sessions/${id}/end/`, {});

export const getAttendance = (id: number) =>
  apiGet<Attendee[]>(`/live/sessions/${id}/attendance/`);

// Student
export const getUpcomingSessions = () =>
  apiGet<LiveSession[]>("/live/sessions/upcoming/");

export const joinSession = (id: number) =>
  apiPost<{ session: LiveSession }>(`/live/sessions/${id}/join/`, {});

// Both
export const getSessionToken = (id: number) =>
  apiGet<LiveToken>(`/live/sessions/${id}/token/`);
