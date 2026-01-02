import { createBrowserRouter } from "react-router-dom";
import CoursesPage from "../pages/CoursesPage";
import LessonsPage from "../pages/LessonsPage";
import LessonPage from "../pages/LessonPage";

export const router = createBrowserRouter([
  { path: "/", element: <CoursesPage /> },
  { path: "/courses/:courseId", element: <LessonsPage /> },
  { path: "/lessons/:lessonId", element: <LessonPage /> },
]);
