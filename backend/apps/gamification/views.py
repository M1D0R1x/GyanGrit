# apps.gamification.views
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import F
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.gamification.models import (
    BadgeCode,
    StudentBadge,
    StudentPoints,
    StudentStreak,
)

User = get_user_model()
logger = logging.getLogger(__name__)

# Badge display metadata — label + emoji for frontend rendering
BADGE_META: dict[str, dict] = {
    BadgeCode.FIRST_LESSON:  {"label": "First Lesson",         "emoji": "📖"},
    BadgeCode.LESSON_10:     {"label": "10 Lessons",           "emoji": "🔟"},
    BadgeCode.LESSON_50:     {"label": "50 Lessons",           "emoji": "🏆"},
    BadgeCode.FIRST_PASS:    {"label": "First Pass",           "emoji": "✅"},
    BadgeCode.PERFECT_SCORE: {"label": "Perfect Score",        "emoji": "💯"},
    BadgeCode.STREAK_3:      {"label": "3-Day Streak",         "emoji": "🔥"},
    BadgeCode.STREAK_7:      {"label": "7-Day Streak",         "emoji": "⚡"},
    BadgeCode.POINTS_100:    {"label": "100 Points",           "emoji": "💎"},
    BadgeCode.POINTS_500:    {"label": "500 Points",           "emoji": "👑"},
}


def _get_student_summary(user) -> dict:
    """Return points, badges, and streak for a student."""
    try:
        summary = StudentPoints.objects.get(user=user)
        total_points = summary.total_points
    except StudentPoints.DoesNotExist:
        total_points = 0

    try:
        streak = StudentStreak.objects.get(user=user)
        current_streak = streak.current_streak
        longest_streak = streak.longest_streak
    except StudentStreak.DoesNotExist:
        current_streak = 0
        longest_streak = 0

    badges = [
        {
            "code":      b.badge_code,
            "label":     BADGE_META.get(b.badge_code, {}).get("label", b.badge_code),
            "emoji":     BADGE_META.get(b.badge_code, {}).get("emoji", "🏅"),
            "earned_at": b.earned_at.isoformat(),
        }
        for b in StudentBadge.objects.filter(user=user).order_by("earned_at")
    ]

    return {
        "total_points":   total_points,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "badge_count":    len(badges),
        "badges":         badges,
    }


def _build_leaderboard(queryset, requesting_user) -> list[dict]:
    """
    Build a ranked leaderboard from a StudentPoints queryset.
    Injects the requesting user's entry even if outside top 20.
    """
    top = list(
        queryset
        .select_related("user")
        .order_by("-total_points")[:20]
    )

    entries = []
    user_in_top = False

    for rank, sp in enumerate(top, start=1):
        is_me = sp.user_id == requesting_user.id
        if is_me:
            user_in_top = True
        entries.append({
            "rank":         rank,
            "user_id":      sp.user_id,
            "display_name": sp.user.username,
            "total_points": sp.total_points,
            "is_me":        is_me,
        })

    # If requesting user isn't in top 20, append their entry at the bottom
    if not user_in_top:
        try:
            my_sp = queryset.get(user=requesting_user)
            # Calculate rank by counting users with more points
            my_rank = queryset.filter(
                total_points__gt=my_sp.total_points
            ).count() + 1
            entries.append({
                "rank":         my_rank,
                "user_id":      requesting_user.id,
                "display_name": requesting_user.username,
                "total_points": my_sp.total_points,
                "is_me":        True,
            })
        except StudentPoints.DoesNotExist:
            # User has no points yet — append with 0
            my_rank = queryset.count() + 1
            entries.append({
                "rank":         my_rank,
                "user_id":      requesting_user.id,
                "display_name": requesting_user.username,
                "total_points": 0,
                "is_me":        True,
            })

    return entries


