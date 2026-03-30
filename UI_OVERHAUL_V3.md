# GyanGrit UI Overhaul V3 — Change Tracker
> Theme: "Chalk & Sunlight" | Started: 2026-03-30
> Design doc: DESIGN_SYSTEM_V3.md
> **STATUS: FOUNDATION COMPLETE ✅ — Visual refinement ongoing**

---

## Phase 1 — Foundation ✅ COMPLETE

| File | Type | Status | Notes |
|------|------|--------|-------|
| `frontend/src/index.css` | Full rewrite | ✅ | Warm parchment, saffron, Plus Jakarta Sans + Nunito |
| `frontend/src/components/Sidebar.tsx` | NEW FILE | ✅ | Role-aware drawer, replaces NavMenu |
| `frontend/src/components/TopBar.tsx` | Full rewrite | ✅ | Hamburger + Sidebar, warm tokens |
| `frontend/src/components/BottomNav.tsx` | Full rewrite | ✅ | Saffron pill indicator |
| `frontend/src/components/Logo.tsx` | Rewrite | ✅ | Book+spark SVG, saffron brand |
| `frontend/src/components/NavMenu.tsx` | Deprecated | ✅ | Sidebar replaces it; warm panel if still used |
| `frontend/src/components/LessonItem.tsx` | Clean | ✅ | CSS classes only, no raw tokens |
| `frontend/src/components/LogoutButton.tsx` | Clean | ✅ | CSS classes only |
| `frontend/src/components/NotificationPanel.tsx` | Token migration | ✅ | glass→warm tokens |
| `frontend/src/components/NotificationDetailModal.tsx` | Token migration | ✅ | glass→warm tokens |
| `frontend/src/components/Whiteboard.tsx` | Clean | ✅ | No presentation tokens |
| `frontend/src/components/ChunkErrorBoundary.tsx` | Update | ✅ | Warm inline styles |

---

## Phase 2 — Auth Pages ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/pages/LoginPage.tsx` | ✅ | Full rewrite — warm auth card, saffron accents, clean |
| `frontend/src/pages/RegisterPage.tsx` | ✅ | login-card CSS, warm tokens |
| `frontend/src/pages/VerifyOtpPage.tsx` | ✅ | Warm info box, saffron resend button |
| `frontend/src/pages/ForgotPasswordPage.tsx` | ✅ | login-page/login-card CSS |
| `frontend/src/pages/ResetPasswordPage.tsx` | ✅ | login-page/login-card CSS |
| `frontend/src/pages/CompleteProfilePage.tsx` | ✅ | glass→warm tokens |

---

## Phase 3 — Public Pages ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/pages/AboutPage.tsx` | ✅ | public-* CSS, no raw tokens |
| `frontend/src/pages/ContactPage.tsx` | ✅ | public-* CSS |
| `frontend/src/pages/FAQPage.tsx` | ✅ | public-* CSS, saffron contact link |
| `frontend/src/pages/PublicPages.css` | ✅ | Minimal warm overrides only |

---

## Phase 4 — Student Core Pages ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/pages/DashboardPage.tsx` | ✅ | Full rewrite — warm cards, saffron border-left, clean streaks |
| `frontend/src/pages/CoursesPage.tsx` | ✅ | Warm cards, saffron CTA arrow |
| `frontend/src/pages/LessonsPage.tsx` | ✅ | Token migration, backdropFilter removed |
| `frontend/src/pages/LessonPage.tsx` | ✅ | Warm video button, clean tokens |
| `frontend/src/pages/SectionLessonPage.tsx` | ✅ | Warm play button |
| `frontend/src/pages/ProfilePage.tsx` | ✅ | Saffron avatar, warm badges, grades section |
| `frontend/src/pages/LeaderboardPage.tsx` | ✅ | glass→warm tokens |
| `frontend/src/pages/LearningPathsPage.tsx` | ✅ | CSS classes, clean |
| `frontend/src/pages/LearningPathPage.tsx` | ✅ | CSS classes, clean |
| `frontend/src/pages/FlashcardDecksPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/FlashcardsStudyPage.tsx` | ✅ | Warm study bar |
| `frontend/src/pages/NotificationsPage.tsx` | ✅ | warm tokens |

---

## Phase 5 — Assessment Pages ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/pages/AssessmentsPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/AssessmentPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/AssessmentTakePage.tsx` | ✅ | CSS classes, saffron buttons |
| `frontend/src/pages/AssessmentsResultPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/AssessmentHistoryPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/CourseAssessmentsPage.tsx` | ✅ | CSS classes, clean |

---

## Phase 6 — Feature Pages ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/pages/AIChatPage.tsx` | ✅ | Warm sidebars/headers, no dark surfaces |
| `frontend/src/pages/ChatRoomPage.tsx` | ✅ | Warm sidebars, no dark surfaces |
| `frontend/src/pages/CompetitionRoomPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/LiveSessionPage.tsx` | ✅ | warm tokens |

---

## Phase 7 — Teacher/Staff Pages ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/pages/TeacherDashboardPage.tsx` | ✅ | Full clean rewrite — warm cards, emerald subjects |
| `frontend/src/pages/TeacherClassDetailPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/TeacherStudentDetailPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/GradebookPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/PrincipalDashboardPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/OfficialDashboardPage.tsx` | ✅ | warm tokens |

---

## Phase 8 — Admin Pages ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/pages/AdminDashboardPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/AdminContentPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/AdminLessonEditorPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/AdminAssessmentBuilderPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/AdminJoinCodesPage.tsx` | ✅ | Warm modal overlay |
| `frontend/src/pages/AdminChatManagementPage.tsx` | ✅ | warm tokens |
| `frontend/src/pages/UserManagementPage.tsx` | ✅ | warm tokens |

---

## Phase 9 — Error Pages ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/pages/errors/ErrorPage.tsx` | ✅ | Warm card, saffron glow, visible ghost number |
| `frontend/src/pages/errors/NotFoundPage.tsx` | ✅ | Uses ErrorPage |
| `frontend/src/pages/errors/ForbiddenPage.tsx` | ✅ | Uses ErrorPage |
| `frontend/src/pages/errors/ServerErrorPage.tsx` | ✅ | Uses ErrorPage |
| `frontend/src/pages/errors/NetworkErrorPage.tsx` | ✅ | Uses ErrorPage |

---

## Final Token Audit
- ✅ Zero `--glass-*` tokens in production
- ✅ Zero `--text-primary/secondary/muted` old tokens
- ✅ Zero `--brand-primary` old tokens → replaced with `--saffron`
- ✅ Zero `rgba(10,15,26,*)` dark surfaces in production
- ✅ All `backdropFilter` removed from pages (not needed in light theme)
- ✅ NavMenu removed from all production imports → Sidebar used
- ✅ Build passes, zero TypeScript errors

## What V3 Looks Like
- **Background**: warm parchment `#FDF8F0` (not void black)
- **Cards**: white `#FFFFFF` with warm brown shadows
- **Accent**: saffron amber `#F59E0B` (Indian, energetic)
- **Left-border accents** on subject cards (progress color)
- **Fonts**: Plus Jakarta Sans (display) + Nunito (body)
- **Nav**: Sidebar drawer (role-aware, desktop persistent / mobile slide-over)
- **Bottom nav**: saffron pill indicator
- **Dark mode**: ink-on-parchment via `prefers-color-scheme`
