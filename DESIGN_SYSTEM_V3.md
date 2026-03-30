# GyanGrit Design System V3 — "Chalk & Sunlight"
> Written: 2026-03-30 | Author: Design Lead (AI)
> Status: APPROVED — implementation begins immediately

---

## The Problem With V2 (Infinite Obsidian)

V2 was technically correct but wrong for the audience. Deep obsidian glassmorphism is:
- **Hostile to rural users** on cheap screens with low brightness/contrast (AMOLED handles it; cheap LCD TN panels make glass text invisible)
- **Cold and uninviting** — education should feel warm, encouraging, safe
- **Generic "AI dark theme"** — every AI-generated app looks like this now
- **Illegible on bad screens** — rgba(255,255,255,0.03) is invisible on cheap phones

The NavMenu (temporary demo nav) is also removed and replaced with a proper **role-aware sidebar drawer**.

---

## The New Direction: "Chalk & Sunlight"

### Concept
A **warm, light-first** design inspired by:
- Indian classroom chalk on blackboard
- Afternoon sunlight through window glass
- Handwritten textbook marginalia
- The warmth of turmeric, terracotta, and marigold

**NOT**: Material Design. NOT: Bootstrap. NOT: another dark theme. NOT: purple gradients.

### What Makes It Unforgettable
Every card has a subtle **paper texture** (CSS noise). The brand accent is **saffron amber** — warm, Indian, energetic. Headings use **Plus Jakarta Sans** (distinctive, modern, South Asian tech companies use it). Body uses **Nunito** (rounded, approachable, readable on cheap screens). The bottom nav has **pill indicator** that slides smoothly. Cards have **warm cream backgrounds** with terracotta left-border accents. Dark mode is **ink on parchment** not void black.

---

## Color Palette

### Light Theme (Default — optimized for cheap phone screens)
```
--bg-canvas:      #FDF8F0   /* warm parchment — NEVER pure white */
--bg-surface:     #FFFFFF   /* card faces */
--bg-elevated:    #F5EFE6   /* slightly deeper surface */
--bg-sunken:      #EDE8DE   /* input backgrounds */

--ink-primary:    #1A1208   /* near-black with warm undertone */
--ink-secondary:  #5C4E3A   /* warm brown-grey */
--ink-muted:      #9B8E7E   /* disabled, placeholder */
--ink-inverse:    #FDF8F0   /* text on dark bg */

--saffron:        #F59E0B   /* PRIMARY BRAND — warm amber/saffron */
--saffron-dark:   #D97706   /* hover state */
--saffron-glow:   rgba(245,158,11,0.15)
--saffron-light:  #FEF3C7   /* tints */

--terracotta:     #DC6B42   /* secondary accent — warm orange-red */
--terracotta-light: #FEE2D5

--sage:           #10b981   /* success / teacher role */
--sky:            #0EA5E9   /* info / student role */
--rose:           #F43F5E   /* error / admin role */
--violet:         #8B5CF6   /* official role */
--amber:          #F59E0B   /* principal role = saffron */

--border-light:   rgba(26,18,8,0.08)   /* subtle border */
--border-medium:  rgba(26,18,8,0.14)   /* default border */
--border-strong:  rgba(26,18,8,0.24)   /* focused border */
--border-accent:  #F59E0B              /* brand border */
```

### Dark Theme (Ink on Parchment — toggled by system preference)
```
--bg-canvas:      #1C1510   /* warm dark — NOT cold void black */
--bg-surface:     #26201A   /* warm card bg */
--bg-elevated:    #322A22   /* elevated surface */
--bg-sunken:      #1A1510   /* inputs */

--ink-primary:    #F5EAD8   /* warm cream white */
--ink-secondary:  #C4A882   /* warm tan */
--ink-muted:      #7A6855   /* warm grey */
```

### Role Colors (unchanged, just token-mapped)
```
--role-student:   var(--sky)         #0EA5E9
--role-teacher:   var(--sage)        #10B981
--role-principal: var(--saffron)     #F59E0B
--role-official:  var(--violet)      #8B5CF6
--role-admin:     var(--rose)        #F43F5E
```

---

## Typography

### Font Stack
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Nunito:wght@400;500;600;700;800&display=swap');

