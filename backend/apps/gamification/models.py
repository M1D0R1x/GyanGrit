# apps.gamification.models
"""
Gamification models for GyanGrit.

Design decisions:
- PointEvent is an immutable append-only ledger. Never update rows, only INSERT.
  This gives a complete audit trail and avoids race conditions on totals.
- StudentPoints is a denormalized running total updated by signals.
  Querying SUM(PointEvent.points) per user on every leaderboard request
  would not scale to hundreds of students — the cached total solves this.
- StudentBadge uses a CharField choice for badge_code so badge definitions
  live in Python, not the database. Adding a new badge = add a constant,
  write a migration for the new choice only if you want DB constraint.
- StudentStreak tracks the last_activity_date as a date (not datetime)
  so timezone differences don't cause double-counting within the same day.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class PointReason(models.TextChoices):
    LESSON_COMPLETE  = "lesson_complete",  "Lesson completed"
    ASSESSMENT_ATTEMPT = "assessment_attempt", "Assessment attempted"
    ASSESSMENT_PASS  = "assessment_pass",  "Assessment passed"
    PERFECT_SCORE    = "perfect_score",    "Perfect score (100%)"
    STREAK_3         = "streak_3",         "3-day streak bonus"
    STREAK_7         = "streak_7",         "7-day streak bonus"


class BadgeCode(models.TextChoices):
    FIRST_LESSON  = "first_lesson",  "First Lesson"
    LESSON_10     = "lesson_10",     "10 Lessons Completed"
    LESSON_50     = "lesson_50",     "50 Lessons Completed"
    FIRST_PASS    = "first_pass",    "First Assessment Passed"
    PERFECT_SCORE = "perfect_score", "Perfect Score"
    STREAK_3      = "streak_3",      "3-Day Streak"
    STREAK_7      = "streak_7",      "7-Day Streak"
    POINTS_100    = "points_100",    "100 Points"
    POINTS_500    = "points_500",    "500 Points"


# Points awarded per reason — single source of truth
POINT_VALUES: dict[str, int] = {
    PointReason.LESSON_COMPLETE:    10,
    PointReason.ASSESSMENT_ATTEMPT: 5,
    PointReason.ASSESSMENT_PASS:    25,
    PointReason.PERFECT_SCORE:      50,
    PointReason.STREAK_3:           15,
    PointReason.STREAK_7:           50,
}


class PointEvent(models.Model):
    """
    Immutable ledger of every point award.
    Never update — only INSERT. Audit trail lives here.
    """
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="point_events",
    )
    points     = models.PositiveSmallIntegerField()
    reason     = models.CharField(max_length=32, choices=PointReason.choices)
    # Optional FK fields for context — nullable so the ledger survives deletions
    lesson_id  = models.IntegerField(null=True, blank=True)
    assessment_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} +{self.points} ({self.reason})"


class StudentPoints(models.Model):
    """
    Denormalized running total — updated atomically by signals.
    OneToOne with User so a single query fetches rank context.
    """
    user         = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="points_summary",
    )
    total_points = models.PositiveIntegerField(default=0, db_index=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-total_points"]

    def __str__(self):
        return f"{self.user} — {self.total_points} pts"


class StudentBadge(models.Model):
    """
    A badge earned by a student. Unique per user+badge_code.
    Created once, never updated.
    """
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="badges",
    )
    badge_code = models.CharField(max_length=32, choices=BadgeCode.choices)
    earned_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = [("user", "badge_code")]
        ordering = ["earned_at"]

    def __str__(self):
        return f"{self.user} — {self.badge_code}"


class StudentStreak(models.Model):
    """
    Tracks the student's daily activity streak.
    current_streak resets to 0 if last_activity_date is more than 1 day ago.
    """
    user               = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="streak",
    )
    current_streak     = models.PositiveSmallIntegerField(default=0)
    longest_streak     = models.PositiveSmallIntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.user} — {self.current_streak} day streak"