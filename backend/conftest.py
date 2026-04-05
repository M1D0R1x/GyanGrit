# conftest.py — Shared pytest fixtures for GyanGrit backend tests
"""
Reusable fixtures: district, institution, classroom, section, subject,
users (admin, teacher, principal, student), and authenticated clients.
"""
import pytest
from django.test import Client


@pytest.fixture
def district(db):
    from apps.academics.models import District
    return District.objects.create(name="Test District")


@pytest.fixture
def institution(db, district):
    from apps.academics.models import Institution
    return Institution.objects.create(name="Test School", district=district)


@pytest.fixture
def classroom(db, institution):
    from apps.academics.models import ClassRoom
    return ClassRoom.objects.create(name="10", institution=institution)


@pytest.fixture
def section(db, classroom):
    from apps.academics.models import Section
    return Section.objects.create(classroom=classroom, name="A")


@pytest.fixture
def subject(db):
    from apps.academics.models import Subject
    return Subject.objects.create(name="Mathematics")


@pytest.fixture
def admin_user(db, institution):
    from apps.accounts.models import User
    return User.objects.create_user(
        username="admin1", password="TestPass123!",
        role="ADMIN", institution=institution,
    )


@pytest.fixture
def teacher_user(db, institution):
    from apps.accounts.models import User
    return User.objects.create_user(
        username="teacher1", password="TestPass123!",
        role="TEACHER", institution=institution,
    )


@pytest.fixture
def principal_user(db, institution):
    from apps.accounts.models import User
    return User.objects.create_user(
        username="principal1", password="TestPass123!",
        role="PRINCIPAL", institution=institution,
    )


@pytest.fixture
def student_user(db, institution, section):
    from apps.accounts.models import User
    return User.objects.create_user(
        username="student1", password="TestPass123!",
        role="STUDENT", institution=institution, section=section,
    )


@pytest.fixture
def student_user2(db, institution, section):
    from apps.accounts.models import User
    return User.objects.create_user(
        username="student2", password="TestPass123!",
        role="STUDENT", institution=institution, section=section,
    )


@pytest.fixture
def admin_client(admin_user):
    c = Client(enforce_csrf_checks=False)
    c.login(username="admin1", password="TestPass123!")
    return c


@pytest.fixture
def teacher_client(teacher_user):
    c = Client(enforce_csrf_checks=False)
    c.login(username="teacher1", password="TestPass123!")
    return c


@pytest.fixture
def principal_client(principal_user):
    c = Client(enforce_csrf_checks=False)
    c.login(username="principal1", password="TestPass123!")
    return c


@pytest.fixture
def student_client(student_user):
    c = Client(enforce_csrf_checks=False)
    c.login(username="student1", password="TestPass123!")
    return c


@pytest.fixture
def anon_client():
    return Client(enforce_csrf_checks=False)


@pytest.fixture
def course(db, subject):
    from apps.content.models import Course
    return Course.objects.create(
        title="Math 10", subject=subject, grade=10,
    )


@pytest.fixture
def lesson(db, course):
    from apps.content.models import Lesson
    return Lesson.objects.create(
        course=course, title="Chapter 1", order=1, is_published=True,
    )


@pytest.fixture
def assessment(db, course):
    from apps.assessments.models import Assessment
    return Assessment.objects.create(
        course=course, title="Test Quiz", status="published", pass_marks=2,
    )


@pytest.fixture
def question(db, assessment):
    from apps.assessments.models import Question
    return Question.objects.create(
        assessment=assessment, text="What is 2+2?", marks=1, order=1,
    )


@pytest.fixture
def correct_option(db, question):
    from apps.assessments.models import QuestionOption
    return QuestionOption.objects.create(
        question=question, text="4", is_correct=True,
    )


@pytest.fixture
def wrong_option(db, question):
    from apps.assessments.models import QuestionOption
    return QuestionOption.objects.create(
        question=question, text="5", is_correct=False,
    )
