"""
management/commands/bootstrap_chatrooms.py

Creates chat rooms for all existing users.
Run once after deploying, then signals handle new users automatically.

Usage:
    python manage.py bootstrap_chatrooms
    python manage.py bootstrap_chatrooms --dry-run
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.academics.models import Section, TeachingAssignment, Institution
from apps.chatrooms.views import (
    get_or_create_class_room,
    get_or_create_subject_room,
    get_or_create_staff_room,
    get_or_create_officials_room,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Bootstrap chat rooms for all existing users (run once after migration)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without creating anything",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        created = 0
        skipped = 0

        def make(label, fn, *args):
            nonlocal created, skipped
            if dry_run:
                self.stdout.write(f"  [dry-run] would create: {label}")
                return
            try:
                room, was_created = fn(*args).__class__.objects.get_or_create_result \
                    if hasattr(fn(*args), '__class__') else (fn(*args), False)
            except Exception:
                room = fn(*args)
                was_created = False
            # fn already uses get_or_create internally
            if was_created:
                created += 1
            else:
                skipped += 1

        # ── Officials room (one, platform-wide) ────────────────────────────
        self.stdout.write("Creating officials room...")
        if not dry_run:
            r, c = get_or_create_officials_room(), False
            from apps.chatrooms.models import ChatRoom, RoomType
            # Check if it was just created
            self.stdout.write(f"  Officials room: id={r.id} '{r.name}'")

        # ── Staff rooms (one per institution) ──────────────────────────────
        self.stdout.write("Creating staff rooms...")
        for inst in Institution.objects.all():
            if dry_run:
                self.stdout.write(f"  [dry-run] staff room for: {inst.name}")
            else:
                r = get_or_create_staff_room(inst)
                self.stdout.write(f"  {r.name} (id={r.id})")

        # ── Class general + subject rooms via TeachingAssignments ──────────
        self.stdout.write("Creating class and subject rooms from teaching assignments...")
        seen_sections: set[int] = set()
        for ta in TeachingAssignment.objects.select_related("section__classroom", "subject").all():
            if ta.section_id not in seen_sections:
                if dry_run:
                    self.stdout.write(f"  [dry-run] class_general: {ta.section}")
                else:
                    get_or_create_class_room(ta.section)
                seen_sections.add(ta.section_id)

            if dry_run:
                self.stdout.write(f"  [dry-run] subject: {ta.section} × {ta.subject.name}")
            else:
                get_or_create_subject_room(ta.section, ta.subject)

        # ── Class general from students (sections with no teacher yet) ─────
        self.stdout.write("Creating class_general for student sections...")
        student_section_ids = (
            User.objects.filter(role="STUDENT", section_id__isnull=False)
            .values_list("section_id", flat=True)
            .distinct()
        )
        for sec in Section.objects.filter(id__in=student_section_ids).select_related("classroom"):
            if sec.id in seen_sections:
                continue
            if dry_run:
                self.stdout.write(f"  [dry-run] class_general: {sec}")
            else:
                get_or_create_class_room(sec)

        from apps.chatrooms.models import ChatRoom
        total = ChatRoom.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. Total chat rooms in DB: {total}"
                if not dry_run else "\nDry-run complete."
            )
        )
