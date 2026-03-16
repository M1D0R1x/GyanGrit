# apps.notifications.api.v1.urls
from django.urls import path
from apps.notifications import views

urlpatterns = [
    # ── Inbox (all authenticated users) ──────────────────────────────────────
    path("",               views.list_notifications),
    path("<int:notification_id>/read/", views.mark_read),
    path("read-all/",      views.mark_all_read),

    # ── Send + history (staff roles only) ────────────────────────────────────
    path("send/",          views.send_notification),
    path("sent/",          views.sent_history),
    path("sent/<int:broadcast_id>/", views.broadcast_detail),

    # ── Audience options dropdown data ───────────────────────────────────────
    path("audience-options/", views.audience_options),
]