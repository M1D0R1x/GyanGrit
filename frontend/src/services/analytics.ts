// services/analytics.ts
/**
 * Engagement tracking for GyanGrit.
 *
 * The heartbeat function should be called every 30 seconds while a student
 * is actively viewing a lesson, in a live session, or studying flashcards.
 * The backend accumulates these into a single EngagementEvent row per
 * resource per day.
 *
 * One-shot events (assessment completion, AI chat message) are logged
 * via logEvent().
 */
import { apiPost, apiGet } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

export type EngagementEventType =
  | "lesson_view"
  | "live_session"
  | "assessment"
  | "ai_chat"
  | "flashcard_study";

export type DailySummary = {
  date: string;
  lesson_min: number;
  live_min: number;
  assessment_min: number;
  ai_messages: number;
  flashcard_min: number;
  total_min: number;
};

export type StudentEngagement = {
  user_id: number;
  username: string;
  name: string;
  lesson_min: number;
  live_min: number;
  assessment_min: number;
  ai_messages: number;
  flashcard_min: number;
  total_min: number;
  risk_level?: string;
  risk_score?: number;
};

// ── Heartbeat (call every 30s while student is actively viewing) ─────────────

export const sendHeartbeat = (
  eventType: EngagementEventType,
  resourceId: number,
  resourceLabel?: string,
) =>
  apiPost("/analytics/heartbeat/", {
    event_type: eventType,
    resource_id: resourceId,
    resource_label: resourceLabel ?? "",
  });

// ── One-shot event (assessment submit, AI chat message) ──────────────────────

export const logEvent = (
  eventType: EngagementEventType,
  resourceId: number,
  durationSeconds: number,
  resourceLabel?: string,
) =>
  apiPost("/analytics/event/", {
    event_type: eventType,
    resource_id: resourceId,
    duration_seconds: durationSeconds,
    resource_label: resourceLabel ?? "",
  });

// ── Read summaries ───────────────────────────────────────────────────────────

export const getMyEngagement = (days = 7) =>
  apiGet<{ days: number; summary: DailySummary[] }>(
    `/analytics/my-summary/?days=${days}`,
  );

export const getClassEngagement = (sectionId: number, days = 7) =>
  apiGet<{ section_id: number; days: number; students: StudentEngagement[] }>(
    `/analytics/class-summary/?section_id=${sectionId}&days=${days}`,
  );

// ── Risk score ────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high";

export type RiskData = {
  risk_level: RiskLevel;
  score: number;
  factors: Record<string, unknown>;
};

export const getMyRisk = () =>
  apiGet<RiskData>("/analytics/my-risk/");
