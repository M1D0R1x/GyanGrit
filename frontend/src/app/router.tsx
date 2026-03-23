// app.router
/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";

import LoginPage           from "../pages/LoginPage";
import RegisterPage        from "../pages/RegisterPage";
import VerifyOtpPage       from "../pages/VerifyOtpPage";
import CompleteProfilePage from "../pages/CompleteProfilePage";

import { RequireRole }   from "../auth/RequireRole";
import RoleBasedRedirect from "../auth/RoleBasedRedirect";

// Error pages — eagerly loaded
import NotFoundPage     from "../pages/errors/NotFoundPage";
import ForbiddenPage    from "../pages/errors/ForbiddenPage";
import ServerErrorPage  from "../pages/errors/ServerErrorPage";
import NetworkErrorPage from "../pages/errors/NetworkErrorPage";

// ── Student ──────────────────────────────────────────────────────────────────
const DashboardPage      = lazy(() => import("../pages/DashboardPage"));
const CoursesPage        = lazy(() => import("../pages/CoursesPage"));
const LessonsPage        = lazy(() => import("../pages/LessonsPage"));
const LessonPage         = lazy(() => import("../pages/LessonPage"));
const SectionLessonPage  = lazy(() => import("../pages/SectionLessonPage"));
const LearningPathsPage  = lazy(() => import("../pages/LearningPathsPage"));
const LearningPathPage   = lazy(() => import("../pages/LearningPathPage"));
const ProfilePage        = lazy(() => import("../pages/ProfilePage"));
const LeaderboardPage    = lazy(() => import("../pages/LeaderboardPage"));

// ── Assessments ──────────────────────────────────────────────────────────────
const AssessmentsPage        = lazy(() => import("../pages/AssessmentsPage"));
const AssessmentPage         = lazy(() => import("../pages/AssessmentPage"));
const AssessmentTakePage     = lazy(() => import("../pages/AssessmentTakePage"));
const AssessmentResultPage   = lazy(() => import("../pages/AssessmentsResultPage"));
const AssessmentHistoryPage  = lazy(() => import("../pages/AssessmentHistoryPage"));
const CourseAssessmentsPage  = lazy(() => import("../pages/CourseAssessmentsPage"));

// ── Teacher ──────────────────────────────────────────────────────────────────
const TeacherDashboardPage     = lazy(() => import("../pages/TeacherDashboardPage"));
const TeacherClassDetailPage   = lazy(() => import("../pages/TeacherClassDetailPage"));
const TeacherStudentDetailPage = lazy(() => import("../pages/TeacherStudentDetailPage"));
const GradebookPage            = lazy(() => import("../pages/GradebookPage"));

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

// ── Shared ────────────────────────────────────────────────────────────────────
const NotificationsPage    = lazy(() => import("../pages/NotificationsPage"));

// ── Competition Rooms ─────────────────────────────────────────────────────────
const CompetitionRoomPage  = lazy(() => import("../pages/CompetitionRoomPage"));

// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Public ───────────────────────────────────────────────────────────────
  { path: "/login",            element: <LoginPage /> },
  { path: "/register",         element: <RegisterPage /> },
  { path: "/verify-otp",       element: <VerifyOtpPage /> },
  { path: "/complete-profile", element: <CompleteProfilePage /> },

  // ── Shared — all authenticated roles (rank ≥ STUDENT = everyone) ─────────
  { path: "/notifications", element: <Protected role="STUDENT"><NotificationsPage /></Protected> },
  { path: "/profile",       element: <Protected role="STUDENT"><ProfilePage /></Protected> },

  // ── Student ───────────────────────────────────────────────────────────────
  { path: "/dashboard",   element: <Protected role="STUDENT"><DashboardPage /></Protected> },
  { path: "/leaderboard", element: <Protected role="STUDENT"><LeaderboardPage /></Protected> },
  { path: "/learning",           element: <Protected role="STUDENT"><LearningPathsPage /></Protected> },
  { path: "/learning/:pathId",   element: <Protected role="STUDENT"><LearningPathPage /></Protected> },

  // Lesson routes — global + section (teacher-added)
  { path: "/lessons/:lessonId",         element: <Protected role="STUDENT"><LessonPage /></Protected> },
  { path: "/lessons/section/:lessonId", element: <Protected role="STUDENT"><SectionLessonPage /></Protected> },

  // Courses — human-readable slug routes
  { path: "/courses",                             element: <Protected role="STUDENT"><CoursesPage /></Protected> },
  { path: "/courses/:grade/:subject",             element: <Protected role="STUDENT"><LessonsPage /></Protected> },
  { path: "/courses/:grade/:subject/assessments", element: <Protected role="STUDENT"><CourseAssessmentsPage /></Protected> },

  // Assessments — human-readable slug routes
  { path: "/assessments",                                               element: <Protected role="STUDENT"><AssessmentsPage /></Protected> },
  { path: "/assessments/history",                                       element: <Protected role="STUDENT"><AssessmentHistoryPage /></Protected> },
  { path: "/assessments/:grade/:subject/:assessmentId",                 element: <Protected role="STUDENT"><AssessmentPage /></Protected> },
  { path: "/assessments/:grade/:subject/:assessmentId/take",            element: <Protected role="STUDENT"><AssessmentTakePage /></Protected> },
  { path: "/assessments/:grade/:subject/:assessmentId/history",         element: <Protected role="STUDENT"><AssessmentHistoryPage /></Protected> },
  { path: "/assessment-result",                                         element: <Protected role="STUDENT"><AssessmentResultPage /></Protected> },

  // Competition rooms — students
  { path: "/competitions",              element: <Protected role="STUDENT"><CompetitionRoomPage /></Protected> },
  { path: "/competitions/:roomId",      element: <Protected role="STUDENT"><CompetitionRoomPage /></Protected> },

  // ── Teacher ───────────────────────────────────────────────────────────────
  { path: "/teacher",                                        element: <Protected role="TEACHER"><TeacherDashboardPage /></Protected> },
  { path: "/teacher/classes/:classId",                       element: <Protected role="TEACHER"><TeacherClassDetailPage /></Protected> },
  { path: "/teacher/classes/:classId/gradebook",             element: <Protected role="TEACHER"><GradebookPage /></Protected> },
  { path: "/teacher/classes/:classId/students/:studentId",   element: <Protected role="TEACHER"><TeacherStudentDetailPage /></Protected> },
  { path: "/teacher/courses/:courseId/lessons",              element: <Protected role="TEACHER"><AdminLessonEditorPage /></Protected> },
  { path: "/teacher/courses/:courseId/assessments",          element: <Protected role="TEACHER"><AdminAssessmentBuilderPage /></Protected> },
  { path: "/teacher/users",                                  element: <Protected role="TEACHER"><UserManagementPage /></Protected> },
  // Competition rooms — teachers
  { path: "/teacher/competitions",              element: <Protected role="TEACHER"><CompetitionRoomPage /></Protected> },
  { path: "/teacher/competitions/:roomId",      element: <Protected role="TEACHER"><CompetitionRoomPage /></Protected> },

  // ── Principal ─────────────────────────────────────────────────────────────
  { path: "/principal",                                          element: <Protected role="PRINCIPAL"><PrincipalDashboardPage /></Protected> },
  { path: "/principal/classes/:classId",                         element: <Protected role="PRINCIPAL"><TeacherClassDetailPage /></Protected> },
  { path: "/principal/classes/:classId/gradebook",               element: <Protected role="PRINCIPAL"><GradebookPage /></Protected> },
  { path: "/principal/classes/:classId/students/:studentId",     element: <Protected role="PRINCIPAL"><TeacherStudentDetailPage /></Protected> },
  { path: "/principal/courses/:courseId/lessons",                element: <Protected role="PRINCIPAL"><AdminLessonEditorPage /></Protected> },
  { path: "/principal/courses/:courseId/assessments",            element: <Protected role="PRINCIPAL"><AdminAssessmentBuilderPage /></Protected> },
  { path: "/principal/users",                                    element: <Protected role="PRINCIPAL"><UserManagementPage /></Protected> },
  { path: "/principal/competitions",              element: <Protected role="PRINCIPAL"><CompetitionRoomPage /></Protected> },
  { path: "/principal/competitions/:roomId",      element: <Protected role="PRINCIPAL"><CompetitionRoomPage /></Protected> },

  // ── Official ──────────────────────────────────────────────────────────────
  { path: "/official",       element: <Protected role="OFFICIAL"><OfficialDashboardPage /></Protected> },
  { path: "/official/users", element: <Protected role="OFFICIAL"><UserManagementPage /></Protected> },

  // ── Admin ─────────────────────────────────────────────────────────────────
  { path: "/admin-panel",   element: <Protected role="ADMIN"><AdminDashboardPage /></Protected> },
  { path: "/admin/content", element: <Protected role="ADMIN"><AdminContentPage /></Protected> },
  { path: "/admin/content/courses/:courseId/lessons",     element: <Protected role="ADMIN"><AdminLessonEditorPage /></Protected> },
  { path: "/admin/content/courses/:courseId/assessments", element: <Protected role="ADMIN"><AdminAssessmentBuilderPage /></Protected> },
  { path: "/admin/join-codes", element: <Protected role="ADMIN"><AdminJoinCodesPage /></Protected> },
  { path: "/admin/users",      element: <Protected role="ADMIN"><UserManagementPage /></Protected> },
  { path: "/admin/competitions",         element: <Protected role="ADMIN"><CompetitionRoomPage /></Protected> },
  { path: "/admin/competitions/:roomId", element: <Protected role="ADMIN"><CompetitionRoomPage /></Protected> },

  // ── Error pages ───────────────────────────────────────────────────────────
  { path: "/403",           element: <ForbiddenPage /> },
  { path: "/500",           element: <ServerErrorPage /> },
  { path: "/network-error", element: <NetworkErrorPage /> },
  { path: "*",              element: <NotFoundPage /> },
]);
