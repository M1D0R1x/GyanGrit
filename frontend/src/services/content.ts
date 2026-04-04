/**
 * content.ts — API service for courses, lessons, and progress.
 *
 * FIX (2026-03-15): Added `content` field to LessonItem type.
 * FIX (2026-03-16): Removed CreatedCourse type; added section lesson CRUD.
 * FIX (2026-03-17): Added getCourseBySlug() for human-readable URL resolution.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";

export type CourseItem = {
  id: number;
  title: string;
  description: string;
  grade: number;
  is_core: boolean;
  subject__name: string;
  subject__id: number;
};

export type LessonItem = {
  id: number;
  title: string;
  order: number;
  is_published: boolean;
  content?: string;
  has_video: boolean;
  has_pdf: boolean;
  has_text: boolean;
  video_url?: string | null;
  video_thumbnail_url?: string | null;
  video_duration?: string;
  pdf_url?: string | null;
  hls_manifest_url?: string | null;
  thumbnail_url?: string | null;
  completed?: boolean;
};

export type LessonDetail = {
  id: number;
  title: string;
  content: string;
  video_url: string | null;
  video_thumbnail_url: string | null;
  video_duration: string;
  hls_manifest_url: string | null;
  pdf_url: string | null;
  thumbnail_url: string | null;
  completed: boolean;
  last_position: number;
  notes: {
    id: number;
    content: string;
    author__username: string;
    created_at: string;
  }[];
  course: {
    id: number;
    title: string;
    grade: number;
    subject: string;
  };
};

export type CreateCoursePayload = {
  subject_id: number;
  grade: number;
  title: string;
  description?: string;
  is_core?: boolean;
};

export type CreateLessonPayload = {
  title: string;
  content?: string;
  video_url?: string;
  video_thumbnail_url?: string;
  video_duration?: string;
  pdf_url?: string;
  hls_manifest_url?: string;
  is_published?: boolean;
  order?: number;
};

export type UpdateLessonPayload = Partial<CreateLessonPayload> & {
  is_published?: boolean;
};

// ── Section Lessons ───────────────────────────────────────────────────────────

export type SectionLessonItem = {
  id: number;
  title: string;
  order: number;
  has_video: boolean;
  has_pdf: boolean;
  has_content: boolean;
  is_published: boolean;
  created_by: string | null;
};

export type CreateSectionLessonPayload = {
  title: string;
  content?: string;
  video_url?: string;
  video_thumbnail_url?: string;
  pdf_url?: string;
  order?: number;
  is_published?: boolean;
};

// ── Course ────────────────────────────────────────────────────────────────────

export async function createCourse(
  payload: CreateCoursePayload
): Promise<CourseItem> {
  return apiPost<CourseItem>("/courses/create/", payload);
}

export const getCourses = () =>
  apiGet<CourseItem[]>("/courses/");

/**
 * Resolve a human-readable URL slug back to a CourseItem.
 * Used by LessonsPage when navigated via /courses/:grade/:subject.
 *
 * GET /api/v1/courses/by-slug/?grade=10&subject=punjabi
 */
export async function getCourseBySlug(
  grade: number,
  subjectSlug: string
): Promise<CourseItem> {
  return apiGet<CourseItem>(
    `/courses/by-slug/?grade=${grade}&subject=${encodeURIComponent(subjectSlug)}`
  );
}

export const updateCourse = (
  courseId: number,
  payload: Partial<CreateCoursePayload>
) => apiPatch<CourseItem>(`/courses/${courseId}/`, payload);

// ── Lessons (student view) ────────────────────────────────────────────────────

export const getCourseLessons = (courseId: number) =>
  apiGet<LessonItem[]>(`/courses/${courseId}/lessons/`);

export const getLessonDetail = (lessonId: number) =>
  apiGet<LessonDetail>(`/lessons/${lessonId}/`);

// ── Lessons (admin/teacher editor) ───────────────────────────────────────────

export const getCourseAllLessons = (courseId: number) =>
  apiGet<LessonItem[]>(`/courses/${courseId}/lessons/all/`);

export const createLesson = (courseId: number, payload: CreateLessonPayload) =>
  apiPost<LessonItem>(`/courses/${courseId}/lessons/create/`, payload);

export const updateLesson = (lessonId: number, payload: UpdateLessonPayload) =>
  apiPatch<LessonItem>(`/lessons/${lessonId}/update/`, payload);

// ── Section Lessons (teacher/principal) ───────────────────────────────────────

export const getSectionLessons = (courseId: number) =>
  apiGet<SectionLessonItem[]>(`/courses/${courseId}/section-lessons/`);

export const createSectionLesson = (
  courseId: number,
  payload: CreateSectionLessonPayload
) => apiPost<SectionLessonItem>(`/courses/${courseId}/section-lessons/`, payload);

export const updateSectionLesson = (
  lessonId: number,
  payload: Partial<CreateSectionLessonPayload>
) => apiPatch<SectionLessonItem>(`/lessons/section/${lessonId}/update/`, payload);

export const deleteSectionLesson = (lessonId: number) =>
  apiDelete<{ success: boolean }>(`/lessons/section/${lessonId}/delete/`);

// ── Course progress ───────────────────────────────────────────────────────────

export type CourseProgress = {
  course_id: number;
  completed: number;
  total: number;
  percentage: number;
  resume_lesson_id: number | null;
};

export const getCourseProgress = (courseId: number) =>
  apiGet<CourseProgress>(`/courses/${courseId}/progress/`);

/**
 * Batch progress — resolves N courses in 2 DB queries instead of 2×N.
 * Fixes SENTRY-BRONZE-GARDEN-7 (dashboard N+1 API calls).
 * Returns a map keyed by course_id (as string).
 */
export const getBatchCourseProgress = (courseIds: number[]) => {
  if (courseIds.length === 0)
    return Promise.resolve({} as Record<string, CourseProgress>);
  return apiGet<Record<string, CourseProgress>>(
    `/courses/progress/batch/?ids=${courseIds.join(",")}`
  );
};
