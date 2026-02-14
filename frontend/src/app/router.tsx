import {createBrowserRouter} from "react-router-dom";

import DashboardPage from "../pages/DashboardPage";
import CoursesPage from "../pages/CoursesPage";
import LessonsPage from "../pages/LessonsPage";
import LessonPage from "../pages/LessonPage";
import TeacherDashboardPage from "../pages/TeacherDashboardPage";
import LearningPathsPage from "../pages/LearningPathsPage";
import LearningPathPage from "../pages/LearningPathPage";
import ProfilePage from "../pages/ProfilePage";

import {RequireRole} from "../auth/RequireRole";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import OfficialDashboardPage from "../pages/OfficaialDashboardPage.tsx";
import AdminDashboardPage from "../pages/AdminDashboardPage.tsx";
import CourseAssessmentsPage from "../pages/CourseAssessmentsPage.tsx";
import AssessmentPage from "../pages/AssessmentPage.tsx";
import AssessmentResultPage from "../pages/AssessmentsResultPage.tsx";
import AssessmentHistoryPage from "../pages/AssessmentHistoryPage";
import TeacherClassDetailPage from "../pages/TeacherClassDetailPage";
import TeacherStudentDetailPage from "../pages/TeacherStudentDetailPage";



export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RequireRole role="STUDENT">
        <DashboardPage />
      </RequireRole>
    ),
  },

  {
    path: "/teacher",
    element: (
      <RequireRole role="TEACHER">
        <TeacherDashboardPage />
      </RequireRole>
    ),
  },

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

  {
    path: "/courses",
    element: <CoursesPage />,
  },
  {
    path: "/courses/:courseId",
    element: <LessonsPage />,
  },

  {
    path: "/lessons/:lessonId",
    element: <LessonPage />,
  },

  {
    path: "/profile",
    element: (
      <RequireRole role="STUDENT">
        <ProfilePage />
      </RequireRole>
    ),
  },

  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },

    {
  path: "/official",
  element: (
    <RequireRole role="OFFICIAL">
      <OfficialDashboardPage />
    </RequireRole>
  ),
},
{
  path: "/admin-panel",
  element: (
    <RequireRole role="ADMIN">
      <AdminDashboardPage />
    </RequireRole>
  ),
},
    {
  path: "/courses/:courseId/assessments",
  element: <CourseAssessmentsPage />,
},
{
  path: "/assessments/:assessmentId",
  element: <AssessmentPage />,
},
{
  path: "/assessment-result",
  element: <AssessmentResultPage />,
},
{
  path: "/assessments/:assessmentId/history",
  element: <AssessmentHistoryPage />,
},

{
  path: "/teacher/classes/:classId",
  element: (
    <RequireRole role="TEACHER">
      <TeacherClassDetailPage />
    </RequireRole>
  ),
},
    {
  path: "/teacher/classes/:classId/students/:studentId",
  element: (
    <RequireRole role="TEACHER">
      <TeacherStudentDetailPage />
    </RequireRole>
  ),
},


]);
