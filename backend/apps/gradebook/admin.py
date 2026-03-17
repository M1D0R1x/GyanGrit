from django.contrib import admin
from .models import GradeEntry


@admin.register(GradeEntry)
class GradeEntryAdmin(admin.ModelAdmin):
    list_display  = ("student", "subject", "term", "category", "marks", "total_marks", "entered_by", "entered_at")
    list_filter   = ("term", "category", "subject")
    search_fields = ("student__username", "subject__name", "entered_by__username")
    raw_id_fields = ("student", "subject", "entered_by")
    ordering      = ("-entered_at",)
