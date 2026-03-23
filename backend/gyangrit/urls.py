from django.contrib import admin
from django.urls import path, include
from apps.competitions.api.v1.urls import realtime_urlpatterns

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/v1/accounts/",      include("apps.accounts.api.v1.urls")),
    path("api/v1/academics/",     include("apps.academics.api.v1.urls")),
    path("api/v1/",               include("apps.content.api.v1.urls")),
    path("api/v1/learning/",      include("apps.learning.api.v1.urls")),
    path("api/v1/assessments/",   include("apps.assessments.api.v1.urls")),
    path("api/v1/roster/",        include("apps.roster.api.v1.urls")),
    path("api/v1/media/",         include("apps.media.api.v1.urls")),
    path("api/v1/notifications/", include("apps.notifications.api.v1.urls")),
    path("api/v1/gamification/",  include("apps.gamification.api.v1.urls")),
    path("api/v1/gradebook/",     include("apps.gradebook.api.v1.urls")),

    # Competition rooms
    path("api/v1/competitions/",  include("apps.competitions.api.v1.urls")),

    # Chat rooms
    path("api/v1/chat/",          include("apps.chatrooms.api.v1.urls")),

    # Ably real-time token vending
    path("api/v1/realtime/",      include((realtime_urlpatterns, "realtime"))),
]
