from django.apps import AppConfig
from django.db.models.signals import post_migrate
from django.dispatch import receiver


class AcademicsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.academics"

    def ready(self):
        # Connect signal only once
        from . import signals  # make sure signals are imported


@receiver(post_migrate, sender=AcademicsConfig)
def populate_initial_data(sender, **kwargs):
    """This runs ONLY after migrations, never during makemigrations"""
    from .models import District, Institution, Subject
    from .constants import PUNJAB_DISTRICTS, PUNJAB_GOVT_SCHOOLS, PUNJAB_SUBJECTS

    # Districts + Schools
    for district_name in PUNJAB_DISTRICTS:
        district, _ = District.objects.get_or_create(name=district_name)

        schools = PUNJAB_GOVT_SCHOOLS.get(district_name, [])
        for school_name in schools:
            Institution.objects.get_or_create(
                name=school_name,
                district=district,
                defaults={"is_government": True},
            )

    # Subjects
    for subject_name in PUNJAB_SUBJECTS:
        Subject.objects.get_or_create(name=subject_name)