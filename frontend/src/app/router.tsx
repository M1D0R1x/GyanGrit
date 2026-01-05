import { createBrowserRouter } from "react-router-dom";

import DashboardPage from "../pages/DashboardPage";
import CoursesPage from "../pages/CoursesPage";
import LessonsPage from "../pages/LessonsPage";
import LessonPage from "../pages/LessonPage";
import TeacherDashboardPage from "../pages/TeacherDashboardPage";
import LearningPathsPage from "../pages/LearningPathsPage";
import LearningPathPage from "../pages/LearningPathPage";

import { RequireRole } from "../auth/AuthContext";

/**
 * Application router.
 *
 * Rules:
 * - "/" is the student dashboard
 * - Learning Paths live under /learning
 * - Content (courses/lessons) stays separate
 * - Role guards are explicit, not implicit
 */
export const router = createBrowserRouter([
  /**
   * Student dashboard (default landing)
   */
  {
    path: "/",
    element: (
      <RequireRole role="student">
        <DashboardPage />
      </RequireRole>
    ),
  },

  /**
   * Teacher dashboard
   */
  {
    path: "/teacher",
    element: (
      <RequireRole role="teacher">
        <TeacherDashboardPage />
      </RequireRole>
    ),
  },

  /**
   * Learning paths (curriculum-level navigation)
   */
  {
    path: "/learning",
    element: (
      <RequireRole role="student">
        <LearningPathsPage />
      </RequireRole>
    ),
  },
  {
    path: "/learning/:pathId",
    element: (
      <RequireRole role="student">
        <LearningPathPage />
      </RequireRole>
    ),
  },

  /**
   * Course browsing (content app)
   */
  {
    path: "/courses",
    element: <CoursesPage />,
  },
  {
    path: "/courses/:courseId",
    element: <LessonsPage />,
  },

  /**
   * Individual lesson view
   */
  {
    path: "/lessons/:lessonId",
    element: <LessonPage />,
  },
]);
