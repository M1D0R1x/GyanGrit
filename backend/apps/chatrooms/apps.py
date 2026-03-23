from django.apps import AppConfig


class ChatroomsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.chatrooms"

    def ready(self):
        import apps.chatrooms.signals  # noqa: F401
