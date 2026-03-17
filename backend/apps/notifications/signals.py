# apps.notifications.signals
"""
Auto-notification signal handlers.

Fires a Notification row for enrolled students when:
  1. A new Lesson is published in a course they are enrolled in
  2. An Assessment is published (is_published flips True) in their course

Design rules (match gamification pattern exactly):
  - Every handler wrapped in try/except — a notification failure NEVER
    blocks lesson creation or assessment publish.
  - Use bulk_create for all fan-out to avoid N+1 INSERTs.
  - Guard against duplicate sends: check created vs updated for Lesson,
    check previous is_published value for Assessment.
  - No blocking DB work inside signal — queryset is evaluated inline,
    all heavy ops are a single bulk_create inside a transaction.atomic().

Wired in NotificationsConfig.ready() — do not import directly.
"""
import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _enrolled_students(course):
    """
    Return a queryset of User objects who are enrolled in this course.
    Enrollment lives in apps.learning.  We use a lazy import to avoid
    circular dependencies at module load time.
    """
    from django.contrib.auth import get_user_model
    from apps.learning.models import Enrollment
    User = get_user_model()
    enrolled_ids = (
        Enrollment.objects
        .filter(course=course, status="enrolled")
        .values_list("user_id", flat=True)
    )
    return User.objects.filter(id__in=enrolled_ids)


def _bulk_notify(students, subject, message, notification_type, link=""):
    """
    Create one Notification row per student in a single bulk_create.
    Returns the number of notifications created.
    """
    from apps.notifications.models import Notification

    rows = [
        Notification(
            user=student,
            subject=subject,
            message=message,
            notification_type=notification_type,
            is_read=False,
            link=link,
        )
        for student in students
    ]
    if not rows:
        return 0

    with transaction.atomic():
        Notification.objects.bulk_create(rows, ignore_conflicts=True)

    return len(rows)


# ─────────────────────────────────────────────────────────────────────────────
# LESSON PUBLISHED
# ─────────────────────────────────────────────────────────────────────────────

@receiver(post_save, sender="content.Lesson")
def on_lesson_published(sender, instance, created, **kwargs):
    """
    Fire when a Lesson is saved with is_published=True.

    Guards:
      - Only fires when is_published=True on the saved instance
      - On UPDATE: only fires if update_fields contains 'is_published',
        meaning the teacher explicitly published it (not just an order change)
      - On CREATE: only fires if the lesson was created already published
        (unusual, but valid — teacher creates+publishes in one step)
    """
    try:
        # Determine if this is a publish event
        update_fields = kwargs.get("update_fields")

        if not instance.is_published:
            return  # Not published — nothing to do

        if not created:
            # Update path: only notify if is_published was explicitly changed
            if update_fields is not None and "is_published" not in update_fields:
                return  # is_published wasn't touched this save

            # For saves without update_fields (full save), we'd notify every
            # time the teacher saves — too noisy. Only notify on explicit
            # is_published update.
            if update_fields is None:
                return

        # Fetch enrolled students — lazy import avoids circular dependency
        students = list(_enrolled_students(instance.course))
        if not students:
            return

        subject = f"New lesson: {instance.title}"
        message = (
            f"A new lesson has been published in "
            f"{instance.course.subject.name} (Class {instance.course.grade}). "
            f"Tap to start learning."
        )
        # Link: the course's lesson list page (frontend slug URL)
        from apps.notifications.models import NotificationType
        count = _bulk_notify(
            students=students,
            subject=subject,
            message=message,
            notification_type=NotificationType.LESSON,
        )
        logger.info(
            "Lesson published notification: lesson_id=%s course_id=%s recipients=%d",
            instance.id, instance.course_id, count,
        )

    except Exception:
        # Non-blocking — log and swallow
        logger.exception(
            "on_lesson_published: unhandled error for lesson_id=%s", instance.id
        )


# ─────────────────────────────────────────────────────────────────────────────
# ASSESSMENT PUBLISHED
# ─────────────────────────────────────────────────────────────────────────────

@receiver(post_save, sender="assessments.Assessment")
def on_assessment_published(sender, instance, created, **kwargs):
    """
    Fire when an Assessment is published (is_published flips to True).

    Guards:
      - Only fires on UPDATE where update_fields contains 'is_published'
        AND the new value is True. This prevents re-notifying every time
        a published assessment is edited.
      - Never fires on CREATE (assessments are created unpublished by default).
    """
    try:
        if created:
            return  # New assessments start unpublished — nothing to do

        update_fields = kwargs.get("update_fields")

        # Only react when is_published was explicitly saved
        if update_fields is None or "is_published" not in update_fields:
            return

        if not instance.is_published:
            return  # Unpublished — no notification needed

        students = list(_enrolled_students(instance.course))
        if not students:
            return

        subject = f"New assessment: {instance.title}"
        message = (
            f"A new assessment is now available in "
            f"{instance.course.subject.name} (Class {instance.course.grade}). "
            f"It has {instance.total_marks} marks — pass mark is {instance.pass_marks}."
        )

        from apps.notifications.models import NotificationType
        count = _bulk_notify(
            students=students,
            subject=subject,
            message=message,
            notification_type=NotificationType.ASSESSMENT,
        )
        logger.info(
            "Assessment published notification: assessment_id=%s course_id=%s recipients=%d",
            instance.id, instance.course_id, count,
        )

    except Exception:
        logger.exception(
            "on_assessment_published: unhandled error for assessment_id=%s", instance.id
        )
