"""
content/api/v1/urls.py

URL patterns for the content app.
Mounted at: /api/v1/ (root mount in gyangrit/urls.py)

Conventions:
- All views live in apps.content.views
- Section lesson endpoints use /lessons/section/ prefix
- No trailing slash inconsistency — Django enforces APPEND_SLASH
"""

from django.urls import path
from apps.content import views

urlpatterns = [
    # ── Health ────────────────────────────────────────────────────────────────
    path("health/", views.health),

    # ── Courses ───────────────────────────────────────────────────────────────
    path("courses/",                        views.courses),
    path("courses/create/",                 views.create_course),
    path("courses/<int:course_id>/",        views.update_course),
    path("courses/<int:course_id>/delete/", views.delete_course),

    # ── Course lessons (student + teacher unified list) ───────────────────────
    path("courses/<int:course_id>/lessons/",          views.course_lessons),
    path("courses/<int:course_id>/lessons/all/",      views.course_lessons_all),
    path("courses/<int:course_id>/lessons/create/",   views.create_lesson),

    # ── Section lessons (teacher/principal supplemental content) ─────────────
    path("courses/<int:course_id>/section-lessons/",  views.section_lesson_list_create),

    # ── Global lesson detail + CRUD ───────────────────────────────────────────
    path("lessons/<int:lesson_id>/",                  views.lesson_detail),
    path("lessons/<int:lesson_id>/update/",           views.update_lesson),
    path("lessons/<int:lesson_id>/delete/",           views.delete_lesson),
    path("lessons/<int:lesson_id>/progress/",         views.lesson_progress),
    path("lessons/<int:lesson_id>/notes/",            views.add_lesson_note),

    # ── Section lesson detail + CRUD ──────────────────────────────────────────
    path("lessons/section/<int:lesson_id>/",          views.section_lesson_detail),
    path("lessons/section/<int:lesson_id>/update/",   views.update_section_lesson),
    path("lessons/section/<int:lesson_id>/delete/",   views.delete_section_lesson),

    # ── Course progress ───────────────────────────────────────────────────────
    path("courses/<int:course_id>/progress/",         views.course_progress),

    # ── Teacher analytics ─────────────────────────────────────────────────────
    path("teacher/analytics/courses/",     views.teacher_course_analytics),
    path("teacher/analytics/lessons/",     views.teacher_lesson_analytics),
    path("teacher/analytics/classes/",     views.teacher_class_analytics),
    path("teacher/analytics/assessments/", views.teacher_assessment_analytics),
    path(
        "teacher/analytics/classes/<int:class_id>/students/",
        views.teacher_class_students,
    ),
    path(
        "teacher/analytics/classes/<int:class_id>/students/<int:student_id>/",
        views.teacher_student_assessments,
    ),
]