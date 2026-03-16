# GyanGrit — Gamification System

This document describes the gamification system: how points are earned,
how streaks work, what badges exist, and how leaderboards are scoped.

---

## Overview

The gamification system motivates rural students to engage consistently with
learning content. It rewards lesson completion, assessment performance, and
daily activity habits.

**Design principles:**
- Gamification must never block core learning. All signal handlers are wrapped in `try/except`.
- Points are a ledger, not a counter. Double-awarding is architecturally impossible.
- Streaks reward consistency, not volume. One activity per day is enough.
- Leaderboards are scoped — students compete with their own class by default.

---

## Points

### How Points Are Earned

| Action | Points | Notes |
|---|---|---|
| Lesson completed | +10 | Awarded once per lesson. Completing the same lesson again yields no points. |
| Assessment attempted | +5 | Awarded once per attempt (not per assessment). |
| Assessment passed | +25 | Awarded on top of the attempt bonus, only if `passed=True`. |
| Perfect score (100%) | +50 | Bonus on top of attempt + pass points. Awarded if `score == total_marks`. |
| 3-day streak | +15 | One-time bonus when streak first reaches exactly 3. |
| 7-day streak | +50 | One-time bonus when streak first reaches exactly 7. |

### Point Architecture

Points are stored in two places:

1. **`PointEvent`** — an immutable append-only ledger row created for every award. This is the source of truth and the deduplication guard. Before awarding, the system checks if a `PointEvent` with the same `(user, reason, lesson_id/assessment_id)` already exists.

2. **`StudentPoints`** — a denormalized running total per student. Updated atomically with `select_for_update` each time a `PointEvent` is created. Used for fast leaderboard queries.

**Why a ledger?**
- Full audit trail — admins can see exactly how every point was earned
- Deduplication — re-running migrations or resending signals never double-awards
- Correctability — if a bug over-awarded points, individual `PointEvent` rows can be deleted and totals recalculated

---

## Streaks

### How Streaks Work

A streak measures consecutive days of learning activity. Activity is defined as:
- Completing a lesson, **or**
- Submitting an assessment attempt

Streak is tracked in `StudentStreak` with fields:
- `current_streak` — days in the current unbroken run
- `longest_streak` — all-time highest streak
- `last_activity_date` — the most recent date with activity

### Streak Logic

```
On each activity:
  If last_activity_date == today         → no change (already counted today)
  If last_activity_date == yesterday     → current_streak += 1
  If last_activity_date is older or null → current_streak = 1 (reset)

Always:
  longest_streak = max(longest_streak, current_streak)
  last_activity_date = today
```

**Why use `date` not `datetime`?**
A student doing homework at 11:55 PM and again at 12:05 AM should count as two different days, not a broken streak. Using `date` also eliminates timezone edge cases.

### Streak Bonuses

Streak bonuses are one-time awards:
- When `current_streak` reaches exactly 3 → +15 pts, badge `streak_3`
- When `current_streak` reaches exactly 7 → +50 pts, badge `streak_7`

The bonus fires on the day the threshold is crossed, not every day above it.

---

## Badges

### Badge Catalog

| Code | Label | Emoji | Condition |
|---|---|---|---|
| `first_lesson` | First Lesson | 📖 | Complete any 1 lesson |
| `lesson_10` | 10 Lessons | 🔟 | Complete 10 lessons total |
| `lesson_50` | 50 Lessons | 🏆 | Complete 50 lessons total |
| `first_pass` | First Pass | ✅ | Pass any 1 assessment |
| `perfect_score` | Perfect Score | 💯 | Score 100% on any assessment |
| `streak_3` | 3-Day Streak | 🔥 | Maintain a 3-day streak |
| `streak_7` | 7-Day Streak | ⚡ | Maintain a 7-day streak |
| `points_100` | 100 Points | 💎 | Accumulate 100 total points |
| `points_500` | 500 Points | 👑 | Accumulate 500 total points |

### Badge Architecture

`StudentBadge` records are created using `get_or_create`. A student can only earn each badge once (`unique_together = [("user", "badge_code")]`). Attempting to award an already-earned badge is a silent no-op.

Badges are checked after every point event. The check functions query the source of truth — e.g. `LessonProgress.filter(user, completed=True).count()` — rather than trusting any cached value.

---

## Leaderboards

### Class Leaderboard
**GET** `/api/v1/gamification/leaderboard/class/`

Shows the top 20 students in the requesting student's class, ordered by `total_points` descending.

If the requesting student is outside the top 20, their entry is appended at the end with their actual rank. This ensures students always see their own standing even when not in the top tier.

### School Leaderboard
**GET** `/api/v1/gamification/leaderboard/school/`

Shows the top 20 students across the entire school (institution), ordered by `total_points` descending. Same "append own entry" logic applies.

### Leaderboard Scope by Role

| Role | Class Leaderboard | School Leaderboard |
|---|---|---|
| STUDENT | Own class (automatic) | Own school (automatic) |
| TEACHER | Any class via `?class_id=` | Own institution (automatic) |
| PRINCIPAL | Any class via `?class_id=` | Own institution (automatic) |
| OFFICIAL | Any class via `?class_id=` | Any school via `?institution_id=` |
| ADMIN | Any class via `?class_id=` | Any school via `?institution_id=` |

### Entry Format

```json
{
  "rank": 3,
  "user_id": 5,
  "display_name": "harpreet_k",
  "total_points": 185,
  "is_me": true
}
```

`is_me` allows the frontend to highlight the current user's row regardless of position.

---

## Frontend Integration

### Student Dashboard (`/dashboard`)
The dashboard shows a gamification strip above the subject cards:
- **Points card** — total points, class rank, links to `/leaderboard`
- **Streak card** — current streak, with 🔥 at 3+ days and ⚡ at 7+ days
- **Badges card** — badge count, links to `/profile`
- **Leaderboard shortcut** — quick link to class leaderboard

### Assessment Result Page (`/assessment-result`)
After submitting an assessment, the result page shows:
- Points earned this attempt (+5 attempt, +25 pass if passed, +50 perfect if 100%)
- Running total from the `/gamification/me/` endpoint
- "🏆 View leaderboard" button

### Profile Page (`/profile`)
For STUDENT role, the profile page shows:
- 3-stat grid: total points, current streak, badge count
- Badge shelf: all earned badges displayed with emoji and label

### Leaderboard Page (`/leaderboard`)
Dedicated page at `/leaderboard`:
- **Tab toggle** — "🏫 My Class" vs "🏛️ My School"
- **Podium** — top 3 displayed with gold/silver/bronze medals and scaled avatars (2nd on left, 1st center, 3rd on right)
- **Ranked list** — positions 4+ in compact row format
- Student's own row highlighted in blue (`is_me: true`) at its actual rank
- School tab loads lazily on first open

---

## Summary Endpoint

**GET** `/api/v1/gamification/me/`

Returns the student's full gamification state in one call:

```json
{
  "total_points": 185,
  "current_streak": 4,
  "longest_streak": 7,
  "badge_count": 5,
  "class_rank": 3,
  "badges": [
    {
      "code": "first_lesson",
      "label": "First Lesson",
      "emoji": "📖",
      "earned_at": "2026-03-01T09:00:00+05:30"
    }
  ]
}
```

This is called on dashboard mount and profile mount. Gamification failure at this endpoint is non-fatal — the dashboard renders without the gamification strip rather than showing an error.
