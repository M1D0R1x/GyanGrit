---
name: nefee-design-system
description: >
  WHEN building any Nefee UI, styling components, choosing colors/typography/spacing,
  applying glassmorphism, or generating Flutter/Dart or React/Tailwind code for Nefee.
  WHEN NOT doing backend logic, API design, database work, or non-Nefee projects.
argument-hint: "[colors|typography|icons|glass|spacing|components|molecules|composition|patterns|tokens|flutter|tailwind|anti-patterns]"
---

# Nefee Design System

Portable design tokens and component patterns extracted from the Nefee Atomic Design System (Figma).

**Figma source:** `figma.com/design/WcJMylDpGQGNHZMst6C2Ik/Nefee-Atomic-design-system`
**Icon library:** `figma.com/design/Btbz3rVBMjyHdA0lGT1Bnw/Claude-Icon-Library`

## Argument Routing

When invoked with an argument, focus your response on only the matching section:

| Argument | Section |
|----------|---------|
| `colors` | 1. Color Tokens |
| `typography` | 2. Typography Scale |
| `icons` | 3. Iconography |
| `glass` | 4. Glassmorphism Pattern |
| `spacing` | 5. Spacing, Radius & Layout |
| `components` | 6. Atom-Level Component Patterns |
| `molecules` | 7. Molecules & Organisms |
| `composition` | 8. Composition Rules (Atomic Design Hierarchy) |
| `patterns` | 9. Cross-Cutting Patterns |
| `tokens` | 10. Platform-Specific Token Output (all platforms) |
| `flutter` | 10. Platform-Specific Token Output — Flutter/Dart only |
| `tailwind` | 10. Platform-Specific Token Output — CSS/Tailwind only |
| `anti-patterns` | 11. Anti-Patterns / Do-Nots |

If no argument is given, use the full design system as context for the current task.

---

## 1. Color Tokens

### Primary Colors

| Name                  | Hex       | Semantic Use                  |
|-----------------------|-----------|-------------------------------|
| Suggestion Red        | `#FF3F6D` | Alerts, negative actions, suggestions |
| Decision Orange       | `#FFA200` | Warnings, important actions   |
| Praise Blue           | `#2B8CDC` | Positive info, links          |
| Experience Turquoise  | `#00D5B0` | Confirmed, success, active states |

### Neff Type → Color Mapping

Used consistently in card borders, Prac backgrounds, completion items, and badges:

| Neff Type    | Color              | Hex       |
|--------------|--------------------|-----------|
| Experience   | Turquoise          | `#00D5B0` |
| Decision     | Orange             | `#FFA200` |
| Praise       | Blue               | `#2B8CDC` |
| Suggestion   | Red                | `#FF3F6D` |

### Secondary Colors

| Name       | Hex       | Semantic Use                        |
|------------|-----------|-------------------------------------|
| Ink Black  | `#0D1421` | Primary background, deep surfaces   |
| White      | `#F2F4F7` | Primary text, light foreground      |

### Semantic Colors

| Name             | Hex       | Use                                  |
|------------------|-----------|--------------------------------------|
| Error Red        | `#C3284D` | Destructive/danger actions           |
| Atomic Tangerine | —         | Neff affect tag intensity ONLY       |
| Pacific Blue     | —         | Neff affect tag intensity ONLY       |

### Transparent Overlays

| Name      | Value                        | Use                       |
|-----------|------------------------------|---------------------------|
| White 8%  | `rgba(255, 255, 255, 0.08)`  | Subtle surface tint       |
| White 35% | `rgba(255, 255, 255, 0.35)`  | Disabled text opacity     |

### Gradients

| Name               | Value                                      | Use                        |
|--------------------|--------------------------------------------|----------------------------|
| Negative           | `#FF3F6D` → `#FFA200` (116.99deg, 10.73%→89.2%) | Negative CTA buttons  |
| Positive           | `#2B8CDC` → `#00D5B0` (96.54deg, 5.62%→91.41%) | Primary CTA buttons   |
| Dark Background    | `#0D1421` → `#152036` (180deg)             | Page/card backgrounds      |
| Glass Fill         | `rgba(255,255,255,0.06)` → `rgba(255,255,255,0.1)` (-20.95deg, 40.13%→97.02%) | Glass-effect surfaces |
| Glass Stroke       | `1px solid rgba(255,255,255,0.06)`         | Glass-effect borders       |

### Shadows

| Name      | Value                                     |
|-----------|-------------------------------------------|
| Shadow/xs | `0px 1px 2px rgba(16, 24, 40, 0.05)`     |
| Text glow | `0px 2px 8px rgba(27, 40, 64, 0.25)`     |

---

## 2. Typography Scale

**Primary font:** Inter
**Monospace font:** Roboto Mono — **Medium 500** weight, used for 14px code/data display only

| Size | Weight        | Line Height | Letter Spacing | CSS |
|------|---------------|-------------|----------------|-----|
| 24   | Regular 400   | 36px (1.5×) | —              | `font-size: 24px; font-weight: 400; line-height: 36px` |
| 24   | Bold 700      | 36px (1.5×) | —              | `font-size: 24px; font-weight: 700; line-height: 36px` |
| 18   | Regular 400   | 28px (1.56×)| —              | `font-size: 18px; font-weight: 400; line-height: 28px` |
| 18   | Medium 500    | 28px        | —              | `font-size: 18px; font-weight: 500; line-height: 28px` |
| 18   | Semi Bold 600 | 28px        | —              | `font-size: 18px; font-weight: 600; line-height: 28px` |
| 18   | Bold 700      | 28px        | —              | `font-size: 18px; font-weight: 700; line-height: 28px` |
| 16   | Regular 400   | 24px (1.5×) | 0.16px (1%)    | `font-size: 16px; font-weight: 400; line-height: 24px; letter-spacing: 0.16px` |
| 16   | Medium 500    | 24px        | 0.16px         | `font-size: 16px; font-weight: 500; line-height: 24px` |
| 16   | Semi Bold 600 | 24px        | 0.16px         | `font-size: 16px; font-weight: 600; line-height: 24px` |
| 14   | Regular 400   | 24px (1.71×)| —              | `font-size: 14px; font-weight: 400; line-height: 24px` |
| 14   | Medium 500    | 24px        | —              | `font-size: 14px; font-weight: 500; line-height: 24px` |
| 14   | Semi Bold 600 | 22px (1.57×)| —              | `font-size: 14px; font-weight: 600; line-height: 22px` |
| 14   | Medium 500 (Mono) | 22px    | —              | `font-family: 'Roboto Mono'; font-size: 14px; font-weight: 500; line-height: 22px` |
| 12   | Regular 400   | 20px (1.67×)| —              | `font-size: 12px; font-weight: 400; line-height: 20px` |
| 12   | Medium 500    | 20px        | —              | `font-size: 12px; font-weight: 500; line-height: 20px` |
| 10   | Regular 400   | 12px (1.2×) | —              | `font-size: 10px; font-weight: 400; line-height: 12px` |

