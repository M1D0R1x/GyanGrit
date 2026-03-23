"""
management/commands/bootstrap_chatrooms.py

Creates chat rooms for all schools with real users and enrolls everyone.
Run once after migration. Signals handle new users automatically after that.

What it creates:
  - Subject rooms for every section × subject where a TeachingAssignment exists
  - Staff room for every institution that has at least one teacher or principal
  - Officials room (one, platform-wide)

Who gets enrolled:
  - Subject room: the assigned teacher + all students in that section + all admins
  - Staff room: all teachers + principals of that institution + all admins
  - Officials room: all officials + all principals + all admins

Usage:
    python manage.py bootstrap_chatrooms
    python manage.py bootstrap_chatrooms --dry-run
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Bootstrap chat rooms and enroll all existing users"

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

        rooms_created = 0
        enrollments   = 0

        # ── Officials room ────────────────────────────────────────────────
        if not dry:
            officials_room = get_or_create_officials_room()
            for u in User.objects.filter(role__in=["OFFICIAL", "PRINCIPAL"]):
                if enroll_user(officials_room, u): enrollments += 1
            enroll_admin_in_room(officials_room)
        self.stdout.write("Officials room: OK")

        # ── Staff rooms (institutions with teachers/principals) ───────────
        inst_ids = set(
            list(User.objects.filter(role__in=["TEACHER", "PRINCIPAL"], institution_id__isnull=False)
                 .values_list("institution_id", flat=True).distinct())
        )
        for inst in Institution.objects.filter(id__in=inst_ids):
            if dry:
                self.stdout.write(f"  [dry] staff: {inst.name}")
                continue
            room = get_or_create_staff_room(inst)
            for u in User.objects.filter(role__in=["TEACHER", "PRINCIPAL"], institution=inst):
                if enroll_user(room, u): enrollments += 1
            enroll_admin_in_room(room)
            rooms_created += 1
        self.stdout.write(f"Staff rooms: {len(inst_ids)} institutions")

        # ── Subject rooms (from teaching assignments) ─────────────────────
        assignments = TeachingAssignment.objects.select_related(
            "section__classroom__institution", "subject", "teacher"
        ).all()

        subject_room_count = 0
        for ta in assignments:
            if dry:
                self.stdout.write(f"  [dry] subject: {ta.section} × {ta.subject.name}")
                continue
            room = get_or_create_subject_room(ta.section, ta.subject)
            # Enroll teacher
            if enroll_user(room, ta.teacher): enrollments += 1
            # Enroll all students in this section
            for student in User.objects.filter(role="STUDENT", section=ta.section):
                if enroll_user(room, student): enrollments += 1
            enroll_admin_in_room(room)
            subject_room_count += 1

        self.stdout.write(f"Subject rooms: {subject_room_count} teaching assignments processed")

        if not dry:
            total_rooms   = ChatRoom.objects.count()
            total_members = ChatRoomMember.objects.count()
            self.stdout.write(self.style.SUCCESS(
                f"\nDone. Rooms: {total_rooms} | Memberships: {total_members}"
            ))
        else:
            self.stdout.write("\nDry-run complete — nothing written.")
