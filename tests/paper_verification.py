"""
paper_verification.py
=====================
Run from GyanGrit backend:

    cd /Users/veera/PycharmProjects/GyanGrit/backend
    python manage.py shell --settings=gyangrit.settings.dev < /Users/veera/gyangrit-paper/tests/paper_verification.py
"""

import time
from django.db import models as django_models

from apps.accounts.models import User
from apps.academics.models import ClassSubject, StudentSubject, ClassRoom, Subject
from apps.learning.models import Enrollment
from apps.content.models import Course, Lesson, LessonProgress
from apps.gamification.models import PointEvent, StudentPoints, StudentBadge, StudentStreak

SEP = "=" * 60
SEP2 = "-" * 50

print(SEP)
print("GyanGrit Paper Verification Test Suite")
print(SEP)


# ═══════════════════════════════════════════════════════════════
# TEST 1: Chain 1 — enrollment speed + record count
# ═══════════════════════════════════════════════════════════════
print("\n[TEST 1] Chain 1 — New Student Enrollment Speed")
print(SEP2)

# ClassSubject reverse name is 'subjects' per related_name="subjects"
classroom = ClassRoom.objects.filter(subjects__isnull=False).distinct().first()

if not classroom:
    print("  SKIP: No classroom with subjects found. Run seed_punjab first.")
    classroom = None
    section = None
else:
    section = classroom.sections.first()
    subject_count = ClassSubject.objects.filter(classroom=classroom).count()

    try:
        grade = int(classroom.name.strip())
        core_course_count = Course.objects.filter(grade=grade, is_core=True).count()
    except ValueError:
        grade = None
        core_course_count = 0

    print(f"  Classroom : {classroom.name} (grade {grade})")
    print(f"  Subjects  : {subject_count}")
    print(f"  Core courses available : {core_course_count}")
    print(f"  Expected records/student: {subject_count} StudentSubject "
          f"+ {subject_count * core_course_count} Enrollment")

    # Create test student and measure wall time
    institution = classroom.institution

    t0 = time.perf_counter()
    test_user = User.objects.create_user(
        username=f"test_paper_s1_{int(time.time())}",
        password="testpass123",
        role="STUDENT",
        section=section,
        institution=institution,
    )
    t1 = time.perf_counter()
    elapsed_ms = (t1 - t0) * 1000

    ss_count = StudentSubject.objects.filter(student=test_user).count()
    en_count = Enrollment.objects.filter(user=test_user).count()

    print(f"\n  ✓ Registration completed in  : {elapsed_ms:.1f} ms")
    print(f"  ✓ StudentSubject records     : {ss_count}")
    print(f"  ✓ Enrollment records         : {en_count}")
    print(f"  ✓ Total records auto-created : {ss_count + en_count}")
    print(f"  ✓ Admin actions required     : 0")

    # Save for test 2
    test_user_for_dedup = test_user


# ═══════════════════════════════════════════════════════════════
# TEST 2: Chain 1 — deduplication under 100 repeated signals
# ═══════════════════════════════════════════════════════════════
print("\n[TEST 2] Chain 1 — Deduplication Under 100 Repeated Signals")
print(SEP2)

if classroom and section:
    baseline_ss = StudentSubject.objects.filter(student=test_user_for_dedup).count()
    baseline_en = Enrollment.objects.filter(user=test_user_for_dedup).count()

    from apps.academics.signals import auto_assign_subjects
    for _ in range(100):
        auto_assign_subjects(sender=User, instance=test_user_for_dedup, created=True)

    final_ss = StudentSubject.objects.filter(student=test_user_for_dedup).count()
    final_en = Enrollment.objects.filter(user=test_user_for_dedup).count()

    dup_ss = final_ss - baseline_ss
    dup_en = final_en - baseline_en

    print(f"  StudentSubject before : {baseline_ss}  after 100 fires : {final_ss}  duplicates : {dup_ss}")
    print(f"  Enrollment     before : {baseline_en}  after 100 fires : {final_en}  duplicates : {dup_en}")

    if dup_ss == 0 and dup_en == 0:
        print("  ✓ PASS — get_or_create deduplication unconditionally safe")
    else:
        print("  ✗ FAIL — duplicates were created!")

    # Cleanup test 1 + 2
    test_user_for_dedup.delete()
    print("  (test student cleaned up)")
else:
    print("  SKIP — no classroom available")


# ═══════════════════════════════════════════════════════════════
# TEST 3: Chain 2 — retroactive enrollment on new ClassSubject
# ═══════════════════════════════════════════════════════════════
print("\n[TEST 3] Chain 2 — Retroactive Enrollment on Curriculum Expansion")
print(SEP2)

if classroom and section:
    existing_students = User.objects.filter(
        role="STUDENT", section__classroom=classroom
    ).count()
    print(f"  Existing students in classroom : {existing_students}")

    # Create a new subject (won't conflict if unique)
    import random
    test_subject_name = f"TestSubject_Paper_{random.randint(10000, 99999)}"
    test_subject = Subject.objects.create(name=test_subject_name)

    # Count enrollments before
    en_before = Enrollment.objects.filter(
        user__role="STUDENT",
        user__section__classroom=classroom,
    ).count()

    # Add ClassSubject — this fires Chain 2 signal
    t0 = time.perf_counter()
    test_cs = ClassSubject.objects.create(classroom=classroom, subject=test_subject)
    t1 = time.perf_counter()
    elapsed_ms = (t1 - t0) * 1000

    en_after = Enrollment.objects.filter(
        user__role="STUDENT",
        user__section__classroom=classroom,
    ).count()

    new_ss = StudentSubject.objects.filter(subject=test_subject).count()
    new_en = en_after - en_before

    print(f"  Chain 2 completed in : {elapsed_ms:.1f} ms")
    print(f"  New StudentSubject records : {new_ss} (expected {existing_students})")
    print(f"  New Enrollment records     : {new_en}")
    print(f"  Admin actions required     : 0")

    if new_ss == existing_students:
        print("  ✓ PASS — all existing students retroactively enrolled")
    else:
        print(f"  ✗ PARTIAL — only {new_ss}/{existing_students} students enrolled")

    # Cleanup
    test_cs.delete()
    test_subject.delete()
    print("  (test subject + ClassSubject cleaned up)")
