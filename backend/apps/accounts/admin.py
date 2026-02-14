from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, Institution, ClassRoom


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "district", "created_at")
    search_fields = ("name",)


@admin.register(ClassRoom)
class ClassRoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "institution")
    list_filter = ("institution",)
    search_fields = ("name",)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Institution & Role", {"fields": ("role", "institution", "classroom")}),
    )

    list_display = (
        "username",
        "role",
        "institution",
        "classroom",
        "is_staff",
        "is_active",
    )

    list_filter = ("role", "institution", "classroom", "is_staff", "is_active")
    search_fields = ("username", "email")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """
        Restrict classroom dropdown based on institution.
        """

        if db_field.name == "classroom":
            if request.resolver_match.kwargs.get("object_id"):
                user_id = request.resolver_match.kwargs["object_id"]
                user = User.objects.filter(id=user_id).first()
                if user and user.institution:
                    kwargs["queryset"] = ClassRoom.objects.filter(
                        institution=user.institution
                    )

        return super().formfield_for_foreignkey(db_field, request, **kwargs)
