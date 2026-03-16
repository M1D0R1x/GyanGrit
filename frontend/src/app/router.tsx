/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";

import LoginPage           from "../pages/LoginPage";
import RegisterPage        from "../pages/RegisterPage";
import VerifyOtpPage       from "../pages/VerifyOtpPage";
import CompleteProfilePage from "../pages/CompleteProfilePage";

import { RequireRole }   from "../auth/RequireRole";
import RoleBasedRedirect from "../auth/RoleBasedRedirect";

// Error pages — eagerly loaded (tiny, needed immediately)
import NotFoundPage     from "../pages/errors/NotFoundPage";
import ForbiddenPage    from "../pages/errors/ForbiddenPage";
import ServerErrorPage  from "../pages/errors/ServerErrorPage";
import NetworkErrorPage from "../pages/errors/NetworkErrorPage";

// ── Student ──────────────────────────────────────────────────────────────────
const DashboardPage     = lazy(() => import("../pages/DashboardPage"));
const CoursesPage       = lazy(() => import("../pages/CoursesPage"));
const LessonsPage       = lazy(() => import("../pages/LessonsPage"));
const LessonPage        = lazy(() => import("../pages/LessonPage"));
const LearningPathsPage = lazy(() => import("../pages/LearningPathsPage"));
const LearningPathPage  = lazy(() => import("../pages/LearningPathPage"));
const ProfilePage       = lazy(() => import("../pages/ProfilePage"));

// ── Assessments ──────────────────────────────────────────────────────────────
const AssessmentsPage       = lazy(() => import("../pages/AssessmentsPage"));
const AssessmentPage        = lazy(() => import("../pages/AssessmentPage"));
const AssessmentTakePage    = lazy(() => import("../pages/AssessmentTakePage"));
const AssessmentResultPage  = lazy(() => import("../pages/AssessmentsResultPage"));
const AssessmentHistoryPage = lazy(() => import("../pages/AssessmentHistoryPage"));
const CourseAssessmentsPage = lazy(() => import("../pages/CourseAssessmentsPage"));

// ── Teacher ──────────────────────────────────────────────────────────────────
const TeacherDashboardPage     = lazy(() => import("../pages/TeacherDashboardPage"));
const TeacherClassDetailPage   = lazy(() => import("../pages/TeacherClassDetailPage"));
const TeacherStudentDetailPage = lazy(() => import("../pages/TeacherStudentDetailPage"));

// ── Other roles ──────────────────────────────────────────────────────────────
const PrincipalDashboardPage = lazy(() => import("../pages/PrincipalDashboardPage"));
const OfficialDashboardPage  = lazy(() => import("../pages/OfficialDashboardPage"));
const AdminDashboardPage     = lazy(() => import("../pages/AdminDashboardPage"));

// ── Admin / shared management ────────────────────────────────────────────────
const AdminContentPage           = lazy(() => import("../pages/AdminContentPage"));
const AdminLessonEditorPage      = lazy(() => import("../pages/AdminLessonEditorPage"));
const AdminAssessmentBuilderPage = lazy(() => import("../pages/AdminAssessmentBuilderPage"));
const AdminJoinCodesPage         = lazy(() => import("../pages/AdminJoinCodesPage"));
const UserManagementPage         = lazy(() => import("../pages/UserManagementPage"));

