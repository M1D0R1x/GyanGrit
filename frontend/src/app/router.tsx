/* eslint-disable react-refresh/only-export-components */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

// Eager-loaded pages — critical path, load immediately
import LoginPage     from "../pages/LoginPage";
import RegisterPage  from "../pages/RegisterPage";
import VerifyOtpPage from "../pages/VerifyOtpPage";

import { RequireRole } from "../auth/RequireRole";
import RoleBasedRedirect from "../auth/RoleBasedRedirect";

// ----------------------------------------------------------------
// LAZY-LOADED PAGES
// Grouped by role to make bundle analysis easier.
// Each role's pages are in the same dynamic chunk.
// ----------------------------------------------------------------

// Student
const DashboardPage      = lazy(() => import("../pages/DashboardPage"));
const CoursesPage        = lazy(() => import("../pages/CoursesPage"));
const LessonsPage        = lazy(() => import("../pages/LessonsPage"));
const LessonPage         = lazy(() => import("../pages/LessonPage"));
const LearningPathsPage  = lazy(() => import("../pages/LearningPathsPage"));
const LearningPathPage   = lazy(() => import("../pages/LearningPathPage"));
const ProfilePage        = lazy(() => import("../pages/ProfilePage"));

// Assessments (shared across roles)
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

// ----------------------------------------------------------------
// PAGE LOADER
// Shown during lazy chunk download. Uses the same design
// system as auth loading so there is no visual flash.
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// ROUTE WRAPPER
// Combines RequireRole + Suspense in one component
// to reduce boilerplate in the route table below.
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// ROUTER
// ----------------------------------------------------------------
export const router = createBrowserRouter([
  // Root redirect — goes to role-appropriate dashboard
  { path: "/", element: <RoleBasedRedirect /> },

  // ---- AUTH (no protection required) --------------------------
  { path: "/login",      element: <LoginPage /> },
  { path: "/register",   element: <RegisterPage /> },
  { path: "/verify-otp", element: <VerifyOtpPage /> },

  // ---- STUDENT ------------------------------------------------
  {
    path: "/dashboard",
    element: (
      <Protected role="STUDENT">
        <DashboardPage />
      </Protected>
    ),
  },
  {
    path: "/courses",
    element: (
      <Protected role="STUDENT">
        <CoursesPage />
      </Protected>
    ),
  },
  {
    path: "/courses/:courseId",
    element: (
      <Protected role="STUDENT">
        <LessonsPage />
      </Protected>
    ),
  },
  {
    path: "/lessons/:lessonId",
    element: (
      <Protected role="STUDENT">
        <LessonPage />
      </Protected>
    ),
  },
  {
    path: "/learning",
    element: (
      <Protected role="STUDENT">
        <LearningPathsPage />
      </Protected>
    ),
  },
  {
    path: "/learning/:pathId",
    element: (
      <Protected role="STUDENT">
        <LearningPathPage />
      </Protected>
    ),
  },
  {
    path: "/profile",
    element: (
      <Protected role="STUDENT">
        <ProfilePage />
      </Protected>
    ),
  },

  // ---- ASSESSMENTS (STUDENT minimum — teachers/admins also access) --
  {
    path: "/courses/:courseId/assessments",
    element: (
      <Protected role="STUDENT">
        <CourseAssessmentsPage />
      </Protected>
    ),
  },
  {
    path: "/assessments/:assessmentId",
    element: (
      <Protected role="STUDENT">
        <AssessmentPage />
      </Protected>
    ),
  },
  {
    path: "/assessment-result",
    element: (
      <Protected role="STUDENT">
        <AssessmentResultPage />
      </Protected>
    ),
  },
  {
    path: "/assessments/:assessmentId/history",
    element: (
      <Protected role="STUDENT">
        <AssessmentHistoryPage />
      </Protected>
    ),
  },

  // ---- TEACHER ------------------------------------------------
  {
    path: "/teacher",
    element: (
      <Protected role="TEACHER">
        <TeacherDashboardPage />
      </Protected>
    ),
  },
  {
    path: "/teacher/classes/:classId",
    element: (
      <Protected role="TEACHER">
        <TeacherClassDetailPage />
      </Protected>
    ),
  },
  {
    path: "/teacher/classes/:classId/students/:studentId",
    element: (
      <Protected role="TEACHER">
        <TeacherStudentDetailPage />
      </Protected>
    ),
  },

  // ---- PRINCIPAL ----------------------------------------------
  {
    path: "/principal",
    element: (
      <Protected role="PRINCIPAL">
        <PrincipalDashboardPage />
      </Protected>
    ),
  },

  // ---- OFFICIAL -----------------------------------------------
  {
    path: "/official",
    element: (
      <Protected role="OFFICIAL">
        <OfficialDashboardPage />
      </Protected>
    ),
  },

  // ---- ADMIN --------------------------------------------------
  {
    path: "/admin-panel",
    element: (
      <Protected role="ADMIN">
        <AdminDashboardPage />
      </Protected>
    ),
  },

  // ---- CATCH-ALL ----------------------------------------------
  { path: "*", element: <Navigate to="/" replace /> },
]);