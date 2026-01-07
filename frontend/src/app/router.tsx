import { createBrowserRouter } from "react-router-dom";

import DashboardPage from "../pages/DashboardPage";
import CoursesPage from "../pages/CoursesPage";
import LessonsPage from "../pages/LessonsPage";
import LessonPage from "../pages/LessonPage";
import TeacherDashboardPage from "../pages/TeacherDashboardPage";
import LearningPathsPage from "../pages/LearningPathsPage";
import LearningPathPage from "../pages/LearningPathPage";
import { RequireRole } from "../auth/RequireRole";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";


/**
 * Application router.
 *
 * DESIGN RULES:
 * - "/" is the student dashboard
 * - Roles are enforced explicitly via RequireRole
 * - Roles MUST match backend (UPPERCASE)
 * - Content (courses/lessons) is role-agnostic
 * - Learning paths are student-only
 */
export const router = createBrowserRouter([
  /**
   * Student dashboard (default landing)
   */
  {
    path: "/",
    element: (
      <RequireRole role="STUDENT">
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
      <RequireRole role="TEACHER">
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
      <RequireRole role="STUDENT">
        <LearningPathsPage />
      </RequireRole>
    ),
  },
  {
    path: "/learning/:pathId",
    element: (
      <RequireRole role="STUDENT">
        <LearningPathPage />
      </RequireRole>
    ),
  },

  /**
   * Course browsing (content app)
   * No role restriction here by design
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

  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
]);
