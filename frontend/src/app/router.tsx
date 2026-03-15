/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";

import LoginPage     from "../pages/LoginPage";
import RegisterPage  from "../pages/RegisterPage";
import VerifyOtpPage from "../pages/VerifyOtpPage";

import { RequireRole } from "../auth/RequireRole";
import RoleBasedRedirect from "../auth/RoleBasedRedirect";

// --Errors--
const NotFoundPage    = lazy(() => import("../pages/errors/NotFoundPage"));
const ForbiddenPage   = lazy(() => import("../pages/errors/ForbiddenPage"));
const ServerErrorPage = lazy(() => import("../pages/errors/ServerErrorPage"));
const NetworkErrorPage = lazy(() => import("../pages/errors/NetworkErrorPage"));

// ── Student ────────────────────────────────────────────────────────────────
const DashboardPage      = lazy(() => import("../pages/DashboardPage"));
const CoursesPage        = lazy(() => import("../pages/CoursesPage"));
const LessonsPage        = lazy(() => import("../pages/LessonsPage"));
const LessonPage         = lazy(() => import("../pages/LessonPage"));
const LearningPathsPage  = lazy(() => import("../pages/LearningPathsPage"));
const LearningPathPage   = lazy(() => import("../pages/LearningPathPage"));
const ProfilePage        = lazy(() => import("../pages/ProfilePage"));

// ── Assessments ───────────────────────────────────────────────────────────
const CourseAssessmentsPage  = lazy(() => import("../pages/CourseAssessmentsPage"));
const AssessmentPage         = lazy(() => import("../pages/AssessmentPage"));
const AssessmentResultPage   = lazy(() => import("../pages/AssessmentsResultPage"));
const AssessmentHistoryPage  = lazy(() => import("../pages/AssessmentHistoryPage"));

// ── Teacher ────────────────────────────────────────────────────────────────
const TeacherDashboardPage     = lazy(() => import("../pages/TeacherDashboardPage"));
const TeacherClassDetailPage   = lazy(() => import("../pages/TeacherClassDetailPage"));
const TeacherStudentDetailPage = lazy(() => import("../pages/TeacherStudentDetailPage"));

// ── Role dashboards ────────────────────────────────────────────────────────
const PrincipalDashboardPage = lazy(() => import("../pages/PrincipalDashboardPage"));
const OfficialDashboardPage  = lazy(() => import("../pages/OfficialDashboardPage"));
const AdminDashboardPage     = lazy(() => import("../pages/AdminDashboardPage"));

// ── Shared ─────────────────────────────────────────────────────────────────
const UserManagementPage = lazy(() => import("../pages/UserManagementPage"));

// ── Admin content tools ───────────────────────────────────────────────────
const AdminContentPage           = lazy(() => import("../pages/AdminContentPage"));
const AdminLessonEditorPage      = lazy(() => import("../pages/AdminLessonEditorPage"));
const AdminAssessmentBuilderPage = lazy(() => import("../pages/AdminAssessmentBuilderPage"));
const AdminJoinCodesPage         = lazy(() => import("../pages/AdminJoinCodesPage"));

// ── Page loader ───────────────────────────────────────────────────────────
// Shown while a lazy chunk is downloading.
// Uses the same branded loading screen as auth so there is no visual flash.
function PageLoader() {
  return (
    <div className="auth-loading">
      <div className="auth-loading__logo">
        Gyan<span>Grit</span>
      </div>
      <div className="auth-loading__spinner" />
    </div>
  );
}

// ── Route wrapper ─────────────────────────────────────────────────────────
// Combines RequireRole + Suspense so the route table stays clean.
function Protected({
  role,
  children,
}: {
  role: Parameters<typeof RequireRole>[0]["role"];
  children: ReactNode;
}) {
  return (
    <RequireRole role={role}>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </RequireRole>
  );
}

