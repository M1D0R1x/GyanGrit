import { createBrowserRouter } from "react-router-dom";
import DashboardPage from "../pages/DashboardPage";
import CoursesPage from "../pages/CoursesPage";
import LessonsPage from "../pages/LessonsPage";
import LessonPage from "../pages/LessonPage";
import { RequireRole } from "../auth/AuthContext";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RequireRole role="student">
        <DashboardPage />
      </RequireRole>
    ),
  },
  { path: "/courses", element: <CoursesPage /> },
  { path: "/courses/:courseId", element: <LessonsPage /> },
  { path: "/lessons/:lessonId", element: <LessonPage /> },
]);
