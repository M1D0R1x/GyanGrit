"""
management/commands/bootstrap_chatrooms.py

Creates chat rooms for all schools that have students and enrolls everyone correctly.

What it creates:
  - 12 subject rooms (one per subject) for every section that has at least one student
  - Staff room for every institution that has teachers/principal or students
  - Officials room (one, platform-wide)

Who gets enrolled:
  - Subject room: admin + teacher (if TeachingAssignment exists) + all students in that section
  - Staff room: admin + all teachers + principals of that institution
  - Officials room: admin + all officials + all principals

Run once after fresh migration. Idempotent — safe to run again.

Usage:
    python manage.py bootstrap_chatrooms
    python manage.py bootstrap_chatrooms --dry-run
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Bootstrap chat rooms for all schools with students and enroll everyone"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry = options["dry_run"]

        from apps.academics.models import (
            Section, Subject, TeachingAssignment, Institution
        )
        from apps.chatrooms.models import ChatRoom, ChatRoomMember
        from apps.chatrooms.views import get_or_create_staff_room, get_or_create_officials_room

        admin_users = list(User.objects.filter(role="ADMIN"))
        all_subjects = list(Subject.objects.all())

        rooms_created  = 0
        memberships    = 0

        # ── Schools with students ─────────────────────────────────────────
        school_ids = set(
            User.objects.filter(role="STUDENT", section__isnull=False)
            .values_list("section__classroom__institution_id", flat=True)
            .distinct()
        )
        # Also include schools with teachers (for staff rooms)
        school_ids |= set(
            User.objects.filter(role__in=["TEACHER", "PRINCIPAL"], institution_id__isnull=False)
            .values_list("institution_id", flat=True)
            .distinct()
        )

        self.stdout.write(f"Schools to process: {len(school_ids)}")

        def enroll(room, user):
            nonlocal memberships
            if not dry:
                _, c = ChatRoomMember.objects.get_or_create(room=room, user=user)
                if c:
                    memberships += 1

        # ── Officials room ────────────────────────────────────────────────
        if not dry:
            orr = get_or_create_officials_room()
            for u in User.objects.filter(role__in=["OFFICIAL", "PRINCIPAL"]):
                enroll(orr, u)
            for a in admin_users:
                enroll(orr, a)
        self.stdout.write("Officials room: OK")

        for inst in Institution.objects.filter(id__in=school_ids).order_by("name"):
            self.stdout.write(f"  {inst.name}")

            # ── Staff room ────────────────────────────────────────────────
            if not dry:
                sr = get_or_create_staff_room(inst)
                for u in User.objects.filter(role__in=["TEACHER", "PRINCIPAL"], institution=inst):
                    enroll(sr, u)
                for a in admin_users:
                    enroll(sr, a)

            # ── Subject rooms for every section with students ──────────────
            for sec in Section.objects.filter(classroom__institution=inst).select_related("classroom"):
                students = list(User.objects.filter(role="STUDENT", section=sec))
                if not students:
                    continue  # no students → no rooms needed yet (signal handles on enrollment)

                for subj in all_subjects:
                    if dry:
                        self.stdout.write(f"    [dry] {sec.classroom.name}{sec.name} {subj.name}")
                        continue

                    room, created = ChatRoom.objects.get_or_create(
                        room_type="subject",
                        section=sec,
                        subject=subj,
                        defaults={"name": f"Class {sec.classroom.name}{sec.name} {subj.name}"},
                    )
                    if created:
                        rooms_created += 1

                    # Admin
                    for a in admin_users:
                        enroll(room, a)

                    # Teacher (if assigned)
                    for ta in TeachingAssignment.objects.filter(section=sec, subject=subj).select_related("teacher"):
                        enroll(room, ta.teacher)

                    # Students
                    for student in students:
                        enroll(room, student)

        if not dry:
            from apps.chatrooms.models import ChatRoom as CR, ChatRoomMember as CRM
            self.stdout.write(self.style.SUCCESS(
                f"\nDone. Total rooms: {CR.objects.count()} | "
                f"Total memberships: {CRM.objects.count()}"
            ))
        else:
            self.stdout.write("\nDry-run complete.")
