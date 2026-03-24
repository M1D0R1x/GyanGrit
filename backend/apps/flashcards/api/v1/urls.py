"""
flashcards/api/v1/urls.py
Mounted at: /api/v1/flashcards/
"""
from django.urls import path
from apps.flashcards import views

urlpatterns = [
    # Teacher — deck management
    path("decks/",                                          views.deck_list_create),
    path("decks/<int:deck_id>/",                            views.deck_detail),
    path("decks/<int:deck_id>/cards/",                      views.card_create),
    path("decks/<int:deck_id>/cards/<int:card_id>/",        views.card_detail),

    # Student — study
    path("study/",                                          views.study_list),
    path("study/<int:deck_id>/due/",                        views.study_due),
    path("study/<int:deck_id>/review/",                     views.study_review),
    path("study/<int:deck_id>/stats/",                      views.study_stats),
]
