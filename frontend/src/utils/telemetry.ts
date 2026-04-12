import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { apiPost } from "../services/api";

type EventType =
  | "lesson_view" | "live_session" | "assessment" | "ai_chat" | "flashcard_study"
  | "lesson_complete" | "assessment_pass" | "assessment_fail" | "login"
  | "recording_view" | "chatroom_msg" | "competition" | "streak_break"
  | "notification_click" | "page_visit";

interface TelemetryEvent {
  event_type: EventType;
  resource_id: number | null;
  resource_label: string;
  duration_seconds: number;
  ts: number;
}

// ── Batched event queue — flushes every 5s instead of firing per-route ────────
const _queue: TelemetryEvent[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 5000;
const MAX_BATCH = 20;

function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(_flush, FLUSH_INTERVAL);
}

function _flush() {
  _flushTimer = null;
  if (!_queue.length || !navigator.onLine) return;

  const batch = _queue.splice(0, MAX_BATCH);
  // Deduplicate: keep latest event per (event_type + resource_label) key
  const deduped = new Map<string, TelemetryEvent>();
  for (const evt of batch) {
    const key = `${evt.event_type}:${evt.resource_label}`;
    deduped.set(key, evt);
  }

  const events = Array.from(deduped.values());
  if (!events.length) return;

  // Send as batch if backend supports it, else fire individually
  // For now: single POST per unique event (deduped from 4 to ~2)
  for (const evt of events) {
    apiPost("/analytics/event/", {
      event_type: evt.event_type,
      resource_id: evt.resource_id,
      resource_label: evt.resource_label,
      duration_seconds: evt.duration_seconds,
    }).catch(() => {});
  }
}

// Flush on page hide (tab close / navigate away)
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") _flush();
  });
}

/**
 * Queue event for batched flush. Fires at most once per 5s window.
 */
export function trackEvent(
  eventType: EventType,
  opts?: { resource_id?: number; resource_label?: string; duration_seconds?: number },
) {
  if (!navigator.onLine) return;
  _queue.push({
    event_type: eventType,
    resource_id: opts?.resource_id ?? null,
    resource_label: opts?.resource_label ?? "",
    duration_seconds: opts?.duration_seconds ?? 0,
    ts: Date.now(),
  });
  _scheduleFlush();
}

/**
 * Track page visits. Fires on route change but batched+deduped before sending.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    trackEvent("page_visit", {
      resource_label: location.pathname,
    });
  }, [location.pathname]);
}
