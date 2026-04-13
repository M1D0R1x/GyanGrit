# backend/apps/content/management/commands/generate_lesson_content.py
"""
Generate AI lesson content for empty lessons.

Usage:
  python manage.py generate_lesson_content          # dry-run (preview)
  python manage.py generate_lesson_content --apply   # write to DB
  python manage.py generate_lesson_content --course 50  # specific course only

Uses Groq (primary) → Together (fallback) → Gemini (last resort).
Same provider chain as AI chatbot.
"""
import logging
import time

from django.core.management.base import BaseCommand
from apps.content.models import Course, Lesson

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert curriculum writer for Indian government school students (grades 6-10, Punjab).
Write educational lesson content in clear, simple English appropriate for the grade level.
Use markdown formatting: headings, bullet points, bold for key terms.
Include:
- Learning objectives at the top
- Main explanation with examples
- Key terms/definitions
- 2-3 practice questions at the end
Keep it concise (300-500 words). Make it engaging for rural students."""


def generate_content(subject: str, grade: int, title: str, order: int) -> str:
    """Try Groq → Together → Gemini. Return markdown content."""
    prompt = f"Write a lesson for Grade {grade} {subject}.\nLesson {order}: {title}\n\nWrite the full lesson content."

    # Try Groq first
    try:
        return _call_groq(prompt)
    except Exception as e:
        logger.warning("Groq failed: %s", e)

    # Try Together
    try:
        return _call_together(prompt)
    except Exception as e:
        logger.warning("Together failed: %s", e)

    # Try Gemini
    try:
        return _call_gemini(prompt)
    except Exception as e:
        logger.warning("Gemini failed: %s", e)

    return ""


def _call_groq(prompt: str) -> str:
    import os, requests
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise ValueError("GROQ_API_KEY not set")
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 1500,
            "temperature": 0.7,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_together(prompt: str) -> str:
    import os, requests
    key = os.environ.get("TOGETHER_API_KEY", "")
    if not key:
        raise ValueError("TOGETHER_API_KEY not set")
    resp = requests.post(
        "https://api.together.xyz/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 1500,
            "temperature": 0.7,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_gemini(prompt: str) -> str:
    import os, requests
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise ValueError("GEMINI_API_KEY not set")
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\n\n{prompt}"}]}],
            "generationConfig": {"maxOutputTokens": 1500, "temperature": 0.7},
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


class Command(BaseCommand):
    help = "Generate AI content for empty lessons"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write to DB (default: dry-run)")
        parser.add_argument("--course", type=int, help="Only process this course ID")
        parser.add_argument("--delay", type=float, default=2.0, help="Seconds between API calls (rate limit)")

    def handle(self, *args, **options):
        apply = options["apply"]
        course_filter = options["course"]
        delay = options["delay"]

        qs = Lesson.objects.select_related("course__subject").filter(
            is_published=True
        ).order_by("course__grade", "course__subject__name", "order")

        if course_filter:
            qs = qs.filter(course_id=course_filter)

        # Only empty lessons
        empty = [l for l in qs if not l.content or not l.content.strip()]

        self.stdout.write(f"Found {len(empty)} empty lessons out of {qs.count()} total published.\n")

        if not empty:
            self.stdout.write(self.style.SUCCESS("All lessons have content!"))
            return

        generated = 0
        failed = 0

        for lesson in empty:
            subject = lesson.course.subject.name
            grade = lesson.course.grade
            title = lesson.title
            order = lesson.order

            self.stdout.write(f"  [{grade}] {subject} — Lesson {order}: {title}... ", ending="")

            if not apply:
                self.stdout.write(self.style.WARNING("SKIP (dry-run)"))
                continue

            content = generate_content(subject, grade, title, order)
            if content:
                lesson.content = content
                lesson.save(update_fields=["content"])
                generated += 1
                self.stdout.write(self.style.SUCCESS(f"OK ({len(content)} chars)"))
            else:
                failed += 1
                self.stdout.write(self.style.ERROR("FAILED"))

            time.sleep(delay)  # rate limit

        self.stdout.write(f"\nDone. Generated: {generated}, Failed: {failed}")
        if not apply:
            self.stdout.write(self.style.WARNING("\nDry-run mode. Use --apply to write to DB."))
