# GyanGrit — Mobile PWA UI/UX Skill Prompt
> Give this entire document to Claude when asking for any mobile UI work on GyanGrit.
> It provides Claude the full context needed to produce native-feeling mobile UI, not a scaled-down desktop.

---

## 0. The Core Problem You're Solving

GyanGrit's current PWA is a **desktop layout shrunk to fit a phone screen**. The fix is not "make it responsive" — it's a **fundamentally different UI paradigm for mobile**:

| Desktop Web | Mobile PWA (Target) |
|---|---|
| Sidebar navigation | Bottom tab bar (iOS/Android pattern) |
| Wide cards in a grid | Full-width stacked cards |
| Hover states for actions | Touch-first tap targets (min 48px) |
| Content-dense data tables | Scannable list rows with key info only |
| Fixed header with many links | Minimal top bar — title + 1–2 icons only |
| Modals from center | Bottom sheets that slide up |
| Click to expand | Swipe gestures |
| Buttons anywhere | Primary CTA anchored to bottom |

**GyanGrit's audience:** Rural school students in Punjab on budget Android phones (4–5" screens, often 2G/3G). Every UI decision must prioritise **speed, clarity, thumb reachability, and data efficiency**.

---

## 1. Project Context (Always Remind Claude)

```
Platform:     React 19 + Vite + TypeScript (no Tailwind, custom CSS)
Design System: Obsidian Glassmorphism v3 (dark glass, blur, subtle gradients)
Backend:      Django REST API at https://api.gyangrit.site/api/v1/
Auth:         Session cookies, role-based (STUDENT, TEACHER, PRINCIPAL, OFFICIAL, ADMIN)
PWA:          Installed on Android home screen, display: standalone
Target Users: Rural school students, teachers in Punjab, India
Devices:      Budget Android (360–390px wide), occasional iOS
Network:      2G/3G — every KB matters, no heavy animations
Language:     Hindi/Punjabi text must fit in UI elements (longer strings than English)
```

---

## 2. Mobile Layout Rules (Non-Negotiable)

### 2.1 Navigation Architecture

```
NEVER on mobile:               USE instead:
- Left sidebar                 Bottom tab bar (5 tabs max)
- Top nav with 4+ links        Top bar: back arrow + page title + 1 icon
- Hamburger menu               Bottom sheet drawer (if overflow needed)
- Desktop-style breadcrumbs    Back arrow + page title only
```

**Bottom Tab Bar for Students:**
```
[🏠 Home] [📚 Courses] [🏆 Games] [💬 Chat] [👤 Profile]
```

**Bottom Tab Bar for Teachers:**
```
[🏠 Home] [📊 Analytics] [✏️ Content] [🔔 Alerts] [👤 Profile]
```

Each tab icon must be 24px, label 10–11px, entire tab target 64px tall minimum.

### 2.2 Safe Area & Status Bar

```css
/* Always include — handles iPhone notch and Android system bars */
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

.top-bar {
  padding-top: calc(var(--safe-top) + 12px);
  height: calc(56px + var(--safe-top));
}

.bottom-nav {
  padding-bottom: calc(var(--safe-bottom) + 8px);
  height: calc(64px + var(--safe-bottom));
}

.page-content {
  /* Space for fixed top bar + fixed bottom nav */
  padding-top: calc(56px + var(--safe-top));
  padding-bottom: calc(64px + var(--safe-bottom) + 16px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
```

### 2.3 Touch Targets

```css
/* Every tappable element — minimum size */
.tap-target {
  min-height: 48px;
  min-width: 48px;
  display: flex;
  align-items: center;
  /* If visual element is smaller, use padding to expand hit area */
  padding: 12px;
}

/* Spacing between adjacent tap targets */
.tap-target + .tap-target {
  margin-top: 8px; /* min 8px between adjacent touchables */
}
```

### 2.4 Typography Scale (Mobile)

```css
:root {
  /* Mobile-first type scale — slightly larger than desktop for readability */
  --text-xs:   11px;  /* Tab labels, timestamps, metadata */
  --text-sm:   13px;  /* Secondary text, captions */
  --text-base: 15px;  /* Body text (NOT 14px — too small on budget phones) */
  --text-md:   17px;  /* Card titles, list item primary text */
  --text-lg:   20px;  /* Section headers */
  --text-xl:   24px;  /* Page titles */
  --text-2xl:  28px;  /* Hero numbers, points, streak count */

  /* Line height critical for Hindi/Punjabi script */
  --leading-tight:  1.3;  /* Headlines only */
  --leading-normal: 1.6;  /* Body text — Gurmukhi needs more space */
  --leading-loose:  1.8;  /* Small text for accessibility */
}
```