@login_required
@require_http_methods(["GET"])
def my_summary(request):
    """
    GET /api/v1/gamification/me/
    Returns the student's points, streak, badges, and rank in their class.
    """
    user = request.user

    if user.role != "STUDENT":
        return JsonResponse({"detail": "Forbidden"}, status=403)

    data = _get_student_summary(user)

    # Inject class rank
    if user.section and user.section.classroom:
        class_student_ids = User.objects.filter(
            role="STUDENT", section__classroom=user.section.classroom
        ).values_list("id", flat=True)

        try:
            my_sp = StudentPoints.objects.get(user=user)
            rank = StudentPoints.objects.filter(
                user_id__in=class_student_ids,
                total_points__gt=my_sp.total_points,
            ).count() + 1
        except StudentPoints.DoesNotExist:
            rank = User.objects.filter(
                id__in=class_student_ids, role="STUDENT"
            ).count()

        data["class_rank"] = rank
    else:
        data["class_rank"] = None

    return JsonResponse(data)


@login_required
@require_http_methods(["GET"])
def leaderboard_class(request):
    """
    GET /api/v1/gamification/leaderboard/class/
    Returns top 20 students in the requesting student's class.
    Also injects the requesting student's rank if outside top 20.
    TEACHER/PRINCIPAL/OFFICIAL/ADMIN can pass ?class_id= to view any class.
    """
    user = request.user

    if user.role == "STUDENT":
        if not user.section or not user.section.classroom:
            return JsonResponse({"detail": "No class assigned"}, status=400)
        classroom = user.section.classroom

    elif user.role in ["TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"]:
        class_id = request.GET.get("class_id")
        if not class_id:
            return JsonResponse({"detail": "class_id is required"}, status=400)
        from apps.academics.models import ClassRoom
        try:
            classroom = ClassRoom.objects.get(id=class_id)
        except ClassRoom.DoesNotExist:
            return JsonResponse({"detail": "Class not found"}, status=404)

    else:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    student_ids = User.objects.filter(
        role="STUDENT", section__classroom=classroom
    ).values_list("id", flat=True)

    qs = StudentPoints.objects.filter(user_id__in=student_ids)

    if user.role == "STUDENT":
        entries = _build_leaderboard(qs, user)
    else:
        entries = list(
            qs.select_related("user")
            .order_by("-total_points")[:20]
            .values(
                rank=F("id"),  # placeholder — real rank set below
                user_id=F("user_id"),
                display_name=F("user__username"),
                total_points=F("total_points"),
            )
        )
        for i, e in enumerate(entries, start=1):
            e["rank"] = i
            e["is_me"] = False

    return JsonResponse({
        "class_id":   classroom.id,
        "class_name": classroom.name,
        "entries":    entries,
    })


@login_required
@require_http_methods(["GET"])
def leaderboard_school(request):
    """
    GET /api/v1/gamification/leaderboard/school/
    Returns top 20 students in the requesting student's school.
    TEACHER/PRINCIPAL/OFFICIAL/ADMIN can pass ?institution_id= to view any school.
    """
    user = request.user

    if user.role == "STUDENT":
        if not user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        institution = user.institution

    elif user.role in ["TEACHER", "PRINCIPAL"]:
        if not user.institution:
            return JsonResponse({"detail": "No institution assigned"}, status=400)
        institution = user.institution

    elif user.role in ["OFFICIAL", "ADMIN"]:
        institution_id = request.GET.get("institution_id")
        if not institution_id:
            return JsonResponse({"detail": "institution_id is required"}, status=400)
        from apps.academics.models import Institution
        try:
            institution = Institution.objects.get(id=institution_id)
        except Institution.DoesNotExist:
            return JsonResponse({"detail": "Institution not found"}, status=404)

    else:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # institution is either a string (denormalised on User) or an Institution object
    if isinstance(institution, str):
        student_ids = User.objects.filter(
            role="STUDENT", institution__name=institution
        ).values_list("id", flat=True)
        institution_name = institution
    else:
        student_ids = User.objects.filter(
            role="STUDENT", institution=institution
        ).values_list("id", flat=True)
        institution_name = institution.name

    qs = StudentPoints.objects.filter(user_id__in=student_ids)

    if user.role == "STUDENT":
        entries = _build_leaderboard(qs, user)
    else:
        raw = list(
            qs.select_related("user")
            .order_by("-total_points")[:20]
        )
        entries = [
            {
                "rank":         i + 1,
                "user_id":      sp.user_id,
                "display_name": sp.user.username,
                "total_points": sp.total_points,
                "is_me":        False,
            }
            for i, sp in enumerate(raw)
        ]

    return JsonResponse({
        "institution_name": institution_name,
        "entries":          entries,
    })