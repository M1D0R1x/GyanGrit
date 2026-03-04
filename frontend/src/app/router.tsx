/* eslint-disable react-refresh/only-export-components */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

import DashboardPage from "../pages/DashboardPage";
import CoursesPage from "../pages/CoursesPage";
import LessonsPage from "../pages/LessonsPage";
import LessonPage from "../pages/LessonPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import VerifyOtpPage from "../pages/VerifyOtpPage";

import { RequireRole } from "../auth/RequireRole";
import RoleBasedRedirect from "../auth/RoleBasedRedirect";

// Lazy load heavy pages
const TeacherDashboardPage = lazy(() => import("../pages/TeacherDashboardPage"));
const OfficialDashboardPage = lazy(() => import("../pages/OfficialDashboardPage"));
const AdminDashboardPage = lazy(() => import("../pages/AdminDashboardPage"));
const PrincipalDashboardPage = lazy(() => import("../pages/PrincipalDashboardPage"));
const LearningPathsPage = lazy(() => import("../pages/LearningPathsPage"));
const LearningPathPage = lazy(() => import("../pages/LearningPathPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const CourseAssessmentsPage = lazy(() => import("../pages/CourseAssessmentsPage"));
const AssessmentPage = lazy(() => import("../pages/AssessmentPage"));
const AssessmentResultPage = lazy(() => import("../pages/AssessmentsResultPage"));
const AssessmentHistoryPage = lazy(() => import("../pages/AssessmentHistoryPage"));
const TeacherClassDetailPage = lazy(() => import("../pages/TeacherClassDetailPage"));
const TeacherStudentDetailPage = lazy(() => import("../pages/TeacherStudentDetailPage"));

// Loading fallback
const PageLoader = () => (
  <div style={{ textAlign: "center", padding: "100px 20px", fontSize: "1.1rem" }}>
    Loading...
  </div>
);

export const router = createBrowserRouter([
  { path: "/", element: <RoleBasedRedirect /> },

  // STUDENT ROUTES (eager loaded - fastest for students)
  { path: "/dashboard", element: <RequireRole role="STUDENT"><DashboardPage /></RequireRole> },
  { path: "/courses", element: <CoursesPage /> },
  { path: "/courses/:courseId", element: <LessonsPage /> },
  { path: "/lessons/:lessonId", element: <LessonPage /> },

  // Lazy loaded routes
  { path: "/learning", element: <RequireRole role="STUDENT"><Suspense fallback={<PageLoader />}><LearningPathsPage /></Suspense></RequireRole> },
  { path: "/learning/:pathId", element: <RequireRole role="STUDENT"><Suspense fallback={<PageLoader />}><LearningPathPage /></Suspense></RequireRole> },
  { path: "/profile", element: <RequireRole role="STUDENT"><Suspense fallback={<PageLoader />}><ProfilePage /></Suspense></RequireRole> },

  // TEACHER
  { path: "/teacher", element: <RequireRole role="TEACHER"><Suspense fallback={<PageLoader />}><TeacherDashboardPage /></Suspense></RequireRole> },

  // PRINCIPAL → New Principal Dashboard
  { path: "/official", element: <RequireRole role="PRINCIPAL"><Suspense fallback={<PageLoader />}><PrincipalDashboardPage /></Suspense></RequireRole> },

  // OFFICIAL (if needed later)
  { path: "/official-dashboard", element: <RequireRole role="OFFICIAL"><Suspense fallback={<PageLoader />}><OfficialDashboardPage /></Suspense></RequireRole> },

  // ADMIN
  { path: "/admin-panel", element: <RequireRole role="ADMIN"><Suspense fallback={<PageLoader />}><AdminDashboardPage /></Suspense></RequireRole> },

  // Assessments
  { path: "/courses/:courseId/assessments", element: <Suspense fallback={<PageLoader />}><CourseAssessmentsPage /></Suspense> },
  { path: "/assessments/:assessmentId", element: <Suspense fallback={<PageLoader />}><AssessmentPage /></Suspense> },
  { path: "/assessment-result", element: <AssessmentResultPage /> },
  { path: "/assessments/:assessmentId/history", element: <Suspense fallback={<PageLoader />}><AssessmentHistoryPage /></Suspense> },

  // Teacher sub-pages
  { path: "/teacher/classes/:classId", element: <RequireRole role="TEACHER"><Suspense fallback={<PageLoader />}><TeacherClassDetailPage /></Suspense></RequireRole> },
  { path: "/teacher/classes/:classId/students/:studentId", element: <RequireRole role="TEACHER"><Suspense fallback={<PageLoader />}><TeacherStudentDetailPage /></Suspense></RequireRole> },

  // Auth
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/verify-otp", element: <VerifyOtpPage /> },

  { path: "*", element: <Navigate to="/" replace /> },
]);