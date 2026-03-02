from django.apps import AppConfig


class AcademicsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.academics"

    def ready(self):
        from .models import District, Institution, Subject
        from .constants import PUNJAB_DISTRICTS, PUNJAB_GOVT_SCHOOLS, PUNJAB_SUBJECTS
        from . import signals  # ← THIS WAS MISSING! Signals were never connecting before

        # Districts + Government Schools (your original code)
        for district_name in PUNJAB_DISTRICTS:
            district, _ = District.objects.get_or_create(
                name=district_name
            )

            schools = PUNJAB_GOVT_SCHOOLS.get(district_name, [])

            for school_name in schools:
                Institution.objects.get_or_create(
                    name=school_name,
                    district=district,
                    defaults={"is_government": True},
                )

        # NEW: Pre-populate Subjects (PUNJAB_SUBJECTS was defined but never used)
        for subject_name in PUNJAB_SUBJECTS:
            Subject.objects.get_or_create(name=subject_name)