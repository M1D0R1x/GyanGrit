# apps.flashcards.models
"""
Spaced-repetition flashcard system for GyanGrit.

Models:
  FlashcardDeck   — teacher creates a deck for a subject (optionally scoped to a section)
  Flashcard       — individual card with front (question) and back (answer)
  FlashcardProgress — per-student SM-2 state for each card

SM-2 algorithm (same as Anki):
  Student rates each card 0-3 after seeing the answer:
    0 = Complete blackout (show again today)
    1 = Incorrect (show again today)
    2 = Correct with difficulty (interval × ease_factor, lower ease)
    3 = Correct easily (interval × ease_factor, higher ease)

  next_review is set by the algorithm after each rating.
  Cards with next_review <= today are "due" and shown to the student.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone
import datetime


class FlashcardDeck(models.Model):

    class Status(models.TextChoices):
        DRAFT     = "draft",     "Draft"
        PUBLISHED = "published", "Published"

    title       = models.CharField(max_length=200, db_index=True)
    description = models.TextField(blank=True)
    subject     = models.ForeignKey(
        "academics.Subject", on_delete=models.CASCADE,
        related_name="flashcard_decks",
    )
    # Optional: scope deck to a specific section. Null = visible to all sections of this subject.
    section     = models.ForeignKey(
        "academics.Section", on_delete=models.CASCADE,
        null=True, blank=True, related_name="flashcard_decks",
    )
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="created_flashcard_decks",
    )
    is_published = models.BooleanField(default=False, db_index=True)

    # Draft/Published workflow (replaces is_published for new code — kept for backwards compat)
    status       = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.PUBLISHED,   # existing decks default to published
        db_index=True,
    )

    # AI generation metadata
    ai_generated  = models.BooleanField(default=False)
    source_lesson = models.ForeignKey(
        "content.Lesson",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="generated_flashcard_decks",
    )

    created_at   = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["subject", "is_published"]),
            models.Index(fields=["section", "is_published"]),
            models.Index(fields=["subject", "status"]),
        ]

    def save(self, *args, **kwargs):
        # Keep is_published in sync with status for any code still using it
        self.is_published = (self.status == self.Status.PUBLISHED)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.subject.name})"

    @property
    def card_count(self) -> int:
        return self.cards.count()


class Flashcard(models.Model):
    deck       = models.ForeignKey(
        FlashcardDeck, on_delete=models.CASCADE, related_name="cards",
    )
    front      = models.TextField()                 # question / term
    back       = models.TextField()                 # answer / definition
    hint       = models.CharField(max_length=300, blank=True)
    order      = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["order", "id"]
        indexes  = [models.Index(fields=["deck", "order"])]

    def __str__(self):
        return f"{self.front[:60]}"


class FlashcardProgress(models.Model):
    """
    SM-2 state per student per card.
    Created on first review, updated on every subsequent review.
    """
    student     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="flashcard_progress",
    )
    card        = models.ForeignKey(
        Flashcard, on_delete=models.CASCADE, related_name="progress",
    )

    # SM-2 state
    repetitions  = models.PositiveIntegerField(default=0)
    ease_factor  = models.FloatField(default=2.5)      # starts at 2.5, min 1.3
    interval     = models.PositiveIntegerField(default=1)   # days until next review
    next_review  = models.DateField(default=datetime.date.today, db_index=True)

    # Stats
    total_reviews = models.PositiveIntegerField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    last_reviewed = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("student", "card")
        indexes = [
            models.Index(fields=["student", "next_review"]),
            models.Index(fields=["student", "card"]),
        ]

    def __str__(self):
        return f"{self.student.username} — {self.card.front[:40]}"

    def apply_rating(self, quality: int) -> None:
        """
        Apply SM-2 algorithm with quality rating 0-3.
        Updates repetitions, ease_factor, interval, next_review.
        """
        quality = max(0, min(3, quality))
        self.total_reviews += 1
        self.last_reviewed = timezone.now()

        if quality < 2:
            # Incorrect — reset repetitions, show again in 1 day
            self.repetitions = 0
            self.interval    = 1
        else:
            self.correct_count += 1
            if self.repetitions == 0:
                self.interval = 1
            elif self.repetitions == 1:
                self.interval = 3
            else:
                self.interval = round(self.interval * self.ease_factor)
            self.repetitions += 1

        # Update ease factor: EF' = EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))
        self.ease_factor = max(
            1.3,
            self.ease_factor + 0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02),
        )
        self.next_review = datetime.date.today() + datetime.timedelta(days=self.interval)
        self.save()
