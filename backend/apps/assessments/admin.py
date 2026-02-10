from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Assessment, Question, Choice, Attempt, Response


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 2


class QuestionAdmin(admin.ModelAdmin):
    inlines = [ChoiceInline]
    list_display = ("text", "assessment", "order", "marks")
    ordering = ("assessment", "order")


admin.site.register(Assessment)
admin.site.register(Question, QuestionAdmin)
admin.site.register(Attempt)
admin.site.register(Response)
