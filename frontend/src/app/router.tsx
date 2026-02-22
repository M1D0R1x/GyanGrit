import { createBrowserRouter, Navigate } from "react-router-dom";

import DashboardPage from "../pages/DashboardPage";
import CoursesPage from "../pages/CoursesPage";
import LessonsPage from "../pages/LessonsPage";
import LessonPage from "../pages/LessonPage";
import TeacherDashboardPage from "../pages/TeacherDashboardPage";
import LearningPathsPage from "../pages/LearningPathsPage";
import LearningPathPage from "../pages/LearningPathPage";
import ProfilePage from "../pages/ProfilePage";
import OfficialDashboardPage from "../pages/OfficialDashboardPage";
import AdminDashboardPage from "../pages/AdminDashboardPage";
import CourseAssessmentsPage from "../pages/CourseAssessmentsPage";
import AssessmentPage from "../pages/AssessmentPage";
import AssessmentResultPage from "../pages/AssessmentsResultPage";
import AssessmentHistoryPage from "../pages/AssessmentHistoryPage";
import TeacherClassDetailPage from "../pages/TeacherClassDetailPage";
import TeacherStudentDetailPage from "../pages/TeacherStudentDetailPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import VerifyOtpPage from "../pages/VerifyOtpPage";

import { RequireRole } from "../auth/RequireRole";
import RoleBasedRedirect from "../auth/RoleBasedRedirect";

export const router = createBrowserRouter([
  // Root → Role-based redirect
  {
    path: "/",
    element: <RoleBasedRedirect />,
  },

  // ===============================
  // STUDENT ROUTES
  // ===============================

  {
    path: "/dashboard",
    element: (
      <RequireRole role="STUDENT">
        <DashboardPage />
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

  // ===============================
  // TEACHER ROUTES
  // ===============================

  {
    path: "/teacher",
    element: (
      <RequireRole role="TEACHER">
        <TeacherDashboardPage />
      </RequireRole>
    ),
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

  // ===============================
  // OFFICIAL ROUTES
  // ===============================

  {
    path: "/official",
    element: (
      <RequireRole role="OFFICIAL">
        <OfficialDashboardPage />
      </RequireRole>
    ),
  },

  // ===============================
  // ADMIN ROUTES
  // ===============================

  {
    path: "/admin-panel",
    element: (
      <RequireRole role="ADMIN">
        <AdminDashboardPage />
      </RequireRole>
    ),
  },

  // ===============================
  // ASSESSMENTS (Shared)
  // ===============================

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

  // ===============================
  // AUTH ROUTES
  // ===============================

  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/verify-otp",
    element: <VerifyOtpPage />,
  },

  // ===============================
  // FALLBACK
  // ===============================

  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);