from django.contrib import admin
from .models import JoinCode


@admin.register(JoinCode)
class JoinCodeAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "role",
        "district",
        "institution",
        "section",
        "is_used",
        "expires_at",
    )
    list_filter = ("role", "is_used")


from django.contrib import admin

# Register your models here.
