from django.apps import AppConfig


class AcademicsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.academics"

    def ready(self):
        # Register academic model signals (StudentSubject auto-assignment)
        from . import signals  # noqa: F401

        # Register post_migrate hook for seeding initial Punjab data.
        # Uses get_or_create so it is safe to run on every migrate.
        # Connects here (not at module level) to avoid duplicate registration
        # on multiple imports during Django startup.
        from django.db.models.signals import post_migrate
        post_migrate.connect(_populate_initial_data, sender=self)


def _populate_initial_data(sender, **kwargs):
    """
    Seeds Punjab districts, schools, and subjects after migrations.
    Runs after every `manage.py migrate` — safe because it uses get_or_create.
    Does NOT seed classrooms/sections — use `manage.py seed_punjab` for that.
    """
    from .models import District, Institution, Subject
    from .constants import (
        PUNJAB_DISTRICTS,
        PUNJAB_GOVT_SCHOOLS,
        PUNJAB_SUBJECTS,
    )

    for district_name in PUNJAB_DISTRICTS:
        district, _ = District.objects.get_or_create(name=district_name)

        for school_name in PUNJAB_GOVT_SCHOOLS.get(district_name, []):
            Institution.objects.get_or_create(
                name=school_name,
                district=district,
                defaults={"is_government": True},
            )

    for subject_name in PUNJAB_SUBJECTS:
        Subject.objects.get_or_create(name=subject_name)