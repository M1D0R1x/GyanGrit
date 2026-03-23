"""
management/commands/bootstrap_chatrooms.py

Creates chat rooms for schools with real users and enrolls everyone.
Run once after migration — signals handle new users automatically after that.

Rules (matching the signal logic exactly):
  - Subject rooms are ONLY created where a TeachingAssignment exists.
    Never create rooms for subjects with no teacher.
  - Staff rooms for institutions that have at least one teacher/principal.
  - Officials room (one, platform-wide).

Usage:
    python manage.py bootstrap_chatrooms
    python manage.py bootstrap_chatrooms --dry-run
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Bootstrap chat rooms for existing users (run once after migration)"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry = options["dry_run"]

        from apps.academics.models import TeachingAssignment, Institution
        from apps.chatrooms.views import (
            get_or_create_subject_room,
            get_or_create_staff_room,
            get_or_create_officials_room,
            enroll_user,
            enroll_admin_in_room,
        )
        from apps.chatrooms.models import ChatRoom, ChatRoomMember

        admins = list(User.objects.filter(role="ADMIN"))

        # ── Officials room ────────────────────────────────────────────────
        if not dry:
            orr = get_or_create_officials_room()
            for u in User.objects.filter(role__in=["OFFICIAL", "PRINCIPAL"]):
                enroll_user(orr, u)
            enroll_admin_in_room(orr)
        self.stdout.write("Officials room: OK")

        # ── Staff rooms — only institutions with actual teachers/principals ─
        inst_ids = set(
            User.objects.filter(
                role__in=["TEACHER", "PRINCIPAL"], institution_id__isnull=False
            ).values_list("institution_id", flat=True).distinct()
        )
        for inst in Institution.objects.filter(id__in=inst_ids).order_by("name"):
            if dry:
                self.stdout.write(f"  [dry] staff: {inst.name}")
                continue
            sr = get_or_create_staff_room(inst)
            for u in User.objects.filter(role__in=["TEACHER", "PRINCIPAL"], institution=inst):
                enroll_user(sr, u)
            enroll_admin_in_room(sr)
        self.stdout.write(f"Staff rooms: {len(inst_ids)} institutions")

        # ── Subject rooms — ONLY where TeachingAssignment exists ──────────
        # This is the critical rule: rooms only exist when a teacher is assigned.
        ta_count = 0
        for ta in TeachingAssignment.objects.select_related(
            "section__classroom__institution", "subject", "teacher"
        ).all():
            if dry:
                self.stdout.write(f"  [dry] subject: Class {ta.section.classroom.name}{ta.section.name} {ta.subject.name}")
                continue

            room = get_or_create_subject_room(ta.section, ta.subject)

            # Enroll teacher
            enroll_user(room, ta.teacher)

            # Enroll all students in this section
            for student in User.objects.filter(role="STUDENT", section=ta.section):
                enroll_user(room, student)

            # Enroll admin
            enroll_admin_in_room(room)
            ta_count += 1

        self.stdout.write(f"Subject rooms: {ta_count} assignments processed")

        if not dry:
            total_rooms   = ChatRoom.objects.count()
            total_members = ChatRoomMember.objects.count()
            self.stdout.write(self.style.SUCCESS(
                f"\nDone. Total rooms: {total_rooms} | Total memberships: {total_members}"
            ))
        else:
            self.stdout.write("\nDry-run complete — nothing written.")
