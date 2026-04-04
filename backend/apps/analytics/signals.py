"""
apps.analytics.signals
Real-time student risk intervention.

Flow:
  AssessmentAttempt.submitted_at is set  →  post_save fires
  → _recalculate_risk_for_student(student)
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
    Inline risk calculation for a single student.
    Same logic as calculate_risk_scores management command.
    Returns (score, risk_level, factors).
    """
    from django.db.models import Sum
    from apps.analytics.models import EngagementEvent, EventType, StudentRiskScore
    from apps.assessments.models import AssessmentAttempt

    today = timezone.now().date()
    seven_days_ago  = today - timedelta(days=7)
    fourteen_days_ago = today - timedelta(days=14)

    score   = 0.0
    factors = {}

    # 1. No login for 3+ days
    recent_logins = EngagementEvent.objects.filter(
        user=student,
        event_type=EventType.LOGIN,
        event_date__gte=today - timedelta(days=3),
    ).count()
    if recent_logins == 0:
        score += 30.0
        factors["streak_broken"] = True
        factors["days_since_login"] = "3+"

    # 2. Engagement drop (week-over-week)
    recent_secs = EngagementEvent.objects.filter(
        user=student, event_date__gte=seven_days_ago
    ).aggregate(total=Sum("duration_seconds"))["total"] or 0

    prior_secs = EngagementEvent.objects.filter(
        user=student,
        event_date__lt=seven_days_ago,
        event_date__gte=fourteen_days_ago,
    ).aggregate(total=Sum("duration_seconds"))["total"] or 0

    if prior_secs > 3600 and recent_secs < (prior_secs * 0.5):
        score += 25.0
        factors["engagement_drop"] = f"Dropped from {prior_secs//60}m to {recent_secs//60}m"

    # 3. Failed assessments this week — aggregate, not ORM iteration
    from django.db.models import Count as _Count
    week_ago = timezone.now() - timedelta(days=7)
    attempt_agg = AssessmentAttempt.objects.filter(
        user=student, submitted_at__gte=week_ago, submitted_at__isnull=False
    ).aggregate(
        failed=_Count("id", filter=models.Q(passed=False))
    )
    failed_count = attempt_agg["failed"] or 0
    if failed_count > 0:
        score += 15.0 * min(failed_count, 3)
        factors["recent_failures"] = failed_count

    score = min(score, 100.0)

    if score >= 60.0:
        risk_level = StudentRiskScore.RiskLevel.HIGH
    elif score >= 30.0:
        risk_level = StudentRiskScore.RiskLevel.MEDIUM
    else:
        risk_level = StudentRiskScore.RiskLevel.LOW

    return score, risk_level, factors


def _notify_teachers_high_risk(student, factors: dict) -> None:
    """Send in-app notification to all teachers of the student's section via bulk_create."""
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
        if factors.get("streak_broken"):
            reason_parts.append("missed 3+ days")
        if factors.get("engagement_drop"):
            reason_parts.append("engagement dropped")
        if factors.get("recent_failures"):
            n = factors["recent_failures"]
            reason_parts.append(f"failed {n} assessment{'s' if n > 1 else ''}")
        reason = ", ".join(reason_parts) or "multiple risk factors"

        subject = f"\u26a0\ufe0f Student At Risk: {student_name}"
        message = (
            f"{student_name} is at HIGH risk \u2014 {reason}. "
            f"Consider reaching out or suggesting remedial content."
        )
        link = f"/analytics/class/{section.classroom_id}/student/{student.id}/"

        # bulk_create — 1 INSERT instead of N
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
        logger.info(
            "At-risk alert sent: student=%s teachers=%s factors=%s",
            student.id, teacher_ids, factors,
        )
    except Exception as exc:  # never crash the submission response
        logger.warning("Failed to send at-risk notification for student %s: %s", student.id, exc)


@receiver(post_save, sender="assessments.AssessmentAttempt")
def on_attempt_submitted(sender, instance, created, **kwargs):
    """
    Fires after every AssessmentAttempt save.
    Only acts when the attempt transitions to submitted (submitted_at just set).
    """
    if not instance.submitted_at:
        return  # still in-progress

    student = instance.user
    if getattr(student, "role", None) != "STUDENT":
        return

    try:
        from apps.analytics.models import StudentRiskScore

        # Recalculate
        score, risk_level, factors = _recalculate_risk(student)

        prev = StudentRiskScore.objects.filter(user=student).first()
        prev_level = prev.risk_level if prev else StudentRiskScore.RiskLevel.LOW

        risk_obj, _ = StudentRiskScore.objects.update_or_create(
            user=student,
            defaults={"score": score, "risk_level": risk_level, "factors": factors},
        )

        # Bust cached risk score so my-risk/ returns fresh data immediately
        from django.core.cache import cache as _cache
        _cache.delete(f"analytics:risk:{student.id}")

        # Notify teachers only when crossing INTO high (avoid repeat spam)
        if (
            risk_level == StudentRiskScore.RiskLevel.HIGH
            and prev_level != StudentRiskScore.RiskLevel.HIGH
        ):
            _notify_teachers_high_risk(student, factors)

    except Exception as exc:
        logger.warning("Risk score update failed for student %s: %s", student.id, exc)