// ── Router ────────────────────────────────────────────────────────────────
export const router = createBrowserRouter([
  // Root — redirects to role-appropriate dashboard
  { path: "/", element: <RoleBasedRedirect /> },

  // ── Auth (no protection) ──────────────────────────────────────────────
  { path: "/login",      element: <LoginPage /> },
  { path: "/register",   element: <RegisterPage /> },
  { path: "/verify-otp", element: <VerifyOtpPage /> },

  // ── Student ───────────────────────────────────────────────────────────
  { path: "/dashboard",
    element: <Protected role="STUDENT"><DashboardPage /></Protected> },
  { path: "/courses",
    element: <Protected role="STUDENT"><CoursesPage /></Protected> },
  { path: "/courses/:courseId",
    element: <Protected role="STUDENT"><LessonsPage /></Protected> },
  { path: "/lessons/:lessonId",
    element: <Protected role="STUDENT"><LessonPage /></Protected> },
  { path: "/lessons/section/:lessonId",
    element: <Protected role="STUDENT"><LessonPage /></Protected> },
  { path: "/learning",
    element: <Protected role="STUDENT"><LearningPathsPage /></Protected> },
  { path: "/learning/:pathId",
    element: <Protected role="STUDENT"><LearningPathPage /></Protected> },
  { path: "/profile",
    element: <Protected role="STUDENT"><ProfilePage /></Protected> },

  // ── Assessments (student minimum) ─────────────────────────────────────
  { path: "/courses/:courseId/assessments",
    element: <Protected role="STUDENT"><CourseAssessmentsPage /></Protected> },
  { path: "/assessments/:assessmentId",
    element: <Protected role="STUDENT"><AssessmentPage /></Protected> },
  { path: "/assessment-result",
    element: <Protected role="STUDENT"><AssessmentResultPage /></Protected> },
  { path: "/assessments/:assessmentId/history",
    element: <Protected role="STUDENT"><AssessmentHistoryPage /></Protected> },

  // ── Teacher ───────────────────────────────────────────────────────────
  { path: "/teacher",
    element: <Protected role="TEACHER"><TeacherDashboardPage /></Protected> },
  { path: "/teacher/classes/:classId",
    element: <Protected role="TEACHER"><TeacherClassDetailPage /></Protected> },
  { path: "/teacher/classes/:classId/students/:studentId",
    element: <Protected role="TEACHER"><TeacherStudentDetailPage /></Protected> },

  // ── User management (teacher, principal, official, admin) ─────────────
  // Single page, role-aware. Backend enforces scope.
  { path: "/manage-users",
    element: <Protected role="TEACHER"><UserManagementPage /></Protected> },

  // ── Principal ─────────────────────────────────────────────────────────
  { path: "/principal",
    element: <Protected role="PRINCIPAL"><PrincipalDashboardPage /></Protected> },

  // ── Official ──────────────────────────────────────────────────────────
  { path: "/official",
    element: <Protected role="OFFICIAL"><OfficialDashboardPage /></Protected> },

  // ── Admin ─────────────────────────────────────────────────────────────
  { path: "/admin-panel",
    element: <Protected role="ADMIN"><AdminDashboardPage /></Protected> },
  { path: "/admin/content",
    element: <Protected role="ADMIN"><AdminContentPage /></Protected> },
  { path: "/admin/content/courses/:courseId/lessons",
    element: <Protected role="ADMIN"><AdminLessonEditorPage /></Protected> },
  { path: "/admin/content/courses/:courseId/assessments",
    element: <Protected role="ADMIN"><AdminAssessmentBuilderPage /></Protected> },
  { path: "/admin/join-codes",
    element: <Protected role="ADMIN"><AdminJoinCodesPage /></Protected> },

  // ── Catch-all ─────────────────────────────────────────────────────────
  { path: "*", element: <Navigate to="/" replace /> },

    // ── Error pages ───────────────────────────────────────────────────────────
  { path: "/403",
    element: <Suspense fallback={<PageLoader />}><ForbiddenPage /></Suspense> },
  { path: "/500",
    element: <Suspense fallback={<PageLoader />}><ServerErrorPage /></Suspense> },
  { path: "/network-error",
    element: <Suspense fallback={<PageLoader />}><NetworkErrorPage /></Suspense> },

  // 404 — catch-all (must be last)
  { path: "*",
    element: <Suspense fallback={<PageLoader />}><NotFoundPage /></Suspense> },
]);