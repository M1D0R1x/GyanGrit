from django.urls import path
from apps.roster import views

urlpatterns = [
    path("upload/", views.upload_roster),
    path("regenerate-code/", views.regenerate_code),
    path("records/", views.list_records),
]