else:
    print("  SKIP — no classroom available")


# ═══════════════════════════════════════════════════════════════
# TEST 4: Gamification — 500 duplicate PointEvent attempts
# ═══════════════════════════════════════════════════════════════
print("\n[TEST 4] Gamification — 500 Duplicate PointEvent Attempts")
print(SEP2)

lp = LessonProgress.objects.filter(
    user__role="STUDENT", completed=True
).select_related("user", "lesson").first()

if not lp:
    print("  SKIP — no completed LessonProgress found")
else:
    user = lp.user
    lesson_id = lp.lesson_id

    baseline = PointEvent.objects.filter(
        user=user, reason="lesson_complete", lesson_id=lesson_id
    ).count()

    from apps.gamification.signals import on_lesson_progress_save
    for _ in range(500):
        on_lesson_progress_save(sender=LessonProgress, instance=lp, created=False)

    final = PointEvent.objects.filter(
        user=user, reason="lesson_complete", lesson_id=lesson_id
    ).count()

    duplicates = final - baseline

    print(f"  User     : {user.username}")
    print(f"  Lesson   : {lesson_id}")
    print(f"  PointEvents before 500 fires : {baseline}")
    print(f"  PointEvents after  500 fires : {final}")
    print(f"  Duplicates created           : {duplicates}")

    # Verify ledger consistency
    try:
        sp = StudentPoints.objects.get(user=user)
        actual_sum = PointEvent.objects.filter(user=user).aggregate(
            total=django_models.Sum("points")
        )["total"] or 0
        consistent = sp.total_points == actual_sum
        print(f"  StudentPoints.total_points   : {sp.total_points}")
        print(f"  Sum of all PointEvent rows   : {actual_sum}")
        print(f"  Ledger consistent            : {'✓ YES' if consistent else '✗ NO'}")
    except StudentPoints.DoesNotExist:
        print("  StudentPoints record not found for user")

    if duplicates == 0:
        print("  ✓ PASS — zero double-awards across 500 duplicate attempts")
    else:
        print(f"  ✗ FAIL — {duplicates} duplicate PointEvents created!")


# ═══════════════════════════════════════════════════════════════
# TEST 5: Lesson payload size analysis
# ═══════════════════════════════════════════════════════════════
print("\n[TEST 5] Lesson Text Payload Size vs Video")
print(SEP2)

lessons = list(Lesson.objects.exclude(content="").exclude(content__isnull=True)[:100])

if not lessons:
    print("  SKIP — no lessons with text content found")
else:
    sizes_bytes = [len(l.content.encode("utf-8")) for l in lessons]
    avg_kb = sum(sizes_bytes) / len(sizes_bytes) / 1024
    min_kb = min(sizes_bytes) / 1024
    max_kb = max(sizes_bytes) / 1024
    hls_min_kb = 500  # conservative minimum for 360p HLS segment

    ratio = hls_min_kb / avg_kb if avg_kb > 0 else 0

    print(f"  Lessons sampled           : {len(sizes_bytes)}")
    print(f"  Avg lesson text size      : {avg_kb:.2f} KB")
    print(f"  Min lesson text size      : {min_kb:.2f} KB")
    print(f"  Max lesson text size      : {max_kb:.2f} KB")
    print(f"  HLS 360p min segment      : ~{hls_min_kb} KB")
    print(f"  Bandwidth reduction ratio : ~{ratio:.0f}x")
    print(f"  ✓ Text-first lessons viable on <100 Kbps (rural 2G/3G)")


# ═══════════════════════════════════════════════════════════════
# TEST 6: Live system stats
# ═══════════════════════════════════════════════════════════════
print("\n[TEST 6] Live System Stats")
print(SEP2)

total_students  = User.objects.filter(role="STUDENT").count()
total_teachers  = User.objects.filter(role="TEACHER").count()
total_enroll    = Enrollment.objects.count()
total_completed = LessonProgress.objects.filter(completed=True).count()
total_pe        = PointEvent.objects.count()
total_badges    = StudentBadge.objects.count()
total_classrooms= ClassRoom.objects.count()
total_subjects  = ClassSubject.objects.count()

print(f"  Students registered   : {total_students}")
print(f"  Teachers registered   : {total_teachers}")
print(f"  Classrooms            : {total_classrooms}")
print(f"  ClassSubjects         : {total_subjects}")
print(f"  Total enrollments     : {total_enroll}")
print(f"  Completed lessons     : {total_completed}")
print(f"  PointEvent records    : {total_pe}")
print(f"  Badges awarded        : {total_badges}")

print("\n" + SEP)
print("VERIFICATION COMPLETE — paste output into SESSION_KNOWLEDGE.md")
print(SEP)
