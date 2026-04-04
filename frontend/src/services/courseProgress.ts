import { apiGet } from "./api";

export type CourseProgress = {
  course_id: number;
  completed: number;
  total: number;
  percentage: number;
  resume_lesson_id: number | null;
};

export function getCourseProgress(courseId: number) {
  return apiGet<CourseProgress>(`/courses/${courseId}/progress/`);
}

/** Batch version — resolves all courses in 2 DB queries instead of 2×N. */
export function getBatchCourseProgress(courseIds: number[]) {
  if (courseIds.length === 0) return Promise.resolve({} as Record<string, CourseProgress>);
  const ids = courseIds.join(",");
  return apiGet<Record<string, CourseProgress>>(`/courses/progress/batch/?ids=${ids}`);
}
