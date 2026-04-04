// app.router
/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";

import LoginPage           from "../pages/LoginPage";
import RegisterPage        from "../pages/RegisterPage";
import VerifyOtpPage       from "../pages/VerifyOtpPage";
import CompleteProfilePage from "../pages/CompleteProfilePage";
import ForgotPasswordPage  from "../pages/ForgotPasswordPage";
import ResetPasswordPage   from "../pages/ResetPasswordPage";

import AboutPage           from "../pages/AboutPage";
import ContactPage         from "../pages/ContactPage";
import FAQPage             from "../pages/FAQPage";

// Auth pages — lazy loaded. Authenticated users land on dashboard, not login,
// so these only load when actually needed (saves ~40KB from entry bundle on 3G).

/**
 * Retry-aware lazy loader for code-split pages.
 *
 * After a Vercel deploy, old JS chunk URLs (with content hashes) become 404s.
 * If a user has the app open and navigates to a lazy route, the old chunk
 * fails to load: "Failed to fetch dynamically imported module".
 *
 * This wrapper catches that error and does a hard reload ONE time so the
 * browser fetches the new index.html which points to the new chunk hashes.
 * A sessionStorage flag prevents infinite reload loops.
 */
function lazyRetry(factory: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const isChunkError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.message.includes("Failed to fetch") ||
           err.message.includes("dynamically imported module") ||
           err.message.includes("Loading chunk")));

      if (isChunkError) {
        const key = `chunk-retry-${window.location.pathname}`;
        if (!sessionStorage.getItem(key)) {
          console.warn(`[lazyRetry] Chunk load failed for ${window.location.pathname} — reloading`);
          sessionStorage.setItem(key, "1");
          window.location.reload();
          return new Promise(() => {}); // never resolve — page is reloading
        }
        // Already retried — let ChunkErrorBoundary handle it
        sessionStorage.removeItem(key);
      }
      throw err;
    })
  );
}

import { RequireRole }   from "../auth/RequireRole";
import RoleBasedRedirect from "../auth/RoleBasedRedirect";
import AppLayout         from "../components/AppLayout";

// Error pages — eagerly loaded
import NotFoundPage     from "../pages/errors/NotFoundPage";
import ForbiddenPage    from "../pages/errors/ForbiddenPage";
import ServerErrorPage  from "../pages/errors/ServerErrorPage";
import NetworkErrorPage from "../pages/errors/NetworkErrorPage";

// ── Student ──────────────────────────────────────────────────────────────────
const DashboardPage      = lazyRetry(() => import("../pages/DashboardPage"));
const CoursesPage        = lazyRetry(() => import("../pages/CoursesPage"));
const LessonsPage        = lazyRetry(() => import("../pages/LessonsPage"));
const LessonPage         = lazyRetry(() => import("../pages/LessonPage"));
const SectionLessonPage  = lazyRetry(() => import("../pages/SectionLessonPage"));
const LearningPathsPage  = lazyRetry(() => import("../pages/LearningPathsPage"));
const LearningPathPage   = lazyRetry(() => import("../pages/LearningPathPage"));
const ProfilePage        = lazyRetry(() => import("../pages/ProfilePage"));
const LeaderboardPage    = lazyRetry(() => import("../pages/LeaderboardPage"));

// ── Assessments ──────────────────────────────────────────────────────────────
const AssessmentsPage        = lazyRetry(() => import("../pages/AssessmentsPage"));
const AssessmentPage         = lazyRetry(() => import("../pages/AssessmentPage"));
const AssessmentTakePage     = lazyRetry(() => import("../pages/AssessmentTakePage"));
const AssessmentResultPage   = lazyRetry(() => import("../pages/AssessmentsResultPage"));
const AssessmentHistoryPage  = lazyRetry(() => import("../pages/AssessmentHistoryPage"));
const CourseAssessmentsPage  = lazyRetry(() => import("../pages/CourseAssessmentsPage"));

// ── Teacher ──────────────────────────────────────────────────────────────────
const TeacherDashboardPage     = lazyRetry(() => import("../pages/TeacherDashboardPage"));
const TeacherClassDetailPage   = lazyRetry(() => import("../pages/TeacherClassDetailPage"));
const TeacherStudentDetailPage = lazyRetry(() => import("../pages/TeacherStudentDetailPage"));
const GradebookPage            = lazyRetry(() => import("../pages/GradebookPage"));

