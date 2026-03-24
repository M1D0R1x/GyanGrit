from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from .models import FlashcardDeck, Flashcard, FlashcardProgress


@admin.register(FlashcardDeck)
class FlashcardDeckAdmin(UnfoldModelAdmin):
    list_display  = ("title", "subject", "section", "created_by", "is_published", "card_count", "created_at")
    list_filter   = ("is_published", "subject")
    search_fields = ("title", "created_by__username")
    raw_id_fields = ("created_by",)


@admin.register(Flashcard)
class FlashcardAdmin(UnfoldModelAdmin):
    list_display  = ("front_preview", "deck", "order")
    search_fields = ("front", "back")
    raw_id_fields = ("deck",)

    def front_preview(self, obj):
        return obj.front[:60]
    front_preview.short_description = "Front"


@admin.register(FlashcardProgress)
class FlashcardProgressAdmin(UnfoldModelAdmin):
    list_display  = ("student", "card", "repetitions", "ease_factor", "interval", "next_review", "total_reviews")
    list_filter   = ("next_review",)
    search_fields = ("student__username",)
    raw_id_fields = ("student", "card")
