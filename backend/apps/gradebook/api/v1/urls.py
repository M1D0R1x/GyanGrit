"""
gradebook/api/v1/urls.py
Mounted at: /api/v1/gradebook/
"""
from django.urls import path
from apps.gradebook import views

urlpatterns = [
    # Choices dropdown (GET)
    path("choices/",                    views.choices),

    # Entry CRUD
    path("entry/",                      views.create_entry),
    path("entry/<int:entry_id>/",       views.update_entry),
    path("entry/<int:entry_id>/delete/", views.delete_entry),

    # Read views
    path("student/<int:student_id>/",   views.student_grades),
    path("class/<int:class_id>/",       views.class_grades),
]