// ── Other roles ──────────────────────────────────────────────────────────────
const PrincipalDashboardPage = lazyRetry(() => import("../pages/PrincipalDashboardPage"));
const OfficialDashboardPage  = lazyRetry(() => import("../pages/OfficialDashboardPage"));
const AdminDashboardPage     = lazyRetry(() => import("../pages/AdminDashboardPage"));

// ── Admin / shared management ────────────────────────────────────────────────
const AdminContentPage           = lazyRetry(() => import("../pages/AdminContentPage"));
const AdminLessonEditorPage      = lazyRetry(() => import("../pages/AdminLessonEditorPage"));
const AdminAssessmentBuilderPage = lazyRetry(() => import("../pages/AdminAssessmentBuilderPage"));
const AdminJoinCodesPage         = lazyRetry(() => import("../pages/AdminJoinCodesPage"));
const UserManagementPage         = lazyRetry(() => import("../pages/UserManagementPage"));

// ── Shared ──────────────────────────────────────────────────────────────────────
const NotificationsPage      = lazyRetry(() => import("../pages/NotificationsPage"));
const OfflineDownloadsPage   = lazyRetry(() => import("../pages/OfflineDownloadsPage"));

// ── Competition Rooms ─────────────────────────────────────────────────────────
const CompetitionRoomPage  = lazyRetry(() => import("../pages/CompetitionRoomPage"));

// ── Chat Rooms ────────────────────────────────────────────────────────────────
const ChatRoomPage              = lazyRetry(() => import("../pages/ChatRoomPage"));
const AdminChatManagementPage   = lazyRetry(() => import("../pages/AdminChatManagementPage"));

// ── Flashcards ────────────────────────────────────────────────────────────────
const FlashcardDecksPage    = lazyRetry(() => import("../pages/FlashcardDecksPage"));
const FlashcardsStudyPage   = lazyRetry(() => import("../pages/FlashcardsStudyPage"));

// ── Live Sessions ─────────────────────────────────────────────────────────────
const LiveSessionPage       = lazyRetry(() => import("../pages/LiveSessionPage"));

// ── Recordings ────────────────────────────────────────────────────────────────
const RecordedSessionsPage  = lazyRetry(() => import("../pages/RecordedSessionsPage"));
const RecordingPlayerPage   = lazyRetry(() => import("../pages/RecordingPlayerPage"));

// ── AI Chatbot ────────────────────────────────────────────────────────────────
const AIChatPage            = lazyRetry(() => import("../pages/AIChatPage"));

