import { apiGet } from "./api";

/**
 * A learning path shown in the listing page.
 */
export type LearningPath = {
  id: number;
  name: string;
  description: string;
};

/**
 * A course inside a learning path.
 */
export type LearningPathCourse = {
  course_id: number;
  title: string;
  order: number;
};

/**
 * Detailed learning path response.
 */
export type LearningPathDetail = {
  id: number;
  name: string;
  description: string;
  courses: LearningPathCourse[];
};

/**
 * Progress information for a learning path.
 */
export type LearningPathProgress = {
  path_id: number;
  total_courses: number;
  completed_courses: number;
  percentage: number;
};

/**
 * Fetch all learning paths.
 */
export function getLearningPaths() {
  return apiGet<LearningPath[]>("/learning/paths/");
}

/**
 * Fetch a single learning path with ordered courses.
 */
export function getLearningPath(pathId: number) {
  return apiGet<LearningPathDetail>(
    `/learning/paths/${pathId}/`
  );
}

/**
 * Fetch progress for a learning path.
 */
export function getLearningPathProgress(pathId: number) {
  return apiGet<LearningPathProgress>(
    `/learning/paths/${pathId}/progress/`
  );
}