### 2.5 Spacing System

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;   /* Standard card padding */
  --space-5:  20px;
  --space-6:  24px;   /* Section gap */
  --space-8:  32px;
  --space-10: 40px;

  /* Page horizontal padding — NEVER less than 16px */
  --page-px: 16px;
}
```

---

## 3. GyanGrit Obsidian Glassmorphism — Mobile Adaptation

The existing design system uses dark glass. These are the exact tokens to use:

```css
:root {
  /* Base dark background — OLED-friendly */
  --bg-base:       #0a0a0f;
  --bg-surface:    #111118;
  --bg-elevated:   #1a1a24;

  /* Glass cards */
  --glass-bg:      rgba(255, 255, 255, 0.05);
  --glass-border:  rgba(255, 255, 255, 0.08);
  --glass-blur:    blur(12px);  /* Reduce to blur(8px) on low-end devices */

  /* Brand colors */
  --primary:       #6c63ff;   /* Purple — main CTA */
  --primary-light: #8b84ff;
  --accent:        #ff6584;   /* Pink — streak, achievements */
  --success:       #4ade80;   /* Green — completed, passed */
  --warning:       #fbbf24;   /* Yellow — in progress, medium risk */
  --danger:        #f87171;   /* Red — failed, high risk */

  /* Text */
  --text-primary:   rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(255, 255, 255, 0.55);
  --text-tertiary:  rgba(255, 255, 255, 0.35);

  /* Interactive states */
  --tap-highlight: rgba(108, 99, 255, 0.15);
}

/* Mobile glass card — use this as the base for all cards */
.card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: var(--space-4);
  /* Skip backdrop-filter on list items — too expensive on budget phones */
  /* Only use it on modals and bottom sheets */
}

