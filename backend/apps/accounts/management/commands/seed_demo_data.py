"""
seed_demo_data — Populates Government Senior Secondary School Amritsar
with realistic users, engagement, gamification, assessments, and chat.

Usage:  python manage.py seed_demo_data
"""
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.academics.models import (
    District, Institution, ClassRoom, Section, Subject,
    TeachingAssignment, StudentSubject, ClassSubject,
)
from apps.content.models import Course, Lesson, LessonProgress
from apps.assessments.models import Assessment, AssessmentAttempt, Question, QuestionOption
from apps.analytics.models import EngagementEvent, EventType, DailyEngagementSummary, StudentRiskScore
from apps.gamification.models import (
    PointEvent, StudentPoints, StudentBadge, StudentStreak,
    PointReason, BadgeCode, POINT_VALUES,
)
from apps.chatrooms.models import ChatRoom, ChatRoomMember, ChatMessage, RoomType

from .demo_constants import (
    TEACHER_MAP, PRINCIPAL_UPDATE, STUDENT_NAMES, GRADE_SLICES,
    MOBILES_PRIMARY, MOBILES_SECONDARY, EMAIL_BASES,
    STAFF_MESSAGES, get_subject_messages,
)

PASSWORD = make_password("Aspas,2103,@")
NOW = timezone.now()
TODAY = NOW.date()