**Note:** 14px has two line heights — Regular uses 24px (body text), Semi Bold uses 22px (compact labels). Button text uses `letter-spacing: 0.36px` (lg), `0.32px` (md).

---

## 3. Iconography

**Source:** `figma.com/design/Btbz3rVBMjyHdA0lGT1Bnw/Claude-Icon-Library`

**1,238 icons** across 21 categories, stroke-style (outline), with some custom Nefee-specific icons.

### Categories

General, Arrows, Users, Charts, Communication, Layout, Alerts & feedback, Shapes, Media & devices, Development, Files, Security, Finance & eCommerce, Images, Editor, Time, Maps & travel, Weather, Education, App usage, Avatars

### Naming Convention

Icons use **kebab-case** with optional numeric suffixes: `alert-circle`, `arrow-up-right`, `user-01`, `columns-03`

### Nefee Custom Icons

`Nefee`, `Nefs`, `Nefflers`, `Nefting`, `Nefting-2`, `Nefting-framed`, `Nefting-framed-2`, `Snips`, `Pracs`, `Daily picks`, `Counter`, `Feelings`, `Pause HaRR`

### Icon Sizes

| Context        | Size   |
|----------------|--------|
| Button lg/md   | 24×24  |
| Button sm      | 20×20  |
| Navigation bar | 24×24  |
| Toast leading  | 24×24  |
| Tag badge      | 16×16  |
| Inline text    | 16×16  |
| Hit target     | 48×48 container, 24×24 visible icon |
| Active feed    | 26×26 (enlarged when selected) |

### Usage Rules

- Always use icons from this library. Do not introduce icons from other sets.
- Icons are **stroke-style** (outline) — they inherit `currentColor`. Set color via the parent's text color.
- For React: export as inline SVGs or use an icon component that loads from this library.
- For Flutter: export as SVG assets and use `SvgPicture.asset()` with `colorFilter` to tint.

---

## 4. Glassmorphism Pattern

Nefee's UI is built on a **glassmorphism** aesthetic — translucent, frosted-glass surfaces over the dark background.

### The Recipe

Every glass surface combines these 3 properties:

| Property | Value | CSS |
|----------|-------|-----|
| **Glass fill** | Subtle white gradient | `background: linear-gradient(-20.95deg, rgba(255,255,255,0.06) 40.13%, rgba(255,255,255,0.1) 97.02%)` |
| **Glass stroke** | Ultra-thin white border | `border: 1px solid rgba(255,255,255,0.06)` |
| **Backdrop blur** | Frosted glass blur | `backdrop-filter: blur(12px)` |

### Where It Applies

| Component | Glass Fill | Glass Stroke | Backdrop Blur |
|-----------|-----------|-------------|---------------|
| Tertiary/Alert/Confirmed/Important buttons | Yes | Yes | No |
| Disabled buttons | Yes | No | No |
| Toast messages | Yes | Yes | **Yes (12px)** |
| Dropdown menus | Yes | Yes | Yes |
| Card surfaces | Yes | Yes | Optional |
| Slideup modals | Yes | Yes | **Yes (12px)** |
| Popup modals | Yes | Yes | Yes |
| Input containers | — | — | No (use `white-8` solid fill) |

### Platform Implementation