// ── Loading fallback ─────────────────────────────────────────────────────────
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
  // Root — redirect based on role
  { path: "/", element: <RoleBasedRedirect /> },

  // ── Public auth routes ────────────────────────────────────────────────────
  { path: "/login",            element: <LoginPage /> },
  { path: "/register",         element: <RegisterPage /> },
  { path: "/verify-otp",       element: <VerifyOtpPage /> },
  { path: "/complete-profile", element: <CompleteProfilePage /> },

  // ── Student ───────────────────────────────────────────────────────────────
  { path: "/dashboard",         element: <Protected role="STUDENT"><DashboardPage /></Protected> },
  { path: "/courses",           element: <Protected role="STUDENT"><CoursesPage /></Protected> },
  { path: "/courses/:courseId", element: <Protected role="STUDENT"><LessonsPage /></Protected> },
  { path: "/lessons/:lessonId", element: <Protected role="STUDENT"><LessonPage /></Protected> },
  { path: "/learning",          element: <Protected role="STUDENT"><LearningPathsPage /></Protected> },
  { path: "/learning/:pathId",  element: <Protected role="STUDENT"><LearningPathPage /></Protected> },
  { path: "/profile",           element: <Protected role="STUDENT"><ProfilePage /></Protected> },
  { path: "/courses/:courseId/assessments", element: <Protected role="STUDENT"><CourseAssessmentsPage /></Protected> },

  // Assessments — static routes BEFORE dynamic to prevent /history matching /:assessmentId
  { path: "/assessments",                       element: <Protected role="STUDENT"><AssessmentsPage /></Protected> },
  { path: "/assessments/history",               element: <Protected role="STUDENT"><AssessmentHistoryPage /></Protected> },
  { path: "/assessments/:assessmentId",         element: <Protected role="STUDENT"><AssessmentPage /></Protected> },
  { path: "/assessments/:assessmentId/take",    element: <Protected role="STUDENT"><AssessmentTakePage /></Protected> },
  { path: "/assessments/:assessmentId/history", element: <Protected role="STUDENT"><AssessmentHistoryPage /></Protected> },
  { path: "/assessment-result",                 element: <Protected role="STUDENT"><AssessmentResultPage /></Protected> },

  // ── Teacher ───────────────────────────────────────────────────────────────
  { path: "/teacher",                                      element: <Protected role="TEACHER"><TeacherDashboardPage /></Protected> },
  { path: "/teacher/classes/:classId",                     element: <Protected role="TEACHER"><TeacherClassDetailPage /></Protected> },
  { path: "/teacher/classes/:classId/students/:studentId", element: <Protected role="TEACHER"><TeacherStudentDetailPage /></Protected> },
  { path: "/teacher/courses/:courseId/lessons",            element: <Protected role="TEACHER"><AdminLessonEditorPage /></Protected> },
  { path: "/teacher/courses/:courseId/assessments",        element: <Protected role="TEACHER"><AdminAssessmentBuilderPage /></Protected> },

  // Teacher user management — create join codes for students in their sections
  { path: "/teacher/users", element: <Protected role="TEACHER"><UserManagementPage /></Protected> },

  // ── Principal ─────────────────────────────────────────────────────────────
  { path: "/principal",                                   element: <Protected role="PRINCIPAL"><PrincipalDashboardPage /></Protected> },
  { path: "/principal/courses/:courseId/lessons",         element: <Protected role="PRINCIPAL"><AdminLessonEditorPage /></Protected> },
  { path: "/principal/courses/:courseId/assessments",     element: <Protected role="PRINCIPAL"><AdminAssessmentBuilderPage /></Protected> },

  // Principal user management — create join codes for teachers/students in their school
  { path: "/principal/users", element: <Protected role="PRINCIPAL"><UserManagementPage /></Protected> },

  // ── Official ──────────────────────────────────────────────────────────────
  { path: "/official", element: <Protected role="OFFICIAL"><OfficialDashboardPage /></Protected> },

  // Official user management — create join codes for principals in their district
  { path: "/official/users", element: <Protected role="OFFICIAL"><UserManagementPage /></Protected> },

  // ── Admin ─────────────────────────────────────────────────────────────────
  { path: "/admin-panel",   element: <Protected role="ADMIN"><AdminDashboardPage /></Protected> },
  { path: "/admin/content", element: <Protected role="ADMIN"><AdminContentPage /></Protected> },
  { path: "/admin/content/courses/:courseId/lessons",     element: <Protected role="ADMIN"><AdminLessonEditorPage /></Protected> },
  { path: "/admin/content/courses/:courseId/assessments", element: <Protected role="ADMIN"><AdminAssessmentBuilderPage /></Protected> },
  { path: "/admin/join-codes", element: <Protected role="ADMIN"><AdminJoinCodesPage /></Protected> },
  { path: "/admin/users",      element: <Protected role="ADMIN"><UserManagementPage /></Protected> },

  // ── Error pages ───────────────────────────────────────────────────────────
  { path: "/403",           element: <ForbiddenPage /> },
  { path: "/500",           element: <ServerErrorPage /> },
  { path: "/network-error", element: <NetworkErrorPage /> },

  // ── 404 catch-all — MUST be last ──────────────────────────────────────────
  { path: "*", element: <NotFoundPage /> },
]);