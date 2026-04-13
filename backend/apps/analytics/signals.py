"""
apps.analytics.signals
Real-time student risk intervention — v2 (7 weighted signals).

Flow:
  AssessmentAttempt.submitted_at is set  →  post_save fires
  → _recalculate_risk(student)
  → if risk crossed to HIGH → notify all teachers of that student's section
"""
import logging
from datetime import timedelta

from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger(__name__)


def _recalculate_risk(student) -> tuple[float, str, dict]:
    """
    Enhanced risk analysis — 7 weighted signals.

    SIGNALS AND WEIGHTS:
      1. Login recency         (0-25 pts)  — no login in 3+ days
      2. Engagement trend       (0-20 pts)  — week-over-week drop >50%
      3. Assessment failures    (0-15 pts)  — failed assessments this week
      4. Lesson completion rate (0-15 pts)  — % lessons completed vs total
      5. Assessment avoidance   (0-10 pts)  — available assessments not attempted
      6. Live session absence   (0-10 pts)  — missed live sessions this week
      7. Streak broken          (0-5 pts)   — gamification streak dropped to 0

    Total: 0-100 scale
    Tiers: LOW (0-29), MEDIUM (30-59), HIGH (60-100)
    """
    from django.db.models import Sum, Count, Q
    from apps.analytics.models import EngagementEvent, StudentRiskScore
    from apps.assessments.models import Assessment, AssessmentAttempt
    from apps.content.models import Lesson, LessonProgress

    today = timezone.now().date()
    now = timezone.now()
    seven_days_ago = today - timedelta(days=7)
    fourteen_days_ago = today - timedelta(days=14)
    week_ago = now - timedelta(days=7)

    score = 0.0
    factors = {}

    # ── 1. Login recency (0-25 pts) ───────────────────────────────────────
    last_login = student.last_login
    if last_login:
        days_since = (now - last_login).days
        if days_since >= 7:
            score += 25.0
            factors["login_recency"] = f"{days_since} days since last login"
        elif days_since >= 5:
            score += 18.0
            factors["login_recency"] = f"{days_since} days since last login"
        elif days_since >= 3:
            score += 10.0
            factors["login_recency"] = f"{days_since} days since last login"
    else:
        score += 25.0
        factors["login_recency"] = "Never logged in"

    # ── 2. Engagement trend (0-20 pts) ────────────────────────────────────
    recent_secs = EngagementEvent.objects.filter(
        user=student, event_date__gte=seven_days_ago
    ).aggregate(total=Sum("duration_seconds"))["total"] or 0

    prior_secs = EngagementEvent.objects.filter(
        user=student,
        event_date__lt=seven_days_ago,
        event_date__gte=fourteen_days_ago,
    ).aggregate(total=Sum("duration_seconds"))["total"] or 0

    if prior_secs > 1800:  # had at least 30min last week
        if recent_secs == 0:
            score += 20.0
            factors["engagement_trend"] = f"Zero engagement (was {prior_secs // 60}min last week)"
        elif recent_secs < (prior_secs * 0.3):
            score += 15.0
            factors["engagement_trend"] = f"Dropped {100 - round(recent_secs / prior_secs * 100)}%"
        elif recent_secs < (prior_secs * 0.5):
            score += 10.0
            factors["engagement_trend"] = f"Dropped {100 - round(recent_secs / prior_secs * 100)}%"

    # ── 3. Assessment failures (0-15 pts) ─────────────────────────────────
    recent_attempts = AssessmentAttempt.objects.filter(
        user=student, submitted_at__gte=week_ago, submitted_at__isnull=False
    ).aggregate(
        total=Count("id"),
        failed=Count("id", filter=Q(passed=False)),
    )
    failed_count = recent_attempts["failed"] or 0
    total_attempts = recent_attempts["total"] or 0

    if failed_count > 0:
        if total_attempts > 0 and failed_count == total_attempts:
            score += 15.0
            factors["assessment_failures"] = f"Failed all {failed_count} attempts this week"
        elif failed_count >= 3:
            score += 12.0
            factors["assessment_failures"] = f"Failed {failed_count}/{total_attempts} attempts"
        else:
            score += 5.0 * min(failed_count, 3)
            factors["assessment_failures"] = f"Failed {failed_count} assessment(s)"

    # ── 4. Lesson completion rate (0-15 pts) ──────────────────────────────
    section = getattr(student, "section", None)
    grade = None
    if section:
        classroom = getattr(section, "classroom", None)
        if classroom:
            try:
                grade = int(classroom.name.strip())
                total_lessons = Lesson.objects.filter(
                    course__grade=grade, is_published=True
                ).count()
                if total_lessons > 0:
                    completed = LessonProgress.objects.filter(
                        user=student, completed=True,
                        lesson__course__grade=grade, lesson__is_published=True,
                    ).count()
                    pct = completed / total_lessons
                    if pct < 0.1:
                        score += 15.0
                        factors["lesson_completion"] = f"{round(pct * 100)}% ({completed}/{total_lessons})"
                    elif pct < 0.25:
                        score += 10.0
                        factors["lesson_completion"] = f"{round(pct * 100)}% ({completed}/{total_lessons})"
                    elif pct < 0.5:
                        score += 5.0
                        factors["lesson_completion"] = f"{round(pct * 100)}% completed"
            except (ValueError, AttributeError):
                pass

    # ── 5. Assessment avoidance (0-10 pts) ────────────────────────────────
    if grade:
        available = Assessment.objects.filter(
            course__grade=grade, is_published=True
        ).count()
        attempted = AssessmentAttempt.objects.filter(
            user=student,
            assessment__course__grade=grade,
            submitted_at__isnull=False,
        ).values("assessment_id").distinct().count()
        if available > 0:
            attempt_rate = attempted / available
            if attempt_rate < 0.2:
                score += 10.0
                factors["assessment_avoidance"] = f"Only attempted {attempted}/{available} assessments"
            elif attempt_rate < 0.5:
                score += 5.0
                factors["assessment_avoidance"] = f"Attempted {attempted}/{available} assessments"

    # ── 6. Live session absence (0-10 pts) ────────────────────────────────
    if section:
        try:
            from apps.livesessions.models import LiveSession, LiveSessionAttendance
            recent_sessions = LiveSession.objects.filter(
                section=section,
                ended_at__isnull=False,
                ended_at__gte=week_ago,
            ).count()
            if recent_sessions > 0:
                attended = LiveSessionAttendance.objects.filter(
                    user=student,
                    session__section=section,
                    session__ended_at__gte=week_ago,
                ).count()
                if attended == 0:
                    score += 10.0
                    factors["live_session_absence"] = f"Missed all {recent_sessions} live sessions"
                elif attended < recent_sessions * 0.5:
                    score += 5.0
                    factors["live_session_absence"] = f"Attended {attended}/{recent_sessions} sessions"
        except (ImportError, Exception):
            pass

    # ── 7. Streak broken (0-5 pts) ────────────────────────────────────────
    try:
        from apps.gamification.models import StudentStreak
        streak = StudentStreak.objects.filter(user=student).first()
        if streak and streak.current_streak == 0 and streak.longest_streak >= 3:
            score += 5.0
            factors["streak_broken"] = f"Streak dropped to 0 (was {streak.longest_streak})"
    except Exception:
        pass

    # ── Final ─────────────────────────────────────────────────────────────
    score = min(score, 100.0)

    if score >= 60.0:
        risk_level = StudentRiskScore.RiskLevel.HIGH
    elif score >= 30.0:
        risk_level = StudentRiskScore.RiskLevel.MEDIUM
    else:
        risk_level = StudentRiskScore.RiskLevel.LOW

    factors["total_score"] = round(score, 1)
    factors["signals_triggered"] = len(
        [k for k in factors if k not in ("total_score", "signals_triggered")]
    )

    return score, risk_level, factors