--font-display: 'Plus Jakarta Sans', sans-serif;   /* headings, labels, UI */
--font-body:    'Nunito', sans-serif;               /* body text, descriptions */
```

**Why these fonts:**
- Plus Jakarta Sans: designed for modern South/SE Asian tech, has a sharp modern edge with personality
- Nunito: rounded terminals, extremely readable at small sizes on low-res screens, warm and friendly

### Scale
```
--text-xs:    0.75rem   / 12px
--text-sm:    0.8125rem / 13px
--text-base:  0.9375rem / 15px  ← slightly larger than typical for readability
--text-lg:    1.0625rem / 17px
--text-xl:    1.25rem   / 20px
--text-2xl:   1.5rem    / 24px
--text-3xl:   1.875rem  / 30px
--text-4xl:   2.25rem   / 36px
```

---

## Spacing & Radius

```
--space-1:  4px   --space-2:  8px   --space-3:  12px
--space-4:  16px  --space-5:  20px  --space-6:  24px
--space-8:  32px  --space-10: 40px  --space-12: 48px
--space-16: 64px  --space-20: 80px

--radius-sm:   6px    /* tags, small chips */
--radius-md:   10px   /* inputs, small cards */
--radius-lg:   16px   /* cards, panels */
--radius-xl:   24px   /* large cards, modals */
--radius-2xl:  32px   /* hero cards */
--radius-full: 9999px /* pills, avatars */
```

---

## Shadows

```css
/* Light theme — warm shadows (brown-tinted, not grey) */
--shadow-xs:  0 1px 2px rgba(26,18,8,0.06);
--shadow-sm:  0 1px 4px rgba(26,18,8,0.08), 0 2px 8px rgba(26,18,8,0.04);
--shadow-md:  0 4px 12px rgba(26,18,8,0.10), 0 2px 4px rgba(26,18,8,0.06);
--shadow-lg:  0 8px 24px rgba(26,18,8,0.12), 0 4px 8px rgba(26,18,8,0.06);
--shadow-xl:  0 16px 48px rgba(26,18,8,0.16);
--shadow-card: 0 2px 8px rgba(26,18,8,0.08), 0 0 0 1px rgba(26,18,8,0.04);
--shadow-card-hover: 0 8px 24px rgba(26,18,8,0.14), 0 0 0 1px rgba(245,158,11,0.3);
```

---

## Elevation System

Cards have **three visual layers** in light mode:
1. **Sunken** (inputs, code blocks): `--bg-sunken` + inset shadow
2. **Flat** (page background): `--bg-canvas` + no shadow
3. **Raised** (cards): `--bg-surface` + `--shadow-card` + 1px border
4. **Floating** (modals, dropdowns): `--bg-surface` + `--shadow-xl` + stronger border

---

## Navigation — Sidebar Drawer (REPLACES NavMenu)

### Desktop (≥768px): Persistent left sidebar
- Width: 260px
- Background: `--bg-surface` with right border `--border-light`
- Logo at top
- Role-colored active indicator (left pill)
- Grouped sections with category labels
- User info + logout at bottom

### Mobile (<768px): Slide-over drawer
- Triggered by hamburger in TopBar
- Slides in from left, 85vw wide
- Backdrop overlay closes it
- Same content as desktop sidebar

### BottomNav: Stays for student mobile (5 tabs)
- Background: `--bg-surface` with top border + warm shadow
- Active tab: saffron pill indicator + icon fills
- Smooth pill slide animation via CSS transform

---

## Component Design Language

### Cards
- `background: var(--bg-surface)`
- `border: 1px solid var(--border-light)`
- `border-radius: var(--radius-lg)`
- `box-shadow: var(--shadow-card)`
- Hover: `box-shadow: var(--shadow-card-hover)` + subtle `translateY(-2px)`
- Accent variant: `border-left: 3px solid var(--saffron)` 

### Buttons
- Primary: `background: var(--saffron)` + `color: white` + rounded-full
- Secondary: `background: transparent` + `border: 1.5px solid var(--border-medium)` + `color: var(--ink-primary)`
- Ghost: no border, just text + hover bg
- Danger: terracotta/rose background
- Size variants: sm/md/lg with padding and font-size differences

### Inputs
- Background: `var(--bg-sunken)`
- Border: `1.5px solid var(--border-medium)`
- Focus: `border-color: var(--saffron)` + subtle glow `box-shadow: 0 0 0 3px var(--saffron-glow)`
- Border-radius: `var(--radius-md)`
- Font: `var(--font-body)` 15px

### Progress Bars
- Track: `var(--bg-sunken)` 
- Fill: gradient from `var(--saffron)` to `var(--terracotta)` (warm, energetic)
- Height: 6px, fully rounded

### Badges / Pills
- Rounded-full
- Filled with role/semantic colors at 15% opacity
- Text at 80% opacity of the base color

### Skeleton Loaders
- Background: `var(--bg-elevated)` 
- Shimmer: warm cream sweep animation

---

## Page Layout

### Shell
```
┌─────────────────────────────────┐
│  TopBar (56px sticky)           │
├──────────┬──────────────────────┤
│ Sidebar  │  Main content        │
│ (260px   │  (scrollable)        │
│ desktop) │                      │
│          │                      │
│          │                      │
└──────────┴──────────────────────┘
           │  BottomNav (mobile)  │
           └─────────────────────┘