// ── AI Tools ──────────────────────────────────────────────────────────────────
const AIToolsPage           = lazyRetry(() => import("../pages/AIToolsPage"));

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
  title,
}: {
  role: Parameters<typeof RequireRole>[0]["role"];
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <RequireRole role={role}>
      <Suspense fallback={<PageLoader />}>
        <AppLayout title={title}>
          {children}
        </AppLayout>
      </Suspense>
    </RequireRole>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <RoleBasedRedirect /> },

  // ── Public ───────────────────────────────────────────────────────────────
  { path: "/about",            element: <AboutPage /> },
  { path: "/contact",          element: <ContactPage /> },
  { path: "/faq",              element: <FAQPage /> },
  { path: "/login",            element: <LoginPage /> },
  { path: "/register",         element: <RegisterPage /> },
  { path: "/verify-otp",       element: <VerifyOtpPage /> },
  { path: "/complete-profile", element: <CompleteProfilePage /> },
  { path: "/forgot-password",  element: <ForgotPasswordPage /> },
  { path: "/reset-password/:uidb64/:token", element: <ResetPasswordPage /> },


  // ── Shared — all authenticated roles (rank ≥ STUDENT = everyone) ─────────
  { path: "/notifications", element: <Protected role="STUDENT"><NotificationsPage /></Protected> },
  { path: "/profile",       element: <Protected role="STUDENT"><ProfilePage /></Protected> },
  { path: "/downloads",     element: <Protected role="STUDENT"><OfflineDownloadsPage /></Protected> },

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

  // Chat rooms — students
  { path: "/chat",                      element: <Protected role="STUDENT"><ChatRoomPage /></Protected> },
  { path: "/chat/:roomId",              element: <Protected role="STUDENT"><ChatRoomPage /></Protected> },

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
  { path: "/teacher/chat",                      element: <Protected role="TEACHER"><ChatRoomPage /></Protected> },
  { path: "/teacher/chat/:roomId",              element: <Protected role="TEACHER"><ChatRoomPage /></Protected> },
  { path: "/teacher/ai-tools",                  element: <Protected role="TEACHER"><AIToolsPage /></Protected> },

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
  { path: "/principal/chat",                      element: <Protected role="PRINCIPAL"><ChatRoomPage /></Protected> },
  { path: "/principal/chat/:roomId",              element: <Protected role="PRINCIPAL"><ChatRoomPage /></Protected> },
  { path: "/principal/ai-tools",                  element: <Protected role="PRINCIPAL"><AIToolsPage /></Protected> },

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
  { path: "/admin/chat",                 element: <Protected role="ADMIN"><ChatRoomPage /></Protected> },
  { path: "/admin/chat/:roomId",         element: <Protected role="ADMIN"><ChatRoomPage /></Protected> },
  { path: "/admin/chat-management",      element: <Protected role="ADMIN"><AdminChatManagementPage /></Protected> },
  { path: "/admin/ai-tools",             element: <Protected role="ADMIN"><AIToolsPage /></Protected> },

  // ── Flashcards ──────────────────────────────────────────────────────────────
  // Student study
  { path: "/flashcards",              element: <Protected role="STUDENT"><FlashcardsStudyPage /></Protected> },
  { path: "/flashcards/:deckId",      element: <Protected role="STUDENT"><FlashcardsStudyPage /></Protected> },
  // Teacher / principal manage decks
  { path: "/teacher/flashcards",      element: <Protected role="TEACHER"><FlashcardDecksPage /></Protected> },
  { path: "/principal/flashcards",    element: <Protected role="PRINCIPAL"><FlashcardDecksPage /></Protected> },
  { path: "/admin/flashcards",        element: <Protected role="ADMIN"><FlashcardDecksPage /></Protected> },

  // ── Live Sessions ────────────────────────────────────────────────────────────
  { path: "/live",                    element: <Protected role="STUDENT"><LiveSessionPage /></Protected> },
  { path: "/live/:sessionId",         element: <Protected role="STUDENT"><LiveSessionPage /></Protected> },
  { path: "/teacher/live",            element: <Protected role="TEACHER"><LiveSessionPage /></Protected> },
  { path: "/teacher/live/:sessionId", element: <Protected role="TEACHER"><LiveSessionPage /></Protected> },
  { path: "/principal/live",          element: <Protected role="PRINCIPAL"><LiveSessionPage /></Protected> },
  { path: "/principal/live/:sessionId", element: <Protected role="PRINCIPAL"><LiveSessionPage /></Protected> },
  { path: "/admin/live",              element: <Protected role="ADMIN"><LiveSessionPage /></Protected> },
  { path: "/admin/live/:sessionId",   element: <Protected role="ADMIN"><LiveSessionPage /></Protected> },

  // ── Recordings ───────────────────────────────────────────────────────────────
  // Students: only see READY recordings for their section
  { path: "/recordings",              element: <Protected role="STUDENT"><RecordedSessionsPage /></Protected> },
  { path: "/recordings/:sessionId",   element: <Protected role="STUDENT"><RecordingPlayerPage /></Protected> },
  // Teachers: see all statuses for their own sessions
  { path: "/teacher/recordings",              element: <Protected role="TEACHER"><RecordedSessionsPage /></Protected> },
  { path: "/teacher/recordings/:sessionId",   element: <Protected role="TEACHER"><RecordingPlayerPage /></Protected> },
  // Principal / Admin: full visibility
  { path: "/principal/recordings",            element: <Protected role="PRINCIPAL"><RecordedSessionsPage /></Protected> },
  { path: "/principal/recordings/:sessionId", element: <Protected role="PRINCIPAL"><RecordingPlayerPage /></Protected> },
  { path: "/admin/recordings",                element: <Protected role="ADMIN"><RecordedSessionsPage /></Protected> },
  { path: "/admin/recordings/:sessionId",     element: <Protected role="ADMIN"><RecordingPlayerPage /></Protected> },

  // ── AI Chatbot ───────────────────────────────────────────────────────────────
  { path: "/ai-tutor",                element: <Protected role="STUDENT"><AIChatPage /></Protected> },
  { path: "/teacher/ai-tutor",        element: <Protected role="TEACHER"><AIChatPage /></Protected> },
  { path: "/admin/ai-tutor",          element: <Protected role="ADMIN"><AIChatPage /></Protected> },

  // ── Error pages ───────────────────────────────────────────────────────────
  { path: "/403",           element: <ForbiddenPage /> },
  { path: "/500",           element: <ServerErrorPage /> },
  { path: "/network-error", element: <NetworkErrorPage /> },
  { path: "*",              element: <NotFoundPage /> },
]);
