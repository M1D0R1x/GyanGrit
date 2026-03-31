# GyanGrit UI Redesign V4 — Master Plan
> Philosophy: Emil's invisible polish + Nefee's component anatomy + warm parchment palette
> Status: IN PROGRESS

---

## Design Philosophy

### From Emil (EMILUI_SKILL.md)
- Every animation answers "why does this animate?" — no decorative motion for repeated actions
- `ease-out` on enter, `ease-in-out` on screen movement, never `ease-in`
- Scale from `0.95 + opacity:0`, never from `scale(0)`
- Popovers/drawers scale from trigger origin
- Buttons: `scale(0.97)` on `:active`, 100-160ms
- Sonner for toasts, Vaul for bottom drawers
- CSS transitions over keyframes for interruptible UI
- < 300ms for all UI animations
- Stagger: 30-80ms between items
- Springs for gestures (drag, swipe)

### From Nefee (NEEFE_SKILL.md)
- Proper component anatomy — pill buttons, glass cards, density modes
- Motion tokens: fast=150ms, normal=250ms, slow=350ms
- Elevation z-index scale: base→sticky→dropdown→modal→toast
- Input anatomy: label + field + helper + counter
- Card types: clickable with left-border accent
- Tag/badge system with semantic colors

### GyanGrit Constraints
- NO Tailwind — custom CSS only in `index.css`
- Warm parchment palette (NOT Nefee's dark) — saffron accent
- Role colors: student=blue, teacher=emerald, principal=amber, official=violet, admin=rose
- Mobile-first, low-end devices, rural Punjab
- No breaking backend

---

## Packages to Install

```bash
cd /Users/veera/PycharmProjects/GyanGrit/frontend
npm install sonner vaul
```

### Sonner
- Toast notifications with physics-based animations
- Drop-in: `<Toaster />` once in App, `toast()` anywhere
- Replaces all manual alert/toast patterns

### Vaul
- Drawer component built on Radix UI primitives
- Used for: mobile sidebar, bottom sheets, mobile menus
- `Drawer.Root`, `Drawer.Portal`, `Drawer.Content`, `Drawer.Overlay`

---

## Architecture Changes

### 1. App Layout (router.tsx → AppLayout.tsx)
Create `AppLayout.tsx` wrapping ALL authenticated routes:
```
AppLayout
├── TopBar (sticky, always)
├── .app-layout (flex row)
│   ├── Sidebar (desktop: persistent 260px, mobile: hidden)
│   └── .app-layout__main (scrollable)
│       └── {page content}
└── BottomNav (mobile ONLY — @media max-width: 767px)
```

### 2. Sidebar
- Desktop: sticky 260px panel, no overlay
- Mobile: Vaul drawer from left, with overlay
- Remove sidebar from inside TopBar
- Remove BottomNav from inside each page

### 3. BottomNav
- CSS: `display: none` on `@media (min-width: 768px)`
- Only students see it on mobile

### 4. Toasts
- Install Sonner
- Add `<Toaster position="bottom-center" />` to App.tsx
- Export `toast` for use in pages

---

## CSS Animation Tokens (Emil-compliant)

```css
/* Custom easing curves — Emil standard */
--ease-out-strong:  cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

/* Duration */
--duration-press:   120ms;   /* button active */
--duration-tooltip: 150ms;   /* tooltips, small popovers */
--duration-dropdown: 200ms;  /* dropdowns */
--duration-modal:   300ms;   /* modals, drawers */
--duration-page:    220ms;   /* page enter */
```

---

## Page Redesign Priority

### Tier 1 — Core student flow (do first)
1. `LoginPage` — warm auth card, saffron brand, Emil button press
2. `DashboardPage` — subject cards with left-border, streak pills, assessment rows
3. `CoursesPage` — course cards with hover state
4. `LessonsPage` — lesson list with completion state
5. `LessonPage` — video/PDF/markdown viewer

### Tier 2 — Assessment flow
6. `AssessmentsPage` — assessment list
7. `AssessmentPage` — single assessment detail
8. `AssessmentTakePage` — take quiz UI
9. `AssessmentsResultPage` — result display

### Tier 3 — Profile & social
10. `ProfilePage` — user profile with grades
11. `LeaderboardPage` — rank list
12. `ChatRoomPage` — warm chat UI

### Tier 4 — Teacher/Staff
13. `TeacherDashboardPage` — analytics hub
14. `GradebookPage` — grades editor
15. `TeacherClassDetailPage` — class analytics

### Tier 5 — Feature pages
16. `AIChatPage` — AI tutor
17. `FlashcardsStudyPage` — flashcard UI
18. `LiveSessionPage` — live class
19. `NotificationsPage`

### Tier 6 — Admin
20-25. Admin pages

---

## Component Redesign Checklist

### Layout Shell
- [ ] `AppLayout.tsx` — NEW: wraps all auth routes
- [ ] `router.tsx` — use AppLayout for all protected routes
- [ ] `TopBar.tsx` — remove sidebar toggle (sidebar lives in AppLayout)
- [ ] `Sidebar.tsx` — desktop: sticky | mobile: Vaul drawer
- [ ] `BottomNav.tsx` — add `display: none` on desktop via CSS

### New Components
- [ ] `Toast.tsx` — Sonner setup, replace manual alerts
- [ ] `Modal.tsx` — Radix Dialog for confirmations

### All Pages
- [ ] Remove `<TopBar />` and `<BottomNav />` from every page (AppLayout handles it)
- [ ] Remove `has-bottom-nav` class (AppLayout handles padding)
- [ ] Replace `backdropFilter` with warm surface
- [ ] Fix all inline dark rgba() colors

---

## Component Anatomy Standards (from Nefee + Emil)

### Buttons
```css
/* Press feedback — Emil */
.btn:active { transform: scale(0.97); transition: transform 120ms var(--ease-out-strong); }

/* Entry animation — Emil */
/* scale(0.95) + opacity:0 → scale(1) + opacity:1 */
```

### Cards
- Border-left accent (4px, role/progress color)
- `scale(1) → scale(1.01)` on hover (Emil: subtle, not `translateY(-6px)`)
- Shadow transition on hover
- `scale(0.98)` on click

### Sidebar (Vaul on mobile)
- Scales from left edge (transform-origin: left center)
- `ease-drawer` curve
- Velocity-based dismiss

### Modals / Bottom Sheets (Vaul)
- `scale(0.96) + opacity:0` enter
- `ease-out-strong` curve, 300ms
- Origin-aware: scales from trigger

### Toasts (Sonner)
- Bottom-center on mobile, bottom-right on desktop
- Warm theme matching design system
- Auto-dismiss 4s, swipe to dismiss

---

## File Change Map

### New files
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/Toast.tsx` (Sonner setup)

### Modified files
- `frontend/src/app/router.tsx` — wrap auth routes in AppLayout
- `frontend/src/main.tsx` or `App.tsx` — add Sonner Toaster
- `frontend/src/index.css` — Emil animation tokens, BottomNav desktop hide, fixes
- `frontend/src/components/TopBar.tsx` — simplified (no sidebar state)
- `frontend/src/components/Sidebar.tsx` — Vaul on mobile, pure CSS on desktop
- `frontend/src/components/BottomNav.tsx` — desktop display:none
- ALL 40+ page files — remove TopBar/BottomNav/has-bottom-nav

---

## CSS Changes Required in index.css

1. Add Emil easing curves as CSS custom properties
2. Add `@media (min-width: 768px) { .bottom-nav { display: none; } }`
3. Fix `.app-layout` to be proper flex row with sidebar
4. Add proper button `:active` transform
5. Fix `.card--clickable` hover to Emil spec (subtle scale, not big translateY)
6. Add `@starting-style` for page entry animations
7. Add stagger utilities
8. Add drawer-specific animations for Vaul

---

## What Was Wrong (Honest Assessment)

1. **Sidebar**: Was rendering inside TopBar JSX. Not a real layout. On desktop it was just color-changed old nav. **Fix**: AppLayout.tsx with proper flex row.

2. **BottomNav on desktop**: Missing `@media (min-width:768px) { display: none }`. **Fix**: One CSS rule.

3. **Animations**: `cubic-bezier(0.34, 1.4, 0.64, 1)` spring was wrong — too bouncy, Emil says 0.1-0.3 bounce for UI. `transition: all` was everywhere. **Fix**: Emil easing tokens, specific properties only.

4. **Button feedback**: No `:active` scale transform. Buttons felt dead. **Fix**: `scale(0.97)` on active.

5. **Cards**: `translateY(-6px)` hover was too dramatic. Emil says subtle. **Fix**: `translateY(-2px) scale(1.01)`.

6. **Toast**: Manual alert divs. Should be Sonner. **Fix**: Install + integrate.

7. **Page structure**: Each page imported TopBar + BottomNav. Should be in layout wrapper. **Fix**: AppLayout.tsx.
