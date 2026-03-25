# apps.notifications.api.v1.urls
from django.urls import path
from apps.notifications import views

urlpatterns = [
    # ── Inbox — all authenticated users ──────────────────────────────────────
    path("",                          views.list_notifications),    # quick panel (20 items)
    path("history/",                  views.notification_history),  # full searchable archive
    path("<int:notification_id>/read/", views.mark_read),
    path("read-all/",                 views.mark_all_read),

    # ── Send + history — staff roles only ────────────────────────────────────
    path("send/",                     views.send_notification),
    path("sent/",                     views.sent_history),
    path("sent/<int:broadcast_id>/",  views.broadcast_detail),

    # ── Audience options dropdown ─────────────────────────────────────────────
    path("audience-options/",         views.audience_options),

    # ── Push notifications ────────────────────────────────────────────────────
    path("push/subscribe/",           views.push_subscribe),
    path("push/unsubscribe/",         views.push_unsubscribe),
    path("push/vapid-key/",           views.vapid_public_key),
]