**CSS / Tailwind:**
```css
.nefee-glass {
  background: linear-gradient(-20.95deg, rgba(255,255,255,0.06) 40.13%, rgba(255,255,255,0.1) 97.02%);
  border: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

**Flutter / Dart:**
```dart
ClipRRect(
  borderRadius: BorderRadius.circular(12),
  child: BackdropFilter(
    filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
    child: Container(
      decoration: BoxDecoration(
        gradient: NefeeGradients.glassFill,
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: /* content */,
    ),
  ),
)
```

### Important Notes

- Buttons do NOT use `backdrop-filter` (performance on mobile). They rely on the gradient + border alone.
- Toasts, dropdowns, and popup modals DO use `backdrop-filter: blur(12px)`.
- Slideup modals use glassmorphism (glass fill + stroke + backdrop blur) like other elevated surfaces.
- The glass effect only works on dark backgrounds. Never place glass surfaces on light backgrounds.
- Toast messages use `rounded-[12px]`, not the button pill radius.

---

## 5. Spacing, Radius & Layout

### Border Radius

| Element            | Radius      |
|--------------------|-------------|
| Buttons lg (pill)  | `28px`      |
| Buttons md/sm (pill) | `34px`   |
| Cards / surfaces   | `16px`      |
| Modals (top corners only for slideup) | `16px` |
| Inputs             | `12px`      |
| Tags               | `8px`       |
| Checkboxes         | `4px`       |
| Avatars            | `50%` (circle) |

### Spacing (observed)

| Token | Value  | Use                              |
|-------|--------|----------------------------------|
| xs    | `4px`  | Inline icon gaps                 |
| sm    | `8px`  | Icon-to-text gap in buttons, card list gaps |
| md    | `12px` | Input padding, board item gaps   |
| lg    | `16px` | Card padding, section gaps, horizontal page padding |
| xl    | `24px` | Major sections, section gaps between Hub sections |
| 2xl   | `28px` | Button horizontal padding (lg)   |

### Mobile Layout Shell

| Token | Value | Note |
|-------|-------|------|
| Mobile canvas width | `390px` | All organisms use this |
| Horizontal padding | `16px` each side | Consistent across all pages |
| Content area width | `358px` | 390 − 16 − 16 |
| Header height | `48px` (feed) / `96px` (listing) | Fixed at top |
| Bottom bar height | `48px` (listing) / `96px` (summary) | Fixed at bottom |
| Icon hit target | `48×48` | 24×24 visible icon centered inside |

---

## 6. Atom-Level Component Patterns

### Buttons

All buttons are **pill-shaped**, use **Inter Semi Bold**, and support three sizes:

| Size | Height | Padding (h/v) | Radius | Font Size | Line Height | Letter Spacing | Icon Size |
|------|--------|---------------|--------|-----------|-------------|----------------|-----------|
| lg   | 56px   | 28px / 10px   | 28px   | 18px      | 28px        | 0.36px         | 24px      |
| md   | 48px   | 24px / 10px   | 34px   | 16px      | 24px        | 0.32px         | 24px      |
| sm   | 40px   | 18px / 10px   | 34px   | 14px      | 22px        | 0              | 20px      |

**Variants:**

| Variant    | Background                     | Text Color  | Border         | Sizes Available |
|------------|--------------------------------|-------------|----------------|-----------------|
| Primary    | Positive gradient              | `#F2F4F7`   | none           | lg, md, sm      |
| Negative   | Negative gradient              | `#F2F4F7`   | none           | **lg only**     |
| Danger     | Solid `#C3284D`                | `#F2F4F7`   | Glass stroke   | lg, md, sm      |
| Alert      | Glass fill                     | `#FF3F6D`   | Glass stroke   | lg, md, sm      |
| Confirmed  | Glass fill                     | `#00D5B0`   | Glass stroke   | lg, md, sm      |
| Important  | Glass fill                     | `#FFA200`   | Glass stroke   | lg, md, sm      |
| Tertiary   | Glass fill                     | `#F2F4F7`   | Glass stroke   | lg, md, sm      |
| Disabled   | Glass fill                     | `rgba(242,244,247,0.35)` | none | lg, md, sm |

All buttons support an optional **leading icon** (24×24 for lg/md, 20×20 for sm) with `gap: 8px`.
Gradient and Danger buttons use `text-shadow: 0px 2px 8px rgba(27,40,64,0.25)`.

**States:** No hover, pressed, or focused states are defined in the Figma design system. Implement platform-appropriate feedback (e.g., opacity reduction on press for mobile).

### Input Fields

- Dark surface background (`white-8`) with `border-radius: 12px`
- Full input element dimensions: **360×116** (with label + counter)
- Label above: 12px medium, `#F2F4F7` at ~60% opacity
- Placeholder text: 14px regular, muted
- Character counter bottom-right: `0/30` format
- Optional leading icon (search) and trailing icon (visibility toggle)
- States: **Default** and **Focused** (turquoise border `#00D5B0`)
- Error state: red border + red helper text (separate Input Labels component)

**Input sub-types:**
- **Text** — standard text input
- **Username** — with `@` prefix symbol
- **Password** — dots + visibility toggle (Show/Hide eye icons, 24×24)
- **Search** — leading search icon
- **OTP** — 6-digit boxes (each 40×56), states: Idle, Focused, Focused filled, Idle filled
- **Number stepper** — minus/plus buttons around a number box
- **Neff tag picker** — dropdown with item states: New (turquoise "Add") and Added (white with count badge)

**Input Labels component** (360×20, 3 variants):
- `Error` — red error text
- `Forgot pass` — turquoise bold link
- `Counter` — character counter with helper text

**Password Strength Indicator** (342×40, 5 levels):

| Level    | Bar Color  | Label            |
|----------|-----------|------------------|
| Idle     | Gray      | "Password strength" |
| Weak     | Red       | "Weak password"  |
| Average  | Orange    | "Average password" |
| Good     | Turquoise | "Good password"  |
| Strong   | Turquoise (full) | "Strong password" |

### Select Fields

- Radio-button style with circle indicators
- Active state: turquoise fill with checkmark
- Items stack vertically in a card container
- Two sizes: **L item** (342×84, primary + secondary text) and **M item** (342×56, compact single-line)

### Toggles

| Size  | Dimensions | Track Radius | Knob ≈ |
|-------|-----------|-------------|--------|
| Large | 56×32     | 16px        | 24px   |
| Small | 42×24     | 12px        | 18px   |

- **On:** Turquoise (`#00D5B0`) track, white knob
- **Off:** Dark gray track, gray knob
- States: On and Off only (no disabled, hover, or focused states defined)

### Checkboxes & Radio Buttons

**Size:** Single size `md`. Variant property `Text=True/False` controls label:
- `Text=False`: standalone indicator, **20×20**
- `Text=True`: indicator + label + description, **344×50**

**Checkbox states** (per checked state): Default, Hover, Focused, Disabled
- Unchecked: empty square, `border-radius: 4px`
- Checked: turquoise fill + white checkmark
- Indeterminate: turquoise fill + white dash (**checkbox only**, not radio)
- Focus ring: turquoise outline
- Total: **20 checkbox variants** + **16 radio variants** = 36

**Radio buttons** mirror checkbox states but use circle shape with turquoise ring + dot when checked. No indeterminate state.

### Tags

**Three tag families**, each with distinct anatomy:

**Snip/Neff Tags** — content topic pills with `&` prefix:
- Height `32px`, `border-radius: 8px`, padding `4px 12px`
- Font: Inter 12px Medium 500, `line-height: 24px`, color `#B1B4BA`
- Border: `1px solid rgba(255,255,255,0.06)`
- Background: glass gradient `linear-gradient(-15.56deg, rgba(255,255,255,0.06) 40.13%, rgba(255,255,255,0.1) 97.02%)`
- Sub-variants: **Default** (auto-width), **Truncated** (max-width, `text-overflow: ellipsis`, padding `4px 8px`), **Last tag** (`32×32`, shows `+N` count)
- **Tag stack** (342×32): tags in a row with `gap: 6px`, ends with `+N` overflow badge

**Affect Tags** — emotional intensity indicators, 16 variants (2 types × 8 intensities):
- Height `36px`, `border-radius: 4px`, padding `0 12px`
- Font: Inter 16px Medium 500, `line-height: 24px`
- Glass gradient background on bordered states
- **Intensity badge:** 20×20 circle, positioned `top: -7.5px; left: -7.5px`, font Inter 14px Semi Bold 600, color `#0D1421`
- **Dismiss icon:** 20×20 white circle at `top: -7.5px; right: -7.5px`, X icon 8.5×8.5

| State | Border | Text Color | Badge | Label |
|-------|--------|-----------|-------|-------|
| Idle | `1px rgba(255,255,255,0.06)` | `#B1B4BA` | — | "Affect" |
| Low | `1.5px [color]` | `[color]` | L on `[color]` bg | "Affect" |
| Low on tap | solid `[color]` fill | `#0D1421` | — | "Low" |
| Medium | `1.5px [color]` | `[color]` | M on `[color]` bg | "Affect" |
| Medium on tap | solid `[color]` fill | `#0D1421` | — | "Medium" |
| High | `1.5px [color]` | `[color]` | H on `[color]` bg | "Affect" |
| High on tap | solid `[color]` fill | `#0D1421` | — | "High" |
| Remove | `1.5px #F2F4F7` | `#F2F4F7` | H on `#F2F4F7` bg | "Affect" + X dismiss |

**Affect tag color mapping (Figma-verified hex):**

| Intensity | Negative | Positive |
|-----------|----------|----------|
| Low | `#FFA200` (Decision Orange) | `#2B8CDC` (Praise Blue) |
| Medium | `#FE6B3C` (Atomic Tangerine) | `#13B4C3` (Pacific Blue) |
| High | `#FF3F6D` (Suggestion Red) | `#00D5B0` (Experience Turquoise) |

**Tap cycle:** Idle → Low (L badge, colored border) → flash "Low" (solid fill) → Medium (M badge) → flash "Medium" → High (H badge) → flash "High" → Idle. Long-press at any selected state → Remove (white border + X dismiss).

**Preference Tags** — interest/goal selection pills:
- Height `36px`, `border-radius: 4px`, padding `0 12px`
- Font: Inter 16px Medium 500, `line-height: 24px`
- Background: glass gradient `linear-gradient(-14.12deg, rgba(255,255,255,0.06) 40.13%, rgba(255,255,255,0.1) 97.02%)`
- **Idle:** border `1px solid rgba(255,255,255,0.06)`, text `#B1B4BA`
- **Selected:** border `1.5px solid #00D5B0`, text `#00D5B0`

### Toast Messages

- Single flexible component with slot overrides (not variant-based)
- Dimensions: **single-line 309×56**, **multi-line 309–348×80**
- Dark card, `border-radius: 12px`, glass effect with backdrop blur
- Leading icon (24×24, color-coded):
  - Success: turquoise checkmark
  - Info: blue question mark
  - Error: red trash icon
  - Warning: orange exclamation
- Text: **14px**, white. Highlighted text (e.g., board names) in **turquoise italic**

### Avatars

- Circular, **5 sizes: 24, 32, 40, 48, 64px** (max is 64px)
- Only **Nefee-branded** type in atom library: "N" logo on dark circle with gradient ring (negative gradient: red→orange)
- Naming: `Avatar/[size]/Nefee`
- Player status ring treatments: Explorer, Freemium, Premium (3 distinct ring styles on 48px avatars in headers)

### Dropdown Menus

- Dark surface card with glass effect + backdrop blur
- Item anatomy: **216×48**, 16px left padding, optional leading icon (24×24, often hidden), text frame, trailing element (checkbox, sort arrow, color swatch)
- Dividers between action groups
- Section headers: 10px text height, smaller label font

**12+ contextual menus:**

| Menu | Trigger | Items |
|------|---------|-------|
| Snip feed dropdown (318×283) | Kebab | Snip preferences, Report Snip |
| Neff feed dropdown (318×283) | Kebab | Neff preferences, Manage tags, Report Neff |
| Nefler profile dropdown (311×282) | Star | Add to favorites, Hide in feed |
| Favorite profile dropdown (288×282) | Star | Remove from favorites, Show in feed |
| Neffboard dropdown (119×130) | — | Edit board, Remove |
| Snipboard dropdown (119×130) | — | Edit board, Remove |
| Neffboard item dropdown (128×80) | — | Copy, Remove |
| Custom Neffboard item (128×80) | — | Copy, Move, Remove |
| My Neffs item (128×80) | — | Copy, Move, Remove |
| Custom Snipboard item (125×104) | — | Copy, Remove |
| Snipboard item (125×104) | — | Copy, Move, Remove |
| Daily picks item (175×64) | — | Remove, Unpublish |

**Counter component** (inline badge): Default (26×24), Positive change (38×24, green ↑), Negative change (38×24, red ↓)

**Prac filter dropdowns** (216px wide): Sort by (with direction toggle), Filter by (All/Public/Private checkboxes), Labels (color swatch circles 32×32: Turquoise, Orange, Blue, Red, All)

---

## 7. Molecules & Organisms

### Header Bar System

**Feed Header** (358×48): Logo icon (48×48) + Feed Switcher pill (238×48) + Avatar (48×48)

**Feed Switcher** — pill bar with 3 icon tabs, 4 states:
- `Snips` — Snips label centered, Neffs/Friends icons
- `Friends` — Friends label centered
- `Neffs` — Neffs label centered
- `Snips and Neffs` — dual mode, both labels
- Inactive icons: 24×24 | Active icons: 26×26 (turquoise tint)

**Basic Navigation** (48×48 each, 4 variants):
- `Min bg` / `Min no bg` — chevron-down with/without background
- `Close bg` / `Close no bg` — X icon with/without background

**HUB Switcher** (238×48) — pill toggle between Hub and Profile:
- 6 variants: Hub/Profile × Orange/Blue/Turquoise color schemes
- Active tab: filled pill background | Inactive: transparent

**Listing Header** (390×96): Search icon (48×48) + HUB Switcher + Close icon (48×48)
- 3 status variants: Explorer, Supportee, Supporter
- 16px side padding, 24px top padding

**Pracs Header** (358×48): Chevron-down + "My Pracs" label + filter icon

**Nefee Home Logo** (48×48): Default (with bg) and No bg variants

### Bottom Action Bar

**Action Bar** — horizontal icon toolbar, 4 context variants:

| Variant | Dimensions | Icons (left→right) |
|---------|-----------|-------------------|
| Snip listing | 390×48 | Quote, Kebab, Share, Bookmark, Headphones, Analytics ring |
| Snip summary | 390×96 | Quote, Kebab, Share, Bookmark, Eye, Analytics ring (double-row) |
| Neff listing | 390×48 | Quote, Kebab, Share, Bookmark, Star |
| Audio player | 390×48 | Kebab, Share, Bookmark, Star |

**Neff Creation FAB** — circular 48×48 button with turquoise progress ring:
- 5 states: 0%, 20%, 60%, 95%, 100% completion

**Snip Feed Dropdown** (318×283): Idle (collapsed, 40×40) / Active (expanded menu)

### Card Items

8 distinct card types — all text-content cards (no thumbnails):

| Card Type | Dimensions | Gap | Key Features |
|-----------|-----------|-----|--------------|
| Neff item | 358×80 | 8px | 4px color-coded left border (by Neff type), Nefee level badge (46×22), Default/Focused × Locked/Unlocked = 16 variants |
| Neffboard item | 358×80 | 8px | Same as Neff but with Level=100 property, 8 variants |
| Snip item | 358×108 | 8px | Multi-line text, Default/Focused, 2 variants |
| Board item | 358×124 | 12px | More metadata, Default/Focused, 2 variants |
| User/Search item | 358×64 | 0px | Avatar (40×40) at 12px offset, text at x=60 |
| Nefler card | 342×96 | — | Player profile card, Default/Focused |
| Daily pick item | 174×64 | 8px horizontal | 2-column grid layout |
| Daily pick date header | 356×54 | — | Date text + status badge (107×30) |

**List composition patterns:**
- Items stack with gaps (8px for Neff/Snip, 12px for Board)
- Date group headers (39–54px) separate content groups in Default boards and Daily Picks
- Full listing frames: 358×872 (10 Neff items), 358×920 (8 Snip items)

### Player Hub

Full-page scrollable organism (390×1589), 3 variants: Explorer, Supportee, Supporter.

**10 sections** (16px horizontal content padding, ~24px between sections):

| # | Section | Dimensions | Content |
|---|---------|-----------|---------|
| 1 | Listing Header | 390×96 | Search + HUB switcher + Close |
| 2 | Stats | 390×72–80 | 4 stat pills (84×40 each): Impact, My Neffs, Neflers, Neflis. Supportee/Supporter add All/Team toggle |
| 3 | Boards | 390×208 | Row 1: 3 tiles (114×84, 8px gap) — Pracs, Feelings, Neffs. Row 2: 2 tiles (175×84) — Saved Neffs, Saved Snips |
| 4 | Player Status | 390×120 | Status tier card (358×88): avatar + tier name + "Since [date]" + Upgrade btn |
| 5 | Resources | 390×224 | 2 resource cards (175×110): NEFT tokens + SUPTs. "Earn more" CTA (358×40, positive gradient) |
| 6 | Preferences | 390×208 | 2×2 grid (175×84 tiles): Interests, Goals, Sniptags, Nefftags |
| 7 | Teams | 390×120 | Team card (358×84): team icon + "My Teams" + invitation badge |
| 8 | Account | 390×116 | 2 tiles (175×84): Profile, Donations |
| 9 | Support | 390×116 | 2 tiles (175×84): Help, FAQ |
| 10 | Footer | 390×105 | "Nefee v1.0.0." centered + Terms & Privacy links (turquoise, underlined) |

**Hub Item tiles:** Simple (114×110, icon+label) and Complex (114×110, icon+label+counter)
**Status tiers:** Free (Explorer), Freemium (Supportee), Premium (Supporter) — each 358×88
**Nefting search FAB:** 56×56, bottom-right floating action button

### Pracs

Most complex organism. 6 sub-sections:

**Navigation:** HaRRs checked states (20×20: Active turquoise / Inactive circle), Completed counters (40×40: Opened/Completed/No completed), Listing nav arrows (40×40), Tab switcher (238×48), Frequency switcher (192×48), Interval selector (320×80, 6 variants: Active/Inactive × 3 calendar modes)

**Prac Completion Items** — massive variant matrix:

| Type | Colors | States | Total |
|------|--------|--------|-------|
| Multi-step | 4 (T/O/B/R) | Idle, Progressed, Completed, Overcompleted | 16 |
| Single-step | 4 | Idle, Paused, Completed, Overcompleted | 16 |
| Unit | 4 | 2+ states | 8+ |
| **Total** | | | **40+** |

**Prac Cards:** Full detail cards (388×658) with color-coded backgrounds per Neff type, completion tracking, progress indicators.

**Listing Headers:** Current/Past date × with/without bg (4 variants, 390×80 or 358×40)

**Prac-specific toggle:** Default/Small sizes × Active/Inactive (4 variants, differs from general toggle)

### Modals

Two categories with 20+ configurations total.

**SLIDEUP MODALS** (bottom sheet pattern):
- Full mobile width (390px), top grab bar (64×5, rounded, centered)
- Glass surface with backdrop blur (glass fill + glass stroke + blur 12px), top corners rounded 16px
- Content starts at y=24, 16px horizontal padding

| Modal | Dimensions | Content |
|-------|-----------|---------|
| Content Saved | 390×296 | Title, bookmark icon, board listing (3 items at 48px) |
| Content Saved (empty) | 390×164 | Title, "Create new" board item |
| Move/Copy content | 390×244 | Title, label, 2 board items |
| Remove content | 390×228 | Warning text, 2 stacked buttons (60px gap) |
| Share content | 390×172 | 2 stacked buttons |
| New board (idle/filled) | 390×648 | Input (360×116), 2 buttons, keyboard (390×288) |
| New board (with toggle) | 390×688 | Input + private toggle + 2 buttons + keyboard |
| Set Sniptags/Nefftags | 390×620 | Interest rows with 3 option circles (40×40), save button |
| Add Link | 390×660 | 2 input fields (360×88), save button, keyboard |
| AI Generator Options | 390×408 | 5 stacked buttons |
| Audio Player | 390×281 | Audio playback controls |

**Board Item (modal variant)** — 390×48, 3 variants: Create new (+icon), Available (board icon+name), Selected (checkmark+name)

**Interest Options** — 40×40 circles, 6 variants: None/Less/More × unselected/selected

**POPUP MODALS** (centered overlay):
- Glass effect with backdrop blur, 342–390px wide
- Backdrop dim: `rgba(13, 20, 33, 0.6)`

| Modal | Dimensions | Content |
|-------|-----------|---------|
| Confirmation | 390×156 | Title, 2 side-by-side buttons (173×48, 12px gap) |
| Confirmation + checkbox | 390×196 | + "don't show again" checkbox |
| Confirmation + description | 390×292 | + description paragraph |
| Set Steps (HaRR) | 342×362 | Number scroller + 2 buttons |
| Set Percentage (HaRR) | 342×362 | Percentage display + 6 step buttons (48×36) + 2 buttons |
| Content Popup (left/center) | 390×512 | Title + long text + action button + close X (24×24) |
| Content Popup (no title) | 390×384 | Text body + close X |

**Button layout patterns:**
- Stacked: 358px wide buttons, 60px vertical gap
- Side-by-side: 173px + 12px gap + 173px

---

## 8. Composition Rules (Atomic Design Hierarchy)

### Atoms
Buttons, Inputs, Tags, Toggles, Checkboxes, Radio buttons, Avatars, Icons, Password strength, Counter badges

### Molecules
- Input field with label + helper text + counter (360×116)
- Toast message (icon + text, 309×56)
- Dropdown menu (trigger + item list)
- Tag group (tags + overflow counter, 342×32)
- Feed Switcher (3-tab pill bar, 238×48)
- HUB/Profile Switcher (pill toggle, 238×48)
- Basic Navigation buttons (back/close, 48×48)
- Board item (modal variant, 390×48)
- Neff Creation FAB (48×48 + progress ring)
- Interest option circles (40×40)

### Organisms
- Header bar system (Feed header + Basic nav + HUB switcher + Listing header + Pracs header)
- Bottom action bar (4 context variants + FAB)
- Card item listings (8 card types with composition patterns)
- Modal system (15+ slideup configs + 7+ popup configs)
- Player Hub (10-section scrollable page, 390×1589)
- Pracs (HaRRs + completion items + cards + creation flow)

### Templates/Pages
- Feed view: Header → Content cards → Bottom bar
- Hub view: Listing Header → 10 scrollable sections → Footer
- Modal overlays: Dimmed backdrop + slideup/popup modal
- Prac view: Pracs header → Listing items → Detail cards

---

## 9. Cross-Cutting Patterns

### Elevation & Z-Index Scale

| Layer | z-index | Components |
|-------|---------|-----------|
| Base content | 0 | Cards, lists, page content |
| Sticky nav | 10 | Header bar, bottom action bar |
| Dropdowns | 20 | All dropdown menus |
| Slideup modals | 30 | Bottom sheet modals |
| Popup modals | 40 | Centered overlay modals |
| Toasts | 50 | Toast notifications |

Backdrop dimming: `rgba(13, 20, 33, 0.6)` (Ink Black at 60%)

### Motion Tokens (derivable)

| Token | Duration | Use |
|-------|----------|-----|
| fast | 150ms | Hover states, toggles, checkboxes |
| normal | 250ms | Dropdowns, tab switches, fade-ins |
| slow | 350ms | Modal open/close, page transitions |
| ease | `cubic-bezier(0.4, 0, 0.2, 1)` | Default easing curve |

Glass surface reveal: `opacity: 0→1` + `backdrop-filter: blur(0→12px)` at 250ms ease.

### State Patterns (derivable)

| Pattern | Derivation |
|---------|-----------|
| Progress bars | Extend password strength pattern: 4–8px height, 4px radius. Turquoise=positive, Orange=warning, Red=danger |
| Loading spinner | Experience Turquoise (`#00D5B0`) ring on Ink Black background (matches FAB progress ring) |
| Disabled states | White 35% token for text/icons. Glass fill without border for containers |
| Feature gating | Neff item lock/unlock pattern: glass surface + lock icon overlay |

### Density Modes

| Mode | Surface | Hit Target | Button Sizes | Row Height | Typography |
|------|---------|-----------|-------------|-----------|-----------|
| Touch | Mobile app | 48×48 | lg/md/sm (56/48/40) | 64–124px cards | 18px title, 16px body, 14px secondary |
| Comfortable | Dashboard | 40×40 | md/sm (48/40) | 48–56px rows | 16px title, 14px body, 12px secondary |
| Compact | Admin | 32–36px | sm (40px) | 32–36px rows | 14px title, 12px body, 10px labels |

### Dashboard Derivation Notes

These patterns can be derived from existing tokens for dashboard/admin surfaces:
- **Breadcrumbs:** 14px regular, `#F2F4F7` at reduced opacity (inactive), Turquoise (active), chevron-right separator, 8px gaps
- **Dashboard topbar:** 48×48 icon targets, 32/48px avatar, Inter 18px semi bold page titles, Ink Black background
- **Stat cards:** Scale Hub stat pills (84×40) to larger cards: glass fill surface, 16px radius, 24px padding, 24px bold value + 14px regular label
- **Content grid:** card radius 16px, glass fill, 16px gaps (lg), 24px panel padding (xl)

---

## 10. Platform-Specific Token Output

### Flutter / Dart

```dart
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class NefeeColors {
  // Primary
  static const suggestionRed = Color(0xFFFF3F6D);
  static const decisionOrange = Color(0xFFFFA200);
  static const praiseBlue = Color(0xFF2B8CDC);
  static const experienceTurquoise = Color(0xFF00D5B0);

  // Secondary
  static const inkBlack = Color(0xFF0D1421);
  static const white = Color(0xFFF2F4F7);

  // Semantic
  static const errorRed = Color(0xFFC3284D);

  // Transparent
  static const white8 = Color(0x14FFFFFF);   // 8%
  static const white35 = Color(0x59FFFFFF);  // 35%

  // Background gradient stops
  static const darkBgStart = Color(0xFF0D1421);
  static const darkBgEnd = Color(0xFF152036);

  // Neff type colors (same as primary, for semantic clarity)
  static const neffExperience = experienceTurquoise;
  static const neffDecision = decisionOrange;
  static const neffPraise = praiseBlue;
  static const neffSuggestion = suggestionRed;
}

class NefeeGradients {
  static const positive = LinearGradient(
    transform: GradientRotation(96.54 * 3.14159 / 180),
    colors: [NefeeColors.praiseBlue, NefeeColors.experienceTurquoise],
    stops: [0.0562, 0.9141],
  );

  static const negative = LinearGradient(
    transform: GradientRotation(116.99 * 3.14159 / 180),
    colors: [NefeeColors.suggestionRed, NefeeColors.decisionOrange],
    stops: [0.1073, 0.892],
  );

  static const darkBackground = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [NefeeColors.darkBgStart, NefeeColors.darkBgEnd],
  );

  static const glassFill = LinearGradient(
    transform: GradientRotation(-20.95 * 3.14159 / 180),
    colors: [Color(0x0FFFFFFF), Color(0x1AFFFFFF)],
    stops: [0.4013, 0.9702],
  );
}

class NefeeLayout {
  static const double mobileWidth = 390;
  static const double contentPadding = 16;
  static const double contentWidth = 358; // 390 - 16 - 16
  static const double headerHeight = 48;
  static const double listingHeaderHeight = 96;
  static const double bottomBarHeight = 48;
  static const double iconHitTarget = 48;
  static const double iconVisible = 24;
}

class NefeeMotion {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 350);
  static const Curve ease = Curves.easeInOut; // cubic-bezier(0.4, 0, 0.2, 1)
}

class NefeeElevation {
  static const int base = 0;
  static const int stickyNav = 10;
  static const int dropdown = 20;
  static const int slideupModal = 30;
  static const int popupModal = 40;
  static const int toast = 50;
  static const backdropDim = Color(0x990D1421); // Ink Black at 60%
}

class NefeeTheme {
  static ThemeData get dark => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: NefeeColors.inkBlack,
    colorScheme: const ColorScheme.dark(
      primary: NefeeColors.experienceTurquoise,
      secondary: NefeeColors.praiseBlue,
      error: NefeeColors.errorRed,
      surface: NefeeColors.inkBlack,
      onSurface: NefeeColors.white,
      onPrimary: NefeeColors.white,
    ),
    textTheme: GoogleFonts.interTextTheme(const TextTheme(
      headlineLarge:  TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: NefeeColors.white, height: 1.5),  // line-height: 36px
      headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.w400, color: NefeeColors.white, height: 1.5),
      titleLarge:     TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: NefeeColors.white, height: 1.556), // 28px
      titleMedium:    TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: NefeeColors.white, height: 1.556),
      titleSmall:     TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: NefeeColors.white, height: 1.556),
      bodyLarge:      TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: NefeeColors.white, height: 1.5, letterSpacing: 0.16), // 24px
      bodyMedium:     TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: NefeeColors.white, height: 1.5, letterSpacing: 0.16),
      bodySmall:      TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: NefeeColors.white, height: 1.714), // 24px
      labelLarge:     TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: NefeeColors.white, height: 1.571), // 22px
      labelMedium:    TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: NefeeColors.white, height: 1.667), // 20px
      labelSmall:     TextStyle(fontSize: 10, fontWeight: FontWeight.w400, color: NefeeColors.white, height: 1.2),   // 12px
    )),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, letterSpacing: 0.36, height: 1.556),
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 10),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: NefeeColors.white8,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: NefeeColors.experienceTurquoise),
      ),
      labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, height: 1.667),
    ),
  );
}
```

### React / Next.js / Tailwind CSS

```js
// tailwind.config.js — extend theme
module.exports = {
  theme: {
    extend: {
      colors: {
        nefee: {
          'suggestion-red': '#FF3F6D',
          'decision-orange': '#FFA200',
          'praise-blue': '#2B8CDC',
          'experience-turquoise': '#00D5B0',
          'ink-black': '#0D1421',
          'white': '#F2F4F7',
          'error-red': '#C3284D',
          'dark-bg': '#152036',
          'white-8': 'rgba(255, 255, 255, 0.08)',
          'white-35': 'rgba(255, 255, 255, 0.35)',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
      fontSize: {
        '10': ['10px', { lineHeight: '12px' }],
        '12': ['12px', { lineHeight: '20px' }],
        '14': ['14px', { lineHeight: '24px' }],
        '14-compact': ['14px', { lineHeight: '22px' }],
        '16': ['16px', { lineHeight: '24px', letterSpacing: '0.16px' }],
        '18': ['18px', { lineHeight: '28px' }],
        '24': ['24px', { lineHeight: '36px' }],
      },
      borderRadius: {
        'pill-lg': '28px',
        'pill': '34px',
        'card': '16px',
        'input': '12px',
        'tag': '8px',
        'checkbox': '4px',
      },
      backgroundImage: {
        'gradient-positive': 'linear-gradient(96.54deg, #2B8CDC 5.62%, #00D5B0 91.41%)',
        'gradient-negative': 'linear-gradient(116.99deg, #FF3F6D 10.73%, #FFA200 89.2%)',
        'gradient-dark-bg': 'linear-gradient(180deg, #0D1421 0%, #152036 100%)',
        'gradient-glass': 'linear-gradient(-20.95deg, rgba(255,255,255,0.06) 40.13%, rgba(255,255,255,0.1) 97.02%)',
      },
      boxShadow: {
        'xs': '0px 1px 2px rgba(16, 24, 40, 0.05)',
        'text-glow': '0px 2px 8px rgba(27, 40, 64, 0.25)',
      },
      spacing: {
        'nefee-xs': '4px',
        'nefee-sm': '8px',
        'nefee-md': '12px',
        'nefee-lg': '16px',
        'nefee-xl': '24px',
        'nefee-2xl': '28px',
      },
      transitionDuration: {
        'nefee-fast': '150ms',
        'nefee-normal': '250ms',
        'nefee-slow': '350ms',
      },
      transitionTimingFunction: {
        'nefee-ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      width: {
        'mobile': '390px',
        'content': '358px',
      },
      zIndex: {
        'sticky-nav': '10',
        'dropdown': '20',
        'slideup-modal': '30',
        'popup-modal': '40',
        'toast': '50',
      },
    },
  },
};
```

**Utility class patterns (per size):**

```html
<!-- Primary button (lg) — 18px, tracking 0.36px, px-7, rounded-pill-lg, icon 24 -->
<button class="bg-gradient-positive text-nefee-white font-inter font-semibold text-18 tracking-[0.36px] h-14 px-7 py-2.5 rounded-pill-lg flex items-center gap-2 shadow-text-glow transition-opacity duration-nefee-fast ease-nefee-ease">
  <Icon class="size-6" /> Button
</button>

<!-- Primary button (md) — 16px, tracking 0.32px, px-6, rounded-pill, icon 24 -->
<button class="bg-gradient-positive text-nefee-white font-inter font-semibold text-16 tracking-[0.32px] h-12 px-6 py-2.5 rounded-pill flex items-center gap-2">
  <Icon class="size-6" /> Button
</button>

<!-- Primary button (sm) — 14px, no tracking, px-[18px], rounded-pill, icon 20 -->
<button class="bg-gradient-positive text-nefee-white font-inter font-semibold text-14-compact h-10 px-[18px] py-2.5 rounded-pill flex items-center gap-2">
  <Icon class="size-5" /> Button
</button>

<!-- Glass surface button (Tertiary/Alert/Confirmed/Important — lg shown) -->
<button class="bg-gradient-glass border border-white/[0.06] text-nefee-white font-inter font-semibold text-18 tracking-[0.36px] h-14 px-7 py-2.5 rounded-pill-lg flex items-center gap-2">
  <Icon class="size-6" /> Button
</button>

<!-- Dark card surface -->
<div class="bg-gradient-dark-bg rounded-card p-4">...</div>

<!-- Glass card with blur -->
<div class="bg-gradient-glass border border-white/[0.06] backdrop-blur-[12px] rounded-card p-4">...</div>

<!-- Input field -->
<div>
  <label class="text-12 font-medium text-nefee-white/60 mb-1">Label</label>
  <input class="bg-nefee-white-8 rounded-input px-3 py-2.5 text-14 text-nefee-white border border-transparent focus:border-nefee-experience-turquoise transition-colors duration-nefee-fast" />
</div>

<!-- Modal backdrop -->
<div class="fixed inset-0 bg-[rgba(13,20,33,0.6)] z-popup-modal">...</div>
```

---

## 11. Anti-Patterns / Do-Nots

1. **Never use pure white (`#FFFFFF`) as text.** Always use `#F2F4F7` (Nefee White).
2. **Never use pure black (`#000000`) as background.** Always use `#0D1421` (Ink Black) or the dark background gradient.
3. **Never use sharp corners on buttons.** All buttons are pill-shaped (`border-radius: 28px` for lg, `34px` for md/sm).
4. **Never use light/white backgrounds.** Nefee is a dark-theme-only product.
5. **Never assume both gradients flow the same direction.** Positive = `96.54deg` (near-horizontal left→right). Negative = `116.99deg` (steeper, bottom-left→top-right).
6. **Never hardcode opacity for disabled states.** Use the `White 35%` token (`rgba(242,244,247,0.35)`).
7. **Never use colors outside the palette.** If a color isn't in the tokens table, it doesn't belong in Nefee.
8. **Never skip the glass effect for secondary buttons.** Tertiary/Alert/Confirmed/Important all use the glass fill gradient + glass stroke border.
9. **Never use Roboto Mono for anything other than 14px data/code display.** Weight is Medium 500, not Regular 400.
10. **Atomic Tangerine and Pacific Blue are restricted** to Neff affect tag intensity indicators. Do not use them elsewhere.
11. **Never use "sensible default" line heights.** All typography styles have explicit line heights defined — use them.
12. **Never describe cards as "thumbnail + metadata."** Nefee cards are text-content cards with type indicators and optional level badges — no thumbnails.