```

### Content width
- Narrow (auth, article): max-width 480px, centered
- Normal (most pages): max-width 860px
- Wide (admin grids): max-width 1200px
- Padding: `var(--space-6)` horizontal, `var(--space-8)` top

---

## Animations

```css
/* Page entrance — fast, subtle */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Card stagger: animation-delay: calc(var(--i) * 40ms) */

/* Skeleton shimmer */
@keyframes shimmer {
  from { background-position: -400px 0; }
  to   { background-position: 400px 0; }
}

/* Bottom nav pill slide */
/* CSS transform on the .bottom-nav__pill element */

/* Button press: scale(0.97) on :active */
/* Card hover: translateY(-2px) 200ms ease */
```

**Philosophy**: Animations are functional, not decorative. They guide attention, confirm interactions. Max duration 300ms. NO bounce/spring on data elements — only on UI chrome.

---

## Paper Texture

A subtle CSS noise texture on `--bg-canvas` gives depth without images:
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,..."); /* SVG noise */
}
```

---

## Accessibility

- All text contrast ≥ 4.5:1 (WCAG AA)
- Focus rings: `outline: 2px solid var(--saffron); outline-offset: 2px`
- Tap targets: min 44×44px on mobile
- Font size: minimum 13px displayed text
- No color-only information conveyance
- `font-size: 16px` on all inputs (prevents iOS zoom)

---

## Sidebar Drawer — Role-Based Navigation

Replaces `NavMenu.tsx`. New file: `Sidebar.tsx`.

Structure per role:

**STUDENT**: Home, Courses, Learning Paths, Assessments, Flashcards, Live Classes, AI Tutor, Competitions, Chat, Leaderboard, Profile

**TEACHER**: Dashboard, My Classes, Gradebook, Lesson Editor, Assessment Builder, Live Classes, Flashcards, Chat, Join Codes

**PRINCIPAL**: Dashboard, All Classes, Staff, Live Classes, Chat, Join Codes, Reports

**OFFICIAL**: Dashboard, Districts, Principals, Reports

**ADMIN**: Dashboard, Content, Users, Join Codes, Chat, Analytics, Live, Flashcards

---

## Key Differences From V2

| V2 Obsidian | V3 Chalk & Sunlight |
|---|---|
| `#070a0f` void black bg | `#FDF8F0` warm parchment bg |
| Glass/blur everywhere | Clean card elevation |
| Sora + DM Sans | Plus Jakarta Sans + Nunito |
| Electric blue accent | Saffron amber accent |
| NavMenu (temp hack) | Sidebar drawer (proper) |
| Cold/tech vibe | Warm/educational vibe |
| Heavy backdrop-filter | Performance-safe CSS |
| Invisible on cheap screens | ≥4.5:1 on all surfaces |
| Generic dark AI app | Distinctly Indian EdTech |

---

## Implementation Order

1. `index.css` — complete rewrite (all tokens + all component styles)
2. `Sidebar.tsx` — new component (replaces NavMenu)
3. `TopBar.tsx` — sidebar toggle, remove NavMenu import
4. `BottomNav.tsx` — warm pill indicator
5. `LoginPage.tsx` — new auth layout
6. `DashboardPage.tsx` — warm subject cards
7. All remaining 57 pages — token-consistent updates
8. `NavMenu.tsx` — DELETE or stub (replaced by Sidebar)
