# apps.gamification.signals
"""
Signal handlers that award points and badges.

Wired to:
  - LessonProgress.post_save  (content app)
  - AssessmentAttempt.post_save (assessments app)

Pattern:
  Every handler is wrapped in a try/except so a gamification
  failure NEVER breaks the core learning flow. Points are a
  bonus — they must never block lesson completion or submission.
"""
import logging
from datetime import date, timedelta

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.gamification.models import (
    POINT_VALUES,
    BadgeCode,
    PointEvent,
    PointReason,
    StudentBadge,
    StudentPoints,
    StudentStreak,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────

def _award_points(user, reason: str, **kwargs) -> int:
    """
    Award points for a reason. Creates a PointEvent and updates
    StudentPoints atomically using select_for_update.
    Returns the points awarded.
    """
    points = POINT_VALUES.get(reason, 0)
    if points <= 0:
        return 0

    with transaction.atomic():
        PointEvent.objects.create(
            user=user,
            points=points,
            reason=reason,
            **kwargs,
        )
        summary, _ = StudentPoints.objects.select_for_update().get_or_create(user=user)
        summary.total_points += points
        summary.save(update_fields=["total_points", "updated_at"])

    logger.info(
        "Gamification: user=%s +%d pts reason=%s total=%d",
        user.id, points, reason, summary.total_points,
    )
    return points


def _award_badge(user, badge_code: str) -> bool:
    """
    Award a badge if not already earned.
    Returns True if newly awarded, False if already had it.
    """
    created = False
    try:
        _, created = StudentBadge.objects.get_or_create(
            user=user,
            badge_code=badge_code,
        )
        if created:
            logger.info("Gamification: user=%s earned badge=%s", user.id, badge_code)
    except Exception:
        logger.exception("Gamification: badge award failed user=%s badge=%s", user.id, badge_code)
    return created


def _update_streak(user) -> int:
    """
    Update the student's daily streak.
    Returns the current streak value after update.
    """
    today = date.today()
    streak, _ = StudentStreak.objects.select_for_update().get_or_create(user=user)

    if streak.last_activity_date == today:
        # Already active today — no change
        return streak.current_streak

    yesterday = today - timedelta(days=1)

    if streak.last_activity_date == yesterday:
        # Consecutive day — extend streak
        streak.current_streak += 1
    else:
        # Gap in activity — reset streak
        streak.current_streak = 1

    streak.last_activity_date = today
    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
    streak.save(update_fields=["current_streak", "longest_streak", "last_activity_date"])

    return streak.current_streak


def _check_lesson_badges(user) -> None:
    """Award badges based on total completed lessons."""
    from apps.content.models import LessonProgress
    completed = LessonProgress.objects.filter(user=user, completed=True).count()

    if completed >= 1:
        _award_badge(user, BadgeCode.FIRST_LESSON)
    if completed >= 10:
        _award_badge(user, BadgeCode.LESSON_10)
    if completed >= 50:
        _award_badge(user, BadgeCode.LESSON_50)


def _check_assessment_badges(user) -> None:
    """Award badges based on assessment performance."""
    from apps.assessments.models import AssessmentAttempt

    has_passed = AssessmentAttempt.objects.filter(
        user=user, passed=True, submitted_at__isnull=False
    ).exists()
    if has_passed:
        _award_badge(user, BadgeCode.FIRST_PASS)


def _check_points_badges(user) -> None:
    """Award badges based on total points milestones."""
    try:
        summary = StudentPoints.objects.get(user=user)
    except StudentPoints.DoesNotExist:
        return

    if summary.total_points >= 100:
        _award_badge(user, BadgeCode.POINTS_100)
    if summary.total_points >= 500:
        _award_badge(user, BadgeCode.POINTS_500)


def _check_streak_bonuses(user, current_streak: int) -> None:
    """Award streak bonuses and badges when milestones are hit."""
    if current_streak == 3:
        _award_points(user, PointReason.STREAK_3)
        _award_badge(user, BadgeCode.STREAK_3)
    elif current_streak == 7:
        _award_points(user, PointReason.STREAK_7)
        _award_badge(user, BadgeCode.STREAK_7)


# ─────────────────────────────────────────────────────────────────
# LESSON COMPLETION SIGNAL
# ─────────────────────────────────────────────────────────────────

@receiver(post_save, sender="content.LessonProgress")
def on_lesson_progress_save(sender, instance, created, **kwargs):
    """
    Fire when LessonProgress is saved.
    Only awards points when `completed` transitions to True.
    Guards against re-awarding on subsequent saves.
    """
    try:
        # Only fire when lesson just became completed
        if not instance.completed:
            return

        # Guard: only award once — check if a PointEvent already exists
        # for this lesson+user combination
        if PointEvent.objects.filter(
            user=instance.user,
            reason=PointReason.LESSON_COMPLETE,
            lesson_id=instance.lesson_id,
        ).exists():
            return

        user = instance.user
        if user.role != "STUDENT":
            return

        with transaction.atomic():
            # 1. Award lesson completion points
            _award_points(user, PointReason.LESSON_COMPLETE, lesson_id=instance.lesson_id)

            # 2. Update streak
            current_streak = _update_streak(user)

            # 3. Check streak bonuses
            _check_streak_bonuses(user, current_streak)

            # 4. Check lesson badges
            _check_lesson_badges(user)

            # 5. Check points milestones
            _check_points_badges(user)

    except Exception:
        logger.exception(
            "Gamification: lesson_progress signal failed for user=%s lesson=%s",
            getattr(instance, "user_id", "?"),
            getattr(instance, "lesson_id", "?"),
        )


# ─────────────────────────────────────────────────────────────────
# ASSESSMENT ATTEMPT SIGNAL
# ─────────────────────────────────────────────────────────────────

@receiver(post_save, sender="assessments.AssessmentAttempt")
def on_assessment_attempt_save(sender, instance, created, **kwargs):
    """
    Fire when AssessmentAttempt is saved.
    - Attempt submitted: +5 pts
    - Passed: +25 pts
    - Perfect score: +50 pts bonus
    Guards against re-awarding on subsequent saves.
    """
    try:
        # Only fire when attempt is being submitted (submitted_at just set)
        if not instance.submitted_at:
            return

        user = instance.user
        if user.role != "STUDENT":
            return

        attempt_id = instance.id

        # Guard: only award once per attempt
        if PointEvent.objects.filter(
            user=user,
            reason=PointReason.ASSESSMENT_ATTEMPT,
            assessment_id=attempt_id,
        ).exists():
            return

        with transaction.atomic():
            # 1. Always award attempt points
            _award_points(
                user,
                PointReason.ASSESSMENT_ATTEMPT,
                assessment_id=attempt_id,
            )

            # 2. Award pass points
            if instance.passed:
                _award_points(
                    user,
                    PointReason.ASSESSMENT_PASS,
                    assessment_id=attempt_id,
                )

            # 3. Award perfect score bonus
            total = instance.assessment.total_marks
            if total and total > 0 and instance.score == total:
                _award_points(
                    user,
                    PointReason.PERFECT_SCORE,
                    assessment_id=attempt_id,
                )
                _award_badge(user, BadgeCode.PERFECT_SCORE)

            # 4. Update streak
            current_streak = _update_streak(user)

            # 5. Check streak bonuses
            _check_streak_bonuses(user, current_streak)

            # 6. Check assessment badges
            _check_assessment_badges(user)

            # 7. Check points milestones
            _check_points_badges(user)

    except Exception:
        logger.exception(
            "Gamification: assessment_attempt signal failed for user=%s attempt=%s",
            getattr(instance, "user_id", "?"),
            getattr(instance, "id", "?"),
        )