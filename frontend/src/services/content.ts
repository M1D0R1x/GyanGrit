/**
 * content.ts — API service for courses, lessons, and progress.
 *
 * FIX (2026-03-15):
 *   Added `content` field to LessonItem type.
 *   The /courses/:id/lessons/all/ endpoint returns `content` for the editor,
 *   but the type was missing it — causing openEdit() to always show a blank textarea.
 */

import { apiGet, apiPost, apiPatch } from "./api";

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
  // Content fields — present in lessons/all/ (admin/teacher view)
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
  // Student view fields
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

// ── Courses ─────────────────────────────────────────────────────────────────

export const getCourses = () =>
  apiGet<CourseItem[]>("/courses/");

export const createCourse = (payload: CreateCoursePayload) =>
  apiPost<CourseItem>("/courses/create/", payload);

export const updateCourse = (courseId: number, payload: Partial<CreateCoursePayload>) =>
  apiPatch<CourseItem>(`/courses/${courseId}/`, payload);

// ── Lessons (student view) ───────────────────────────────────────────────────

export const getCourseLessons = (courseId: number) =>
  apiGet<LessonItem[]>(`/courses/${courseId}/lessons/`);

export const getLessonDetail = (lessonId: number) =>
  apiGet<LessonDetail>(`/lessons/${lessonId}/`);

// ── Lessons (admin/teacher editor view — includes content, all publish states)

export const getCourseAllLessons = (courseId: number) =>
  apiGet<LessonItem[]>(`/courses/${courseId}/lessons/all/`);

export const createLesson = (courseId: number, payload: CreateLessonPayload) =>
  apiPost<LessonItem>(`/courses/${courseId}/lessons/create/`, payload);

export const updateLesson = (lessonId: number, payload: UpdateLessonPayload) =>
  apiPatch<LessonItem>(`/lessons/${lessonId}/update/`, payload);

// ── Course progress ──────────────────────────────────────────────────────────

export type CourseProgress = {
  course_id: number;
  completed: number;
  total: number;
  percentage: number;
  resume_lesson_id: number | null;
};

export const getCourseProgress = (courseId: number) =>
  apiGet<CourseProgress>(`/courses/${courseId}/progress/`);