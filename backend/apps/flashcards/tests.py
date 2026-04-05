# apps/flashcards/tests.py
"""Flashcards — verified URLs: /api/v1/flashcards/decks/, /study/"""
import pytest


@pytest.mark.django_db
class TestFlashcardDecks:
    def test_teacher_decks(self, teacher_client):
        resp = teacher_client.get("/api/v1/flashcards/decks/")
        assert resp.status_code == 200

    def test_student_decks_blocked(self, student_client):
        """Student uses /study/ not /decks/."""
        resp = student_client.get("/api/v1/flashcards/decks/")
        assert resp.status_code == 403

    def test_student_study(self, student_client):
        resp = student_client.get("/api/v1/flashcards/study/")
        assert resp.status_code == 200

    def test_anon_blocked(self, anon_client):
        resp = anon_client.get("/api/v1/flashcards/study/")
        assert resp.status_code in (401, 403)
