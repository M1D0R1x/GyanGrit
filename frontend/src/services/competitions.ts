// services/competitions.ts
import { apiGet, apiPost } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────

export type RoomStatus = "draft" | "active" | "finished";

export type CompetitionRoom = {
  id:                number;
  title:             string;
  status:            RoomStatus;
  host:              string;
  host_id:           number;
  section_id:        number;
  section:           string;
  assessment_id:     number;
  assessment:        string;
  scheduled_at:      string | null;
  started_at:        string | null;
  finished_at:       string | null;
  created_at:        string;
  participant_count: number;
  participants?:     Participant[];
  questions?:        Question[];
};

export type Participant = {
  student_id:   number;
  username:     string;
  display_name: string;
  score:        number;
  rank:         number | null;
};

export type Question = {
  id:      number;
  text:    string;
  marks:   number;
  order:   number;
  options: Option[];
};

export type Option = {
  id:         number;
  text:       string;
  is_correct?: boolean; // only present for teacher/host
};

export type LeaderboardEntry = {
  rank:         number;
  student_id:   number;
  username:     string;
  display_name: string;
  score:        number;
};

export type AblyTokenResponse = {
  token:      string;
  expires:    number;
  client_id:  string;
  capability: Record<string, string[]>;
};

// ── API calls ─────────────────────────────────────────────────────────────

export const listRooms = () =>
  apiGet<CompetitionRoom[]>("/competitions/");

export const getRoomDetail = (roomId: number) =>
  apiGet<CompetitionRoom>(`/competitions/${roomId}/`);

export const createRoom = (payload: {
  title:         string;
  section_id:    number;
  assessment_id: number;
  scheduled_at?: string;
}) => apiPost<CompetitionRoom>("/competitions/create/", payload);

export const joinRoom = (roomId: number) =>
  apiPost<{ joined: boolean; room_id: number; room_title: string; status: RoomStatus }>(
    `/competitions/${roomId}/join/`, {}
  );

export const startRoom = (roomId: number) =>
  apiPost<{ status: string; question_count: number }>(
    `/competitions/${roomId}/start/`, {}
  );

export const finishRoom = (roomId: number) =>
  apiPost<{ status: string; leaderboard: LeaderboardEntry[] }>(
    `/competitions/${roomId}/finish/`, {}
  );

export const submitAnswer = (roomId: number, questionId: number, optionId: number) =>
  apiPost<{ accepted: boolean; question_id?: number; reason?: string }>(
    `/competitions/${roomId}/answer/`,
    { question_id: questionId, option_id: optionId }
  );

export const getAblyToken = (roomId?: number) =>
  apiPost<AblyTokenResponse>("/realtime/token/", roomId ? { room_id: roomId } : {});
