import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { apiPost } from "../services/api";

type EventType = 
  | "lesson_view" | "live_session" | "assessment" | "ai_chat" | "flashcard_study"
  | "lesson_complete" | "assessment_pass" | "assessment_fail" | "login"
  | "recording_view" | "chatroom_msg" | "competition" | "streak_break"
  | "notification_click" | "page_visit";

interface TelemetryOptions {
  resource_id?: number;
  resource_label?: string;
  duration_seconds?: number;
}

/**
 * Fire-and-forget generic event logging to the backend.
 * Drops errors implicitly to avoid interrupting the user flow.
 */
export function trackEvent(eventType: EventType, opts?: TelemetryOptions) {
  if (!navigator.onLine) return;
  apiPost("/analytics/event/", {
    event_type: eventType,
    resource_id: opts?.resource_id ?? null,
    resource_label: opts?.resource_label ?? "",
    duration_seconds: opts?.duration_seconds ?? 0,
  }).catch(() => {
    // Silently fail telemetry to not disrupt UX
  });
}

/**
 * Custom React Hook to track page visits automatically using React Router's useLocation.
 * Include this at the top level `AppLayout` component.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    trackEvent("page_visit", {
      resource_label: location.pathname,
    });
  }, [location.pathname]);
}
