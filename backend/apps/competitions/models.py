# apps.competitions.models
"""
Competition Rooms — real-time quiz battles using Ably Pub/Sub.

Design:
- CompetitionRoom: one room per quiz event. Teacher creates it, links it to
  an existing Assessment (which supplies the questions).
- CompetitionParticipant: join record for each student. Stores score and rank.
- CompetitionAnswer: one row per student per question per attempt.
  `is_correct` is stored but NEVER sent to the client during an active room.

State machine: draft → active → finished
  draft    — created, not yet started; students can join (see lobby)
  active   — quiz is live; questions are broadcast via Ably
  finished — quiz ended; final leaderboard visible to all

Ably channel:  competition:{room.id}
  Events pushed by backend:
    room:started      — host triggered start; payload: { question_count }
    room:question     — next question; payload: { index, text, marks, options, time_limit_secs }
    room:scores       — live leaderboard update; payload: [{ username, score, rank }]
    room:finished     — quiz over; payload: final leaderboard
  Events sent by students (via Ably client):
    student:answer    — { question_id, option_id } — backend validates via REST
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class RoomStatus(models.TextChoices):
    DRAFT    = "draft",    "Draft"
    ACTIVE   = "active",   "Active"
    FINISHED = "finished", "Finished"


class CompetitionRoom(models.Model):
    title        = models.CharField(max_length=200, db_index=True)
    host         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hosted_competitions",
        limit_choices_to={"role__in": ["TEACHER", "PRINCIPAL", "ADMIN"]},
    )
    section      = models.ForeignKey(
        "academics.Section",
        on_delete=models.CASCADE,
        related_name="competition_rooms",
        help_text="Only students in this section can join.",
    )
    assessment   = models.ForeignKey(
        "assessments.Assessment",
        on_delete=models.CASCADE,
        related_name="competition_rooms",
        help_text="Questions are drawn from this assessment.",
    )
    status       = models.CharField(
        max_length=12,
        choices=RoomStatus.choices,
        default=RoomStatus.DRAFT,
        db_index=True,
    )
    scheduled_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Optional: when the room is scheduled to go live.",
    )
    started_at   = models.DateTimeField(null=True, blank=True)
    finished_at  = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["section", "status"]),
            models.Index(fields=["host",    "-created_at"]),
        ]

    def __str__(self):
        return f"{self.title} [{self.status}]"


class CompetitionParticipant(models.Model):
    room      = models.ForeignKey(
        CompetitionRoom,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    student   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="competition_participations",
        limit_choices_to={"role": "STUDENT"},
    )
    score     = models.IntegerField(default=0)
    rank      = models.PositiveIntegerField(null=True, blank=True)
    joined_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("room", "student")
        ordering        = ["rank", "-score"]
        indexes         = [models.Index(fields=["room", "-score"])]

    def __str__(self):
        return f"{self.student.username} in {self.room.title}"


class CompetitionAnswer(models.Model):
    """
    One answer row per student per question. is_correct NEVER sent to client
    during active room — same rule as assessments.
    """
    room        = models.ForeignKey(CompetitionRoom, on_delete=models.CASCADE, related_name="answers")
    student     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="competition_answers",
    )
    question    = models.ForeignKey(
        "assessments.Question",
        on_delete=models.CASCADE,
        related_name="competition_answers",
    )
    chosen_option = models.ForeignKey(
        "assessments.QuestionOption",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="competition_answers",
    )
    is_correct  = models.BooleanField(default=False)
    marks_earned = models.IntegerField(default=0)
    answered_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("room", "student", "question")
        indexes         = [models.Index(fields=["room", "student"])]
