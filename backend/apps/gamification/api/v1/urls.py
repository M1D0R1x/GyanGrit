# apps.gamification.api.v1.urls
from django.urls import path
from apps.gamification import views

urlpatterns = [
    path("me/",                   views.my_summary),
    path("leaderboard/class/",    views.leaderboard_class),
    path("leaderboard/school/",   views.leaderboard_school),
]