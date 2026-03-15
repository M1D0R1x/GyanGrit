"""
management command: seed_content

Creates one Course per Subject × Grade (6–10),
5 Lessons per course, and 1 Assessment with 5 questions per course.

This is the shared curriculum model — one set of content for all schools.
Run once after seed_punjab:

    python manage.py seed_content

Safe to re-run: uses get_or_create throughout.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.academics.models import Subject
from apps.content.models import Course, Lesson
from apps.assessments.models import Assessment, Question, QuestionOption

GRADES = [6, 7, 8, 9, 10]

# Sample lesson titles per subject — realistic NCERT-style content
LESSON_TEMPLATES = {
    "Mathematics": [
        "Introduction to the Chapter",
        "Core Concepts and Definitions",
        "Worked Examples",
        "Practice Problems",
        "Chapter Summary and Review",
    ],
    "Physics": [
        "Introduction and History",
        "Key Laws and Principles",
        "Experimental Methods",
        "Numerical Problems",
        "Real-world Applications",
    ],
    "Chemistry": [
        "Introduction to the Topic",
        "Atomic Structure and Bonding",
        "Chemical Reactions",
        "Laboratory Safety and Experiments",
        "Revision and Key Points",
    ],
    "Biology": [
        "Introduction to Life Processes",
        "Cell Structure and Function",
        "Organ Systems Overview",
        "Classification and Diagrams",
        "Chapter Revision",
    ],
    "English 1": [
        "Reading Comprehension",
        "Grammar — Parts of Speech",
        "Writing Skills",
        "Vocabulary Building",
        "Literature and Poetry",
    ],
    "English 2": [
        "Prose Reading",
        "Comprehension Questions",
        "Letter and Essay Writing",
        "Grammar in Context",
        "Unseen Passage Practice",
    ],
    "Punjabi": [
        "ਪਾਠ ਪੜ੍ਹਨਾ ਅਤੇ ਸਮਝਣਾ",
        "ਵਿਆਕਰਣ ਦੀਆਂ ਮੂਲ ਧਾਰਨਾਵਾਂ",
        "ਲੇਖਣ ਕੁਸ਼ਲਤਾ",
        "ਸ਼ਬਦ ਭੰਡਾਰ",
        "ਕਵਿਤਾ ਅਤੇ ਸਾਹਿਤ",
    ],
    "Hindi": [
        "गद्य पाठ और बोधन",
        "व्याकरण — संज्ञा, सर्वनाम",
        "पत्र और निबंध लेखन",
        "शब्द भंडार विस्तार",
        "काव्य और साहित्य",
    ],
    "Social 1": [
        "History — Ancient Period",
        "The Medieval Era",
        "Colonial Rule and Independence",
        "Map Work and Timeline",
        "Revision and Questions",
    ],
    "Social 2": [
        "Geography — Physical Features",
        "Climate and Vegetation",
        "Civics — Government Structures",
        "Economics Basics",
        "Map Skills and Review",
    ],
    "GK": [
        "Current Affairs Overview",
        "India — States and Capitals",
        "Science in Everyday Life",
        "Famous Personalities",
        "Sports and Culture",
    ],
    "Computer Science": [
        "Introduction to Computing",
        "Hardware and Software",
        "Internet Safety and Ethics",
        "Basic Programming Concepts",
        "Practical Applications",
    ],
}

# Generic fallback for any subject not in the template
DEFAULT_LESSONS = [
    "Introduction to the Chapter",
    "Core Concepts",
    "Worked Examples",
    "Practice and Application",
    "Summary and Revision",
]

# Sample MCQ questions (generic — works for any subject)
SAMPLE_QUESTIONS = [
    {
        "text": "Which of the following best describes the main concept of this lesson?",
        "options": [
            {"text": "The first and most common misconception", "is_correct": False},
            {"text": "The correct foundational definition", "is_correct": True},
            {"text": "An unrelated concept from another field", "is_correct": False},
            {"text": "A partially correct but incomplete answer", "is_correct": False},
        ],
    },
    {
        "text": "What is the correct sequence of steps in the process described?",
        "options": [
            {"text": "Step 2 → Step 1 → Step 3 → Step 4", "is_correct": False},
            {"text": "Step 1 → Step 3 → Step 2 → Step 4", "is_correct": False},
            {"text": "Step 1 → Step 2 → Step 3 → Step 4", "is_correct": True},
            {"text": "Step 4 → Step 3 → Step 2 → Step 1", "is_correct": False},
        ],
    },
    {
        "text": "Which statement about the key principle is TRUE?",
        "options": [
            {"text": "It applies only in specific laboratory conditions", "is_correct": False},
            {"text": "It was disproved in recent studies", "is_correct": False},
            {"text": "It forms the foundation of this entire chapter", "is_correct": True},
            {"text": "It is an optional concept for advanced students only", "is_correct": False},
        ],
    },
    {
        "text": "What is the primary purpose of the example discussed in this chapter?",
        "options": [
            {"text": "To introduce a new, unrelated concept", "is_correct": False},
            {"text": "To illustrate and reinforce the main learning objective", "is_correct": True},
            {"text": "To provide historical background only", "is_correct": False},
            {"text": "To contradict the earlier theory", "is_correct": False},
        ],
    },
    {
        "text": "Which of the following is NOT a characteristic of the topic studied?",
        "options": [
            {"text": "It follows a predictable pattern", "is_correct": False},
            {"text": "It can be observed and measured", "is_correct": False},
            {"text": "It exists independently without any context", "is_correct": True},
            {"text": "It has practical real-world applications", "is_correct": False},
        ],
    },
]


class Command(BaseCommand):
    help = (
        "Seed shared curriculum content: one Course per Subject × Grade, "
        "5 Lessons per course, 1 Assessment with 5 questions per course."
    )

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding curriculum content...")

        subjects = list(Subject.objects.all())
        if not subjects:
            self.stdout.write(self.style.ERROR(
                "No subjects found. Run seed_punjab first."
            ))
            return

        courses_created = 0
        lessons_created = 0
        assessments_created = 0
        questions_created = 0

        for subject in subjects:
            lesson_titles = LESSON_TEMPLATES.get(subject.name, DEFAULT_LESSONS)

            for grade in GRADES:
                course, course_created = Course.objects.get_or_create(
                    subject=subject,
                    grade=grade,
                    defaults={
                        "title": f"{subject.name} — Class {grade}",
                        "description": (
                            f"Government-curated {subject.name} curriculum "
                            f"for Class {grade} students across Punjab."
                        ),
                        "is_core": True,
                    },
                )

                if course_created:
                    courses_created += 1

                # Create 5 lessons
                for i, lesson_title in enumerate(lesson_titles, start=1):
                    _, lesson_created = Lesson.objects.get_or_create(
                        course=course,
                        order=i,
                        defaults={
                            "title": lesson_title,
                            "content": (
                                f"# {lesson_title}\n\n"
                                f"This lesson covers **{lesson_title.lower()}** "
                                f"as part of the {subject.name} Class {grade} curriculum.\n\n"
                                f"## Learning Objectives\n\n"
                                f"By the end of this lesson, students will be able to:\n"
                                f"- Understand the core concepts of {lesson_title.lower()}\n"
                                f"- Apply the principles to practical problems\n"
                                f"- Relate this topic to real-world scenarios\n\n"
                                f"## Content\n\n"
                                f"*Content will be added by the administrator. "
                                f"This is a placeholder for the actual lesson material.*\n\n"
                                f"## Key Points\n\n"
                                f"1. First key point for this topic\n"
                                f"2. Second key point\n"
                                f"3. Third key point\n\n"
                                f"## Summary\n\n"
                                f"Review the key concepts covered in this lesson "
                                f"before attempting the assessment."
                            ),
                            "is_published": True,
                        },
                    )
                    if lesson_created:
                        lessons_created += 1

                # Create 1 assessment per course
                assessment, assessment_created = Assessment.objects.get_or_create(
                    course=course,
                    title=f"{subject.name} Class {grade} — Chapter Assessment",
                    defaults={
                        "description": (
                            f"Assessment covering the core concepts of "
                            f"{subject.name} for Class {grade}."
                        ),
                        "pass_marks": 3,
                        "is_published": True,
                    },
                )

                if assessment_created:
                    assessments_created += 1

                    for order, q_data in enumerate(SAMPLE_QUESTIONS, start=1):
                        question = Question.objects.create(
                            assessment=assessment,
                            text=q_data["text"],
                            marks=1,
                            order=order,
                        )
                        for opt in q_data["options"]:
                            QuestionOption.objects.create(
                                question=question,
                                text=opt["text"],
                                is_correct=opt["is_correct"],
                            )
                        questions_created += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nCurriculum seeded successfully:\n"
            f"  Courses created:     {courses_created}\n"
            f"  Lessons created:     {lessons_created}\n"
            f"  Assessments created: {assessments_created}\n"
            f"  Questions created:   {questions_created}\n"
            f"\nTotal in database:\n"
            f"  Courses:     {Course.objects.count()}\n"
            f"  Lessons:     {Lesson.objects.count()}\n"
            f"  Assessments: {Assessment.objects.count()}\n"
        ))