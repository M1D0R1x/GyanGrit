/* eslint-disable react-refresh/only-export-components */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

import LoginPage     from "../pages/LoginPage";
import RegisterPage  from "../pages/RegisterPage";
import VerifyOtpPage from "../pages/VerifyOtpPage";

import { RequireRole } from "../auth/RequireRole";
import RoleBasedRedirect from "../auth/RoleBasedRedirect";

// Student
const DashboardPage      = lazy(() => import("../pages/DashboardPage"));
const CoursesPage        = lazy(() => import("../pages/CoursesPage"));
const LessonsPage        = lazy(() => import("../pages/LessonsPage"));
const LessonPage         = lazy(() => import("../pages/LessonPage"));
const LearningPathsPage  = lazy(() => import("../pages/LearningPathsPage"));
const LearningPathPage   = lazy(() => import("../pages/LearningPathPage"));
const ProfilePage        = lazy(() => import("../pages/ProfilePage"));

// Assessments
const CourseAssessmentsPage = lazy(() => import("../pages/CourseAssessmentsPage"));
const AssessmentPage        = lazy(() => import("../pages/AssessmentPage"));
const AssessmentResultPage  = lazy(() => import("../pages/AssessmentsResultPage"));
const AssessmentHistoryPage = lazy(() => import("../pages/AssessmentHistoryPage"));

// Teacher
const TeacherDashboardPage     = lazy(() => import("../pages/TeacherDashboardPage"));
const TeacherClassDetailPage   = lazy(() => import("../pages/TeacherClassDetailPage"));
const TeacherStudentDetailPage = lazy(() => import("../pages/TeacherStudentDetailPage"));

// Other roles
const PrincipalDashboardPage = lazy(() => import("../pages/PrincipalDashboardPage"));
const OfficialDashboardPage  = lazy(() => import("../pages/OfficialDashboardPage"));
const AdminDashboardPage     = lazy(() => import("../pages/AdminDashboardPage"));

// Admin content management
const AdminContentPage            = lazy(() => import("../pages/AdminContentPage"));
const AdminLessonEditorPage       = lazy(() => import("../pages/AdminLessonEditorPage"));
const AdminAssessmentBuilderPage  = lazy(() => import("../pages/AdminAssessmentBuilderPage"));

function PageLoader() {
  return (
    <div className="auth-loading">
      <div className="auth-loading__logo">Gyan<span>Grit</span></div>
      <div className="auth-loading__spinner" />
    </div>
  );
}

function Protected({
  role,
  children,
}: {
  role: Parameters<typeof RequireRole>[0]["role"];
  children: React.ReactNode;
}) {
  return (
    <RequireRole role={role}>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </RequireRole>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <RoleBasedRedirect /> },

  // Auth
  { path: "/login",      element: <LoginPage /> },
  { path: "/register",   element: <RegisterPage /> },
  { path: "/verify-otp", element: <VerifyOtpPage /> },

  // Student
  { path: "/dashboard",    element: <Protected role="STUDENT"><DashboardPage /></Protected> },
  { path: "/courses",      element: <Protected role="STUDENT"><CoursesPage /></Protected> },
  { path: "/courses/:courseId", element: <Protected role="STUDENT"><LessonsPage /></Protected> },
  { path: "/lessons/:lessonId", element: <Protected role="STUDENT"><LessonPage /></Protected> },
  { path: "/learning",          element: <Protected role="STUDENT"><LearningPathsPage /></Protected> },
  { path: "/learning/:pathId",  element: <Protected role="STUDENT"><LearningPathPage /></Protected> },
  { path: "/profile",           element: <Protected role="STUDENT"><ProfilePage /></Protected> },

  // Assessments
  { path: "/courses/:courseId/assessments", element: <Protected role="STUDENT"><CourseAssessmentsPage /></Protected> },
  { path: "/assessments/:assessmentId",     element: <Protected role="STUDENT"><AssessmentPage /></Protected> },
  { path: "/assessment-result",             element: <Protected role="STUDENT"><AssessmentResultPage /></Protected> },
  { path: "/assessments/:assessmentId/history", element: <Protected role="STUDENT"><AssessmentHistoryPage /></Protected> },

  // Teacher
  { path: "/teacher", element: <Protected role="TEACHER"><TeacherDashboardPage /></Protected> },
  { path: "/teacher/classes/:classId", element: <Protected role="TEACHER"><TeacherClassDetailPage /></Protected> },
  { path: "/teacher/classes/:classId/students/:studentId", element: <Protected role="TEACHER"><TeacherStudentDetailPage /></Protected> },

  // Principal
  { path: "/principal", element: <Protected role="PRINCIPAL"><PrincipalDashboardPage /></Protected> },

  // Official
  { path: "/official", element: <Protected role="OFFICIAL"><OfficialDashboardPage /></Protected> },

  // Admin
  { path: "/admin-panel", element: <Protected role="ADMIN"><AdminDashboardPage /></Protected> },

  // Admin content management
  { path: "/admin/content", element: <Protected role="ADMIN"><AdminContentPage /></Protected> },
  { path: "/admin/content/courses/:courseId/lessons", element: <Protected role="ADMIN"><AdminLessonEditorPage /></Protected> },
  { path: "/admin/content/courses/:courseId/assessments", element: <Protected role="ADMIN"><AdminAssessmentBuilderPage /></Protected> },

  { path: "*", element: <Navigate to="/" replace /> },
]);