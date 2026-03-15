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
  has_video: boolean;
  has_pdf: boolean;
  has_text: boolean;
  video_url?: string | null;
  video_thumbnail_url?: string | null;
  video_duration?: string;
  pdf_url?: string | null;
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
  is_published?: boolean;
  order?: number;
};

export type UpdateLessonPayload = Partial<CreateLessonPayload> & {
  is_published?: boolean;
};

// Courses
export const getCourses = () => apiGet<CourseItem[]>("/courses/");
export const createCourse = (payload: CreateCoursePayload) =>
  apiPost<CourseItem>("/courses/create/", payload);
export const updateCourse = (courseId: number, payload: Partial<CreateCoursePayload>) =>
  apiPatch<CourseItem>(`/courses/${courseId}/`, payload);

// Lessons
export const getCourseLessons = (courseId: number) =>
  apiGet<LessonItem[]>(`/courses/${courseId}/lessons/`);

export const getCourseAllLessons = (courseId: number) =>
  apiGet<LessonItem[]>(`/courses/${courseId}/lessons/all/`);

export const getLessonDetail = (lessonId: number) =>
  apiGet<LessonDetail>(`/lessons/${lessonId}/`);

export const createLesson = (courseId: number, payload: CreateLessonPayload) =>
  apiPost<LessonItem>(`/courses/${courseId}/lessons/create/`, payload);

export const updateLesson = (lessonId: number, payload: UpdateLessonPayload) =>
  apiPatch<LessonItem>(`/lessons/${lessonId}/update/`, payload);