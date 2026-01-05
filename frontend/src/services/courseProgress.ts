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