class Command(BaseCommand):
    help = "Seed demo data for Govt Senior Secondary School Amritsar"


    def handle(self, *args, **opts):
        random.seed(42)
        district = District.objects.get(name="Amritsar")
        institution = Institution.objects.get(
            name="Government Senior Secondary School Amritsar", district=district
        )
        self.stdout.write(f"Institution: {institution} (id={institution.id})")

        # ── Build section map ────────────────────────────────────────
        sections = {}  # grade -> Section
        for grade in range(6, 11):
            cr = ClassRoom.objects.get(name=str(grade), institution=institution)
            sec = Section.objects.get(name="A", classroom=cr)
            sections[grade] = sec
        self.stdout.write(f"Sections: {sections}")

        subjects = {s.name: s for s in Subject.objects.all()}

        # ══════════════════════════════════════════════════════════════
        # 1. UPDATE PRINCIPAL
        # ══════════════════════════════════════════════════════════════
        uname, fn, mn, ln = PRINCIPAL_UPDATE
        principal = User.objects.get(username=uname)
        principal.first_name, principal.middle_name, principal.last_name = fn, mn, ln
        principal.password = PASSWORD
        principal.institution = institution
        principal.profile_complete = True
        principal.mobile_primary = MOBILES_PRIMARY[0]
        principal.mobile_secondary = MOBILES_SECONDARY[0]
        principal.email = f"{EMAIL_BASES[0]}+{fn.lower()}{ln.lower()}@gmail.com"
        principal.save()
        self.stdout.write(f"  Principal: {principal.display_name}")

        # ══════════════════════════════════════════════════════════════
        # 2. UPDATE / FIX TEACHERS  +  TEACHING ASSIGNMENTS
        # ══════════════════════════════════════════════════════════════
        teachers = {}  # subject_name -> User
        for i, (uname, subj_name, fn, ln) in enumerate(TEACHER_MAP):
            t = User.objects.get(username=uname)
            t.first_name = fn
            t.last_name = ln
            t.middle_name = ""
            t.password = PASSWORD
            t.role = "TEACHER"
            t.institution = institution
            t.district = district.name
            t.profile_complete = True
            t.mobile_primary = MOBILES_PRIMARY[i % 2]
            t.mobile_secondary = MOBILES_SECONDARY[i % 2]
            t.email = f"{EMAIL_BASES[i % 2]}+{fn.lower()}{ln.lower()}@gmail.com"
            t.save()
            teachers[subj_name] = t

            subj = subjects[subj_name]
            for grade in range(6, 11):
                TeachingAssignment.objects.get_or_create(
                    teacher=t, subject=subj, section=sections[grade],
                )
        self.stdout.write(f"  Teachers updated: {len(teachers)}")
        ta_count = TeachingAssignment.objects.filter(
            teacher__institution=institution
        ).count()
        self.stdout.write(f"  TeachingAssignments: {ta_count}")

        # ══════════════════════════════════════════════════════════════
        # 3. CREATE / UPDATE STUDENTS
        # ══════════════════════════════════════════════════════════════
        all_students = {}  # grade -> [User]
        student_idx = 0
        for grade in range(6, 11):
            start, end = GRADE_SLICES[grade]
            grade_students = []
            for j in range(start, end):
                fn, ln = STUDENT_NAMES[j]
                uname = f"c{grade}a.{fn.lower()}"
                email_base = EMAIL_BASES[student_idx % 2]
                email = f"{email_base}+{fn.lower()}{ln.lower()}@gmail.com"
                sec = sections[grade]

                s, created = User.objects.get_or_create(
                    username=uname,
                    defaults={
                        "first_name": fn, "last_name": ln, "middle_name": "",
                        "password": PASSWORD, "role": "STUDENT",
                        "institution": institution, "section": sec,
                        "district": district.name, "profile_complete": True,
                        "mobile_primary": MOBILES_PRIMARY[student_idx % 2],
                        "mobile_secondary": MOBILES_SECONDARY[student_idx % 2],
                        "email": email,
                    },
                )
                if not created:
                    s.first_name, s.last_name = fn, ln
                    s.password = PASSWORD
                    s.section = sec
                    s.institution = institution
                    s.district = district.name
                    s.profile_complete = True
                    s.mobile_primary = MOBILES_PRIMARY[student_idx % 2]
                    s.mobile_secondary = MOBILES_SECONDARY[student_idx % 2]
                    s.email = email
                    s.save()
                grade_students.append(s)
                student_idx += 1

                # Enroll in all subjects for this grade
                cr = sections[grade].classroom
                for cs in ClassSubject.objects.filter(classroom=cr):
                    StudentSubject.objects.get_or_create(
                        student=s, subject=cs.subject, classroom=cr,
                    )

            all_students[grade] = grade_students
            self.stdout.write(f"  Class {grade}: {len(grade_students)} students")

        # Flatten
        flat_students = []
        for g in range(6, 11):
            flat_students.extend(all_students[g])

        total = len(flat_students)
        self.stdout.write(f"  Total students: {total}")

        # ══════════════════════════════════════════════════════════════
        # 4. SEED ENGAGEMENT EVENTS (14 days)
        # ══════════════════════════════════════════════════════════════
        self.stdout.write("Seeding engagement events...")
        # Tier assignment: top 20%, mid 50%, bottom 30%
        random.shuffle(flat_students)
        top = flat_students[:int(total * 0.2)]
        mid = flat_students[int(total * 0.2):int(total * 0.7)]
        low = flat_students[int(total * 0.7):]

        existing_events = EngagementEvent.objects.filter(
            user__in=flat_students
        ).exists()
        if existing_events:
            self.stdout.write("  ⏭ Engagement events already exist — skipping")
        else:
            tier_config = {
                "top": {"days_active": (12, 14), "mins_per_day": (30, 60), "students": top},
                "mid": {"days_active": (7, 11),  "mins_per_day": (10, 30), "students": mid},
                "low": {"days_active": (2, 5),   "mins_per_day": (3, 15),  "students": low},
            }

            events_bulk = []
            for tier_name, cfg in tier_config.items():
                for s in cfg["students"]:
                    days_active = random.randint(*cfg["days_active"])
                    active_days = sorted(random.sample(range(14), min(days_active, 14)))
                    for day_offset in active_days:
                        day = TODAY - timedelta(days=13 - day_offset)
                        mins = random.randint(*cfg["mins_per_day"])
                        ts = timezone.make_aware(
                            timezone.datetime(day.year, day.month, day.day, random.randint(8, 20), random.randint(0, 59))
                        )
                        events_bulk.append(EngagementEvent(
                            user=s, event_type=EventType.LOGIN,
                            duration_seconds=0, created_at=ts, event_date=day,
                        ))
                        events_bulk.append(EngagementEvent(
                            user=s, event_type=EventType.LESSON_VIEW,
                            duration_seconds=mins * 60,
                            resource_label="lesson", created_at=ts + timedelta(minutes=2),
                            event_date=day,
                        ))
                        events_bulk.append(EngagementEvent(
                            user=s, event_type=EventType.PAGE_VISIT,
                            duration_seconds=random.randint(30, 300),
                            created_at=ts + timedelta(minutes=1), event_date=day,
                        ))

            EngagementEvent.objects.bulk_create(events_bulk, ignore_conflicts=True)
            self.stdout.write(f"  Events created: {len(events_bulk)}")

        # ══════════════════════════════════════════════════════════════
        # 5. LESSON PROGRESS
        # ══════════════════════════════════════════════════════════════
        self.stdout.write("Seeding lesson progress...")
        progress_bulk = []
        for grade, students in all_students.items():
            courses = Course.objects.filter(grade=grade)
            for course in courses:
                lessons = list(Lesson.objects.filter(course=course, is_published=True).order_by("order"))
                if not lessons:
                    continue
                for s in students:
                    if s in top:
                        pct = random.uniform(0.7, 1.0)
                    elif s in mid:
                        pct = random.uniform(0.3, 0.7)
                    else:
                        pct = random.uniform(0.05, 0.3)
                    n_complete = max(0, int(len(lessons) * pct))
                    for idx, lesson in enumerate(lessons):
                        completed = idx < n_complete
                        progress_bulk.append(LessonProgress(
                            lesson=lesson, user=s,
                            completed=completed, last_position=0,
                            last_opened_at=NOW - timedelta(days=random.randint(0, 7)) if completed or random.random() < 0.5 else None,
                        ))
        # Use ignore_conflicts because some might already exist
        LessonProgress.objects.bulk_create(progress_bulk, ignore_conflicts=True)
        self.stdout.write(f"  LessonProgress created: {len(progress_bulk)}")

        # ══════════════════════════════════════════════════════════════
        # 6. ASSESSMENT ATTEMPTS
        # ══════════════════════════════════════════════════════════════
        self.stdout.write("Seeding assessment attempts...")
        existing_attempts = AssessmentAttempt.objects.filter(
            user__in=flat_students
        ).exists()
        if existing_attempts:
            self.stdout.write("  ⏭ Assessment attempts already exist — skipping")
        else:
            attempt_count = 0
            for grade, students in all_students.items():
                assessments = Assessment.objects.filter(
                    course__grade=grade, is_published=True
                ).prefetch_related("questions__options")
                for assess in assessments:
                    questions = list(assess.questions.all())
                    if not questions:
                        continue
                    for s in students:
                        if s in low and random.random() < 0.4:
                            continue
                        if s in mid and random.random() < 0.15:
                            continue
                        selected = {}
                        for q in questions:
                            opts = list(q.options.all())
                            if not opts:
                                continue
                            if s in top:
                                correct = [o for o in opts if o.is_correct]
                                wrong = [o for o in opts if not o.is_correct]
                                pick = correct[0] if correct and random.random() < 0.85 else (wrong[0] if wrong else opts[0])
                            elif s in mid:
                                correct = [o for o in opts if o.is_correct]
                                wrong = [o for o in opts if not o.is_correct]
                                pick = correct[0] if correct and random.random() < 0.55 else (wrong[0] if wrong else opts[0])
                            else:
                                correct = [o for o in opts if o.is_correct]
                                wrong = [o for o in opts if not o.is_correct]
                                pick = correct[0] if correct and random.random() < 0.30 else (wrong[0] if wrong else opts[0])
                            selected[str(q.id)] = pick.id
                        attempt = AssessmentAttempt(
                            user=s, assessment=assess,
                            started_at=NOW - timedelta(days=random.randint(1, 10), hours=random.randint(0, 12)),
                            selected_options=selected,
                        )
                        attempt.calculate_score_and_pass()
                        attempt.submitted_at = attempt.started_at + timedelta(minutes=random.randint(5, 25))
                        attempt_count += 1
                        attempt.save()
            self.stdout.write(f"  Attempts created: {attempt_count}")

        # ══════════════════════════════════════════════════════════════
        # 7. GAMIFICATION
        # ══════════════════════════════════════════════════════════════
        self.stdout.write("Seeding gamification...")
        for s in flat_students:
            total_pts = 0

            # Points from lesson completions
            completed = LessonProgress.objects.filter(user=s, completed=True).count()
            if completed > 0:
                pts = completed * POINT_VALUES[PointReason.LESSON_COMPLETE]
                if not PointEvent.objects.filter(user=s, reason=PointReason.LESSON_COMPLETE).exists():
                    PointEvent.objects.create(
                        user=s, reason=PointReason.LESSON_COMPLETE,
                        points=pts, created_at=NOW - timedelta(days=random.randint(0, 7)),
                    )
                total_pts += pts

            # Points from assessment passes
            passed = AssessmentAttempt.objects.filter(user=s, passed=True).count()
            if passed > 0:
                pts = passed * POINT_VALUES[PointReason.ASSESSMENT_PASS]
                if not PointEvent.objects.filter(user=s, reason=PointReason.ASSESSMENT_PASS).exists():
                    PointEvent.objects.create(
                        user=s, reason=PointReason.ASSESSMENT_PASS,
                        points=pts, created_at=NOW - timedelta(days=random.randint(0, 5)),
                    )
                total_pts += pts

            StudentPoints.objects.update_or_create(
                user=s, defaults={"total_points": total_pts}
            )

            # Badges
            if completed >= 1:
                StudentBadge.objects.get_or_create(user=s, badge_code=BadgeCode.FIRST_LESSON)
            if completed >= 10:
                StudentBadge.objects.get_or_create(user=s, badge_code=BadgeCode.LESSON_10)
            if passed >= 1:
                StudentBadge.objects.get_or_create(user=s, badge_code=BadgeCode.FIRST_PASS)
            if total_pts >= 100:
                StudentBadge.objects.get_or_create(user=s, badge_code=BadgeCode.POINTS_100)
            if total_pts >= 500:
                StudentBadge.objects.get_or_create(user=s, badge_code=BadgeCode.POINTS_500)

            # Streaks
            if s in top:
                cur, longest = random.randint(5, 12), random.randint(8, 14)
                last_day = TODAY
            elif s in mid:
                cur, longest = random.randint(1, 4), random.randint(3, 7)
                last_day = TODAY - timedelta(days=random.randint(0, 2))
            else:
                cur, longest = 0, random.randint(1, 3)
                last_day = TODAY - timedelta(days=random.randint(3, 8))

            if cur >= 3:
                StudentBadge.objects.get_or_create(user=s, badge_code=BadgeCode.STREAK_3)
            if cur >= 7:
                StudentBadge.objects.get_or_create(user=s, badge_code=BadgeCode.STREAK_7)

            StudentStreak.objects.update_or_create(
                user=s, defaults={
                    "current_streak": cur,
                    "longest_streak": max(cur, longest),
                    "last_activity_date": last_day,
                },
            )

        self.stdout.write(f"  Gamification done for {len(flat_students)} students")

        # ══════════════════════════════════════════════════════════════
        # 8. CHAT ROOMS + MESSAGES
        # ══════════════════════════════════════════════════════════════
        self.stdout.write("Seeding chat rooms and messages...")
        admin_users = list(User.objects.filter(role="ADMIN"))

        # Staff room
        staff_room, _ = ChatRoom.objects.get_or_create(
            room_type=RoomType.STAFF, institution=institution,
            defaults={"name": f"{institution.name} — Staff"},
        )
        # Enroll principal + teachers + admins
        for u in [principal] + list(teachers.values()):
            ChatRoomMember.objects.get_or_create(room=staff_room, user=u)
        for a in admin_users:
            ChatRoomMember.objects.get_or_create(room=staff_room, user=a)

        # Seed staff messages
        staff_senders = [principal] + list(teachers.values())
        for i, (msg,) in enumerate(STAFF_MESSAGES):
            sender = staff_senders[i % len(staff_senders)]
            ChatMessage.objects.get_or_create(
                room=staff_room, sender=sender, content=msg,
                defaults={
                    "sent_at": NOW - timedelta(days=7 - i, hours=random.randint(8, 16), minutes=random.randint(0, 59)),
                },
            )

        # Subject rooms
        for subj_name, teacher in teachers.items():
            subj = subjects[subj_name]
            for grade in range(6, 11):
                sec = sections[grade]
                room_name = f"Class {grade}A {subj_name}"
                room, _ = ChatRoom.objects.get_or_create(
                    room_type=RoomType.SUBJECT, section=sec, subject=subj,
                    defaults={"name": room_name},
                )
                # Enroll teacher
                ChatRoomMember.objects.get_or_create(room=room, user=teacher)
                # Enroll students
                grade_studs = all_students[grade]
                for s in grade_studs:
                    ChatRoomMember.objects.get_or_create(room=room, user=s)
                for a in admin_users:
                    ChatRoomMember.objects.get_or_create(room=room, user=a)

                # Seed messages (only for a subset of rooms to keep it manageable)
                if random.random() < 0.4:
                    continue  # Skip 60% of rooms — not all rooms are active

                teacher_msgs, student_msgs = get_subject_messages(subj_name)
                base_day = 6
                for j, msg in enumerate(teacher_msgs[:3]):
                    ChatMessage.objects.get_or_create(
                        room=room, sender=teacher, content=msg,
                        defaults={
                            "sent_at": NOW - timedelta(days=base_day - j, hours=random.randint(9, 14)),
                        },
                    )
                # Student replies
                for j, msg in enumerate(random.sample(student_msgs, min(4, len(student_msgs)))):
                    sender = random.choice(grade_studs)
                    ChatMessage.objects.get_or_create(
                        room=room, sender=sender, content=msg,
                        defaults={
                            "sent_at": NOW - timedelta(days=base_day - 1 - (j // 2), hours=random.randint(15, 20)),
                        },
                    )

        total_rooms = ChatRoom.objects.filter(
            institution=institution
        ).count() + ChatRoom.objects.filter(
            section__classroom__institution=institution
        ).count()
        total_msgs = ChatMessage.objects.count()
        self.stdout.write(f"  Rooms: {total_rooms} | Messages: {total_msgs}")

        # ══════════════════════════════════════════════════════════════
        # DONE
        # ══════════════════════════════════════════════════════════════
        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Demo data seeded successfully!\n"
            f"  Principal: {principal.username}\n"
            f"  Teachers: {', '.join(t.username for t in teachers.values())}\n"
            f"  Students: {len(flat_students)}\n"
            f"\nNext: run 'python manage.py calculate_risk_scores' for analytics"
        ))
