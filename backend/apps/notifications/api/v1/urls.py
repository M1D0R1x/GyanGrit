from django.urls import path
from apps.notifications import views

urlpatterns = [
    path("",               views.list_notifications),
    path("read-all/",      views.mark_all_read),
    path("<int:notification_id>/read/", views.mark_read),
]