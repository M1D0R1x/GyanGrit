from django.core.management.base import BaseCommand
from django.db import transaction

from apps.academics.models import (
    District,
    Institution,
    ClassRoom,
    Section,
    Subject,
    ClassSubject,
)

from apps.academics.constants import (
    PUNJAB_DISTRICTS,
    PUNJAB_GOVT_SCHOOLS,
    PUNJAB_SUBJECTS,
)


class Command(BaseCommand):
    help = "Populate Punjab districts, schools, classes, sections, and subjects"

    @transaction.atomic
    def handle(self, *args, **kwargs):

        self.stdout.write("Seeding Punjab academic structure...")

        # Create subjects once
        subjects = []
        for name in PUNJAB_SUBJECTS:
            subject, _ = Subject.objects.get_or_create(name=name)
            subjects.append(subject)

        # Create districts → schools → classes → sections → subject mapping
        for district_name in PUNJAB_DISTRICTS:

            district, _ = District.objects.get_or_create(name=district_name)

            schools = PUNJAB_GOVT_SCHOOLS.get(district_name, [])

            for school_name in schools:

                institution, _ = Institution.objects.get_or_create(
                    name=school_name,
                    district=district,
                    defaults={"is_government": True},
                )

                for grade in range(6, 11):

                    classroom, _ = ClassRoom.objects.get_or_create(
                        name=str(grade),
                        institution=institution,
                    )

                    Section.objects.get_or_create(
                        name="A",
                        classroom=classroom,
                    )

                    for subject in subjects:
                        ClassSubject.objects.get_or_create(
                            classroom=classroom,
                            subject=subject,
                        )

        self.stdout.write(self.style.SUCCESS("Punjab data seeded successfully."))