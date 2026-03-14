import logging

from apps.academics.models import ClassRoom, Section, TeachingAssignment

logger = logging.getLogger(__name__)


def assign_teacher_to_classes(teacher, subject, institution):
    """
    Creates TeachingAssignment records for a teacher across all
    sections of grades 6-10 in the given institution.

    Called from:
    - accounts/views.py register() when a TEACHER registers via join code
    - accounts/admin.py UserAdmin.save_model() when admin creates a teacher

    Using a shared service ensures both paths stay in sync if the
    grade range or assignment logic ever changes.

    Args:
        teacher:     User instance with role=TEACHER
        subject:     Subject instance to assign
        institution: Institution instance the teacher belongs to

    Returns:
        int: number of new TeachingAssignment records created
    """
    classrooms = ClassRoom.objects.filter(
        institution=institution,
        name__in=["6", "7", "8", "9", "10"],
    )

    created_count = 0

    for classroom in classrooms:
        sections = Section.objects.filter(classroom=classroom)
        for section in sections:
            _, created = TeachingAssignment.objects.get_or_create(
                teacher=teacher,
                subject=subject,
                section=section,
            )
            if created:
                created_count += 1

    logger.info(
        "assign_teacher_to_classes: teacher id=%s assigned to %d new sections "
        "for subject '%s' in institution '%s'.",
        teacher.id,
        created_count,
        subject.name,
        institution.name,
    )

    return created_count