/* Active state for touch — replaces hover */
.card:active,
.list-item:active {
  background: rgba(255, 255, 255, 0.08);
  transform: scale(0.98);
  transition: transform 100ms ease, background 100ms ease;
}
```

---

## 4. Component Patterns for GyanGrit Mobile

### 4.1 Page Shell (Every Page)

```tsx
// Standard mobile page shell
function MobilePage({ title, showBack, rightAction, children }) {
  return (
    <div className="mobile-page">
      {/* Fixed Top Bar */}
      <header className="top-bar">
        {showBack && <BackButton />}
        <h1 className="page-title">{title}</h1>
        {rightAction}
      </header>

      {/* Scrollable Content */}
      <main className="page-content">
        {children}
      </main>

      {/* Fixed Bottom Nav (only on root tabs) */}
      <BottomNav />
    </div>
  );
}
```

```css
.top-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  height: calc(56px + var(--safe-top));
  padding: calc(var(--safe-top) + 8px) var(--page-px) 8px;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.page-title {
  flex: 1;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### 4.2 Bottom Tab Bar

```tsx
const STUDENT_TABS = [
  { path: "/dashboard",     icon: HomeIcon,    label: "Home" },
  { path: "/courses",       icon: BookIcon,    label: "Learn" },
  { path: "/leaderboard",   icon: TrophyIcon,  label: "Ranks" },
  { path: "/chat",          icon: ChatIcon,    label: "Chat" },
  { path: "/profile",       icon: UserIcon,    label: "Profile" },
];
```

```css
.bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 100;
  height: calc(64px + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  display: flex;
  background: rgba(10, 10, 15, 0.92);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255,255,255,0.06);
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  color: var(--text-tertiary);
  transition: color 150ms ease;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.nav-tab.active {
  color: var(--primary-light);
}

.nav-tab.active .tab-icon {
  /* Active indicator pill behind icon */
  background: rgba(108, 99, 255, 0.2);
  border-radius: 12px;
  padding: 4px 16px;
}

.tab-label {
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.01em;
}
```

### 4.3 Subject/Course Card (Student Dashboard)

```tsx
// Full-width card — NOT a grid on mobile
function SubjectCard({ subject, progress, onTap }) {
  return (
    <div className="subject-card" onClick={onTap} role="button">
      <div className="subject-icon-wrap">
        <SubjectEmoji subject={subject.name} />
      </div>
      <div className="subject-info">
        <p className="subject-name">{subject.name}</p>
        <p className="subject-meta">{progress.completed}/{progress.total} lessons</p>
        <div className="progress-bar-wrap">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
      <ChevronRightIcon size={16} color="var(--text-tertiary)" />
    </div>
  );
}
```

```css
.subject-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  width: 100%;
  min-height: 72px;  /* Generous touch target */
  -webkit-tap-highlight-color: transparent;
}

.subject-card:active {
  transform: scale(0.98);
  background: rgba(255,255,255,0.07);
}

.subject-icon-wrap {
  width: 48px; height: 48px;
  border-radius: 12px;
  background: rgba(108, 99, 255, 0.15);
  display: grid; place-items: center;
  font-size: 24px;
  flex-shrink: 0;
}

.subject-info {
  flex: 1;
  min-width: 0;  /* Allows text-overflow to work */
}

.subject-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subject-meta {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: 2px;
}

.progress-bar-wrap {
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  border-radius: 2px;
  transition: width 600ms ease;
}
```

### 4.4 Lesson List Item

```css
/* Use list rows, NOT cards, for lesson lists — more efficient on mobile */
.lesson-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--page-px);
  min-height: 64px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  -webkit-tap-highlight-color: transparent;
}

.lesson-row:active {
  background: rgba(255,255,255,0.04);
}

/* Completion indicator */
.lesson-status {
  width: 24px; height: 24px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.15);
  flex-shrink: 0;
  display: grid; place-items: center;
}

.lesson-status.completed {
  background: var(--success);
  border-color: var(--success);
}
```

### 4.5 Gamification Strip (Dashboard)

```css
/* Horizontal scroll strip — DO NOT stack vertically */
.gam-strip {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding: 0 var(--page-px) var(--space-2);
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* Snap scroll to cards */
  scroll-snap-type: x mandatory;
}

.gam-strip::-webkit-scrollbar { display: none; }

.gam-card {
  flex-shrink: 0;
  width: 120px;
  height: 100px;
  border-radius: 16px;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  scroll-snap-align: start;
}

/* Points card */
.gam-card.points {
  background: linear-gradient(135deg, rgba(108,99,255,0.3), rgba(108,99,255,0.1));
  border: 1px solid rgba(108,99,255,0.3);
}

/* Streak card */
.gam-card.streak {
  background: linear-gradient(135deg, rgba(255,101,132,0.3), rgba(255,101,132,0.1));
  border: 1px solid rgba(255,101,132,0.3);
}

.gam-number {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.gam-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### 4.6 Bottom Sheet (Replaces Desktop Modals)

```tsx
// Use for: filters, options menus, confirmations, quick actions
function BottomSheet({ isOpen, onClose, title, children }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`sheet-backdrop ${isOpen ? "visible" : ""}`}
        onClick={onClose}
      />
      {/* Sheet */}
      <div className={`bottom-sheet ${isOpen ? "open" : ""}`}>
        {/* Drag handle */}
        <div className="sheet-handle" />
        {title && <h2 className="sheet-title">{title}</h2>}
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
```

```css
.sheet-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 200;
  opacity: 0; pointer-events: none;
  transition: opacity 200ms ease;
}
.sheet-backdrop.visible { opacity: 1; pointer-events: all; }

.bottom-sheet {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 201;
  background: var(--bg-elevated);
  border-radius: 20px 20px 0 0;
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 12px var(--page-px) calc(var(--safe-bottom) + 24px);
  max-height: 80vh;
  overflow-y: auto;
  transform: translateY(100%);
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  backdrop-filter: blur(20px);
}
.bottom-sheet.open { transform: translateY(0); }

.sheet-handle {
  width: 36px; height: 4px;
  background: rgba(255,255,255,0.2);
  border-radius: 2px;
  margin: 0 auto 16px;
}

.sheet-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: var(--space-4);
}
```

### 4.7 Primary CTA Button (Anchored to Bottom)

```css
/* For single-action pages: "Start Assessment", "Mark Complete" */
.sticky-cta-wrap {
  position: fixed;
  bottom: calc(64px + var(--safe-bottom) + var(--space-4));
  left: var(--page-px);
  right: var(--page-px);
  z-index: 50;
}

