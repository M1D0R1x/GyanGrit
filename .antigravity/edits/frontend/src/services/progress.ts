import { apiPatch } from "./api";

/**
 * Lesson progress shape returned by backend.
 */
export type LessonProgress = {
  lesson_id: number;
  completed: boolean;
  last_position: number;
};

/**
 * Update lesson progress.
 *
 * Rules:
 * - Never hardcode API base here
 * - Always go through api.ts
 * - Paths are relative to /api/v1
 */
export function updateLessonProgress(
  lessonId: number,
  payload: Partial<LessonProgress>
) {
  return apiPatch(
    `/lessons/${lessonId}/progress/`,
    payload
  );
}