def _notify_teachers_high_risk(student, factors: dict) -> None:
    """Send in-app notification to all teachers of the student's section."""
    try:
        from apps.notifications.models import Notification, NotificationType

        section = getattr(student, "section", None)
        if not section:
            return

        teacher_ids = list(
            section.teaching_assignments.values_list("teacher_id", flat=True)
        )
        if not teacher_ids:
            return

        student_name = student.get_full_name() or student.username
        reason_parts = []
        if factors.get("login_recency"):
            reason_parts.append(factors["login_recency"])
        if factors.get("engagement_trend"):
            reason_parts.append(f"engagement {factors['engagement_trend'].lower()}")
        if factors.get("assessment_failures"):
            reason_parts.append(factors["assessment_failures"].lower())
        if factors.get("lesson_completion"):
            reason_parts.append(f"lesson progress {factors['lesson_completion']}")
        if factors.get("assessment_avoidance"):
            reason_parts.append(factors["assessment_avoidance"].lower())
        if factors.get("live_session_absence"):
            reason_parts.append(factors["live_session_absence"].lower())
        if factors.get("streak_broken"):
            reason_parts.append(factors["streak_broken"].lower())
        reason = ", ".join(reason_parts[:3]) or "multiple risk factors"

        subject = f"\u26a0\ufe0f Student At Risk: {student_name}"
        message = (
            f"{student_name} is at HIGH risk \u2014 {reason}. "
            f"Consider reaching out or suggesting remedial content."
        )
        link = f"/analytics/class/{section.classroom_id}/student/{student.id}/"

        notifs = [
            Notification(
                user_id=tid,
                subject=subject,
                message=message,
                notification_type=NotificationType.WARNING,
                link=link,
            )
            for tid in teacher_ids
        ]
        Notification.objects.bulk_create(notifs, ignore_conflicts=True)
        logger.info("At-risk alert: student=%s teachers=%s", student.id, teacher_ids)
    except Exception as exc:
        logger.warning("Failed to send at-risk notification for student %s: %s", student.id, exc)


@receiver(post_save, sender="assessments.AssessmentAttempt")
def on_attempt_submitted(sender, instance, created, **kwargs):
    """Recalculate risk when assessment attempt is submitted."""
    if not instance.submitted_at:
        return

    student = instance.user
    if getattr(student, "role", None) != "STUDENT":
        return

    try:
        from apps.analytics.models import StudentRiskScore

        score, risk_level, factors = _recalculate_risk(student)

        prev = StudentRiskScore.objects.filter(user=student).first()
        prev_level = prev.risk_level if prev else StudentRiskScore.RiskLevel.LOW

        StudentRiskScore.objects.update_or_create(
            user=student,
            defaults={"score": score, "risk_level": risk_level, "factors": factors},
        )

        from django.core.cache import cache as _cache
        _cache.delete(f"analytics:risk:{student.id}")

        if (
            risk_level == StudentRiskScore.RiskLevel.HIGH
            and prev_level != StudentRiskScore.RiskLevel.HIGH
        ):
            _notify_teachers_high_risk(student, factors)

    except Exception as exc:
        logger.warning("Risk score update failed for student %s: %s", student.id, exc)