.btn-primary {
  width: 100%;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: #fff;
  font-size: var(--text-base);
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  /* Subtle shadow to lift CTA above content */
  box-shadow: 0 8px 24px rgba(108, 99, 255, 0.35);
  transition: transform 120ms ease, box-shadow 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

.btn-primary:active {
  transform: scale(0.97);
  box-shadow: 0 4px 12px rgba(108, 99, 255, 0.25);
}
```

---

## 5. Page-by-Page Mobile Targets

### Student Dashboard (`/dashboard`)
```
Layout:
  ┌─ Top Bar: "GyanGrit" + 🔔 (notification badge) ─┐
  │                                                   │
  │  Greeting ("Good morning, Harpreet 👋")           │
  │                                                   │
  │  ← Gamification Strip (horizontal scroll) →       │
  │  [💎 185 pts] [🔥 4 days] [🏆 5 badges] [📊 #3]  │
  │                                                   │
  │  "Your Subjects" section header                   │
  │  [Math card — 8/12 lessons ████░░░ 67%]          │
  │  [Science card — 5/10 lessons ████░ 50%]          │
  │  [Punjabi card — 12/12 lessons ██████ 100% ✓]    │
  │  ...                                              │
  │                                                   │
  └─ Bottom Nav: Home | Learn | Ranks | Chat | Me ───┘
```

### Lesson Page (`/lessons/:id`)
```
Layout:
  ┌─ Top Bar: ← back | "Lesson Title" | ⋮ more ──────┐
  │                                                   │
  │  [Video Player — 16:9, full width]               │
  │  or [PDF Viewer — full width, scrollable]         │
  │                                                   │
  │  Lesson title (text-xl, bold)                    │
  │  Metadata: "Chapter 3 · 15 min"                  │
  │  ─────────────────────────                       │
  │  Content (markdown, text-base, line-height 1.6)  │
  │  ...                                              │
  │                                                   │
  │  ─ 80px bottom padding for CTA ──────────────── │
  └─ [★ Save Offline]  [✓ Mark Complete ──────────]  ┘
       (ghost btn)          (sticky primary CTA)
```

### Assessment Page (`/assessments/:id`)
```
Layout:
  ┌─ Top Bar: ← | "Chapter 1 Quiz" | Q 3/10 ─────────┐
  │  ████████░░ progress bar (full width, 3px)        │
  │                                                   │
  │  Question text (text-md, line-height 1.6)        │
  │  (generous padding — Punjabi text can be long)   │
  │                                                   │
  │  Option A  ○ ────────────────────────            │
  │  Option B  ○ ────────────────────────            │
  │  Option C  ○ ────────────────────────            │
  │  Option D  ○ ────────────────────────            │
  │  (Each option row: min-height 56px, full width)  │
  │                                                   │
  └─ [← Prev]              [Next Question →]          ┘
       (sticky bottom row, space-between)
```

### Teacher Dashboard (`/teacher/dashboard`)
```
Layout:
  ┌─ Top Bar: "Dashboard" + 📤 share ─────────────────┐
  │                                                   │
  │  Horizontal scroll: Course stat pills             │
  │  [Maths: 67%] [Science: 45%] [Punjabi: 89%] →   │
  │                                                   │
  │  "At-Risk Students" section (max 3, + "See all") │
  │  [Rahul K · High Risk ●] →                       │
  │  [Priya M · Medium Risk ●] →                     │
  │                                                   │
  │  "Recent Activity" section                        │
  │  [Activity feed rows]                             │
  │                                                   │
  └─ Bottom Nav: Home | Analytics | Content | … | Me ┘
```

---

## 6. Performance Rules (Rural India Context)

```
DO:
  - Use CSS transitions, not JS animation libraries (zero bundle cost)
  - backdrop-filter ONLY on: top bar, bottom nav, bottom sheets, modals
  - Skip backdrop-filter on list items and cards (too expensive on Snapdragon 4xx)
  - Use font-display: swap — never block render waiting for font
  - Use transform/opacity for animations only (GPU-composited, no layout)
  - Skeleton loaders instead of spinners (preserve layout during load)
  - Virtual scrolling for lists > 50 items
  - Lazy load images with loading="lazy"
  - Compress glassmorphism: use rgba() backgrounds, reduce blur radius on low-end

DON'T:
  - Animate width, height, padding, margin (causes layout thrash)
  - Load heavy animation libraries (Framer Motion, GSAP) for mobile
  - Use box-shadow with large spread on every card (expensive on Mali GPU)
  - Import entire icon libraries — use SVG sprites or individual imports
  - Load all lesson content at once — paginate or virtualize
```

---

## 7. Gestures & Interaction Patterns

```
Swipe right → back (iOS/Android back gesture — don't block it)
Swipe up on lesson list → scroll content
Pull to refresh → reload page data
Long press → context menu (bottom sheet with options)
Swipe left on notification → dismiss

NEVER:
  - Horizontal scroll on main content (only in designated carousels)
  - Pinch-to-zoom disabled (users with poor eyesight)
  - Double-tap to submit (accidental submissions)
  - Swipe navigation that conflicts with browser back gesture
```

```css
/* Respect overscroll on iOS */
.page-content {
  overscroll-behavior-y: contain;
}

/* Smooth momentum scrolling on iOS */
.scrollable {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}
```

---

## 8. Detecting Mobile vs Desktop in Code

```tsx
// Hook to detect PWA standalone mode
export function useIsPWA() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as any).standalone === true;
}

// Hook to detect mobile viewport
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// Render different nav structure based on viewport
function App() {
  const isMobile = useIsMobile();
  return (
    <div>
      {!isMobile && <Sidebar />}
      <main>{/* content */}</main>
      {isMobile && <BottomNav />}
    </div>
  );
}
```

---

## 9. CSS Media Query Strategy

```css
/* Mobile-first — write mobile CSS first, then override for desktop */

/* Mobile: 0–767px (default, no query) */
.nav-sidebar { display: none; }
.bottom-nav  { display: flex; }
.subject-grid { grid-template-columns: 1fr; gap: 12px; }

/* Tablet: 768px+ */
@media (min-width: 768px) {
  .nav-sidebar { display: flex; }
  .bottom-nav  { display: none; }
  .subject-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .subject-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; }
}

/* PWA standalone — extra polish */
@media (display-mode: standalone) {
  /* Hide browser chrome hints, adjust padding */
  .install-banner { display: none; }
}
```

---

## 10. When Asking Claude for Mobile UI Work

Always include this line in your prompt:

> "This is for GyanGrit's mobile PWA. The design system is Obsidian Glassmorphism (dark glass, `--bg-base: #0a0a0f`, `--primary: #6c63ff`). Use mobile-first CSS, bottom tab navigation, bottom sheets instead of modals, 48px minimum touch targets, and write CSS variables only (no Tailwind). The audience is rural students on budget Android phones."

Then specify:
1. Which page/component you're working on (e.g. "Student Dashboard", "Lesson Page", "Assessment Question")
2. What data is available (paste the API response shape or endpoint from `API_AND_FRONTEND_END_POINTS.md`)
3. What the current broken version looks like (describe or paste the existing CSS/TSX)
4. What the goal is ("make it feel like a native app, not a scaled desktop")

---

## 11. Files to Share with Claude Per Task

| Task | Files to Share |
|---|---|
| Any mobile UI work | This file (GYANGRIT_MOBILE_PWA_SKILL.md) |
| Navigation / routing | `API_AND_FRONTEND_END_POINTS.md` → Frontend Route Map section |
| Dashboard work | `GAMIFICATION.md` + `LEARNING_LOOP.md` |
| Teacher pages | `API_AND_FRONTEND_END_POINTS.md` → Teacher Analytics section |
| Assessment pages | `API_AND_FRONTEND_END_POINTS.md` → Assessments section + `LEARNING_LOOP.md` Part 2 |
| Any backend connection | `SYSTEM_ARCHITECTURE_AND_DESIGN_DOCUMENTATION.md` section 6.3 |

---

## 12. Quick Checklist Before Asking Claude

Before you paste your prompt, check:
- [ ] Am I describing what the page does and who uses it?
- [ ] Have I shared the API endpoint shape so Claude knows what data is available?
- [ ] Have I said "mobile-first, bottom nav, bottom sheets" explicitly?
- [ ] Have I mentioned the Obsidian Glassmorphism design system?
- [ ] Am I asking for one page/component at a time (not "redesign the whole app")?
- [ ] Have I shared the existing broken TSX/CSS so Claude can do targeted fixes?

---

*Generated for GyanGrit — April 2026*
*Share this entire file with Claude at the start of any mobile UI conversation.*
