# apps/chatrooms/tests.py
"""
Chatrooms — Critical tests from TESTING_GUIDE.md.
Signal enrollment, membership gating, message permissions, notifications.
"""
import json
import pytest

from apps.chatrooms.models import ChatRoom, ChatRoomMember, ChatMessage, RoomType


@pytest.mark.django_db
class TestChatroomList:
    def test_list_authenticated(self, student_client):
        resp = student_client.get("/api/v1/chat/rooms/")
        assert resp.status_code == 200

    def test_list_anon(self, anon_client):
        resp = anon_client.get("/api/v1/chat/rooms/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestChatroomMembership:
    """Students only see rooms they're enrolled in."""

    def test_student_sees_only_enrolled_rooms(self, student_client, student_user, section, subject):
        # Create a room and enroll student
        room = ChatRoom.objects.create(
            room_type=RoomType.SUBJECT, section=section, subject=subject,
            name="Class 10A Maths",
        )
        ChatRoomMember.objects.create(room=room, user=student_user)
        # Create another room (student NOT enrolled)
        room2 = ChatRoom.objects.create(
            room_type=RoomType.STAFF, name="Staff Room", institution=section.classroom.institution,
        )
        resp = student_client.get("/api/v1/chat/rooms/")
        assert resp.status_code == 200
        data = resp.json()
        room_ids = [r["id"] for r in data]
        assert room.id in room_ids
        assert room2.id not in room_ids

    def test_student_cannot_access_unjoined_room(self, student_client, section, subject):
        room = ChatRoom.objects.create(
            room_type=RoomType.SUBJECT, section=section, subject=subject,
            name="Class 10A Physics",
        )
        resp = student_client.get(f"/api/v1/chat/rooms/{room.id}/history/")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestChatroomAdminAccess:
    """Admin/Teacher can access admin chat management."""

    def test_admin_list_rooms(self, admin_client):
        resp = admin_client.get("/api/v1/chat/admin/rooms/")
        assert resp.status_code == 200

    def test_student_admin_blocked(self, student_client):
        resp = student_client.get("/api/v1/chat/admin/rooms/")
        assert resp.status_code in (403, 404)


@pytest.mark.django_db
class TestChatroomSignals:
    """Signal: TeachingAssignment creates room + enrolls teacher."""

    def test_teaching_assignment_creates_room(self, teacher_user, section, subject):
        from apps.academics.models import TeachingAssignment
        teacher_user.institution = section.classroom.institution
        teacher_user.save()
        ta = TeachingAssignment.objects.create(
            teacher=teacher_user, section=section, subject=subject,
        )
        room = ChatRoom.objects.filter(
            room_type=RoomType.SUBJECT, section=section, subject=subject,
        ).first()
        assert room is not None
        assert ChatRoomMember.objects.filter(room=room, user=teacher_user).exists()

    def test_student_enrolled_after_section_assign(self, student_user, teacher_user, section, subject):
        from apps.academics.models import TeachingAssignment
        teacher_user.institution = section.classroom.institution
        teacher_user.save()
        TeachingAssignment.objects.create(
            teacher=teacher_user, section=section, subject=subject,
        )
        # Now assign student to section (triggers user save signal)
        student_user.section = section
        student_user.save()
        assert student_user.chat_memberships.count() >= 1

    def test_student_without_section_no_rooms(self, institution):
        from apps.accounts.models import User
        u = User.objects.create_user(
            username="nosection", password="x", role="STUDENT", institution=institution,
        )
        assert u.chat_memberships.count() == 0


@pytest.mark.django_db
class TestChatNotificationCreation:
    """_create_notification_records creates Notification for each member."""

    def test_notification_created_on_message(self, student_user, teacher_user, section, subject):
        from apps.chatrooms.views import _create_notification_records
        from apps.notifications.models import Notification
        room = ChatRoom.objects.create(
            room_type=RoomType.SUBJECT, section=section, subject=subject,
            name="Test Room",
        )
        ChatRoomMember.objects.create(room=room, user=teacher_user)
        ChatRoomMember.objects.create(room=room, user=student_user)
        msg = ChatMessage.objects.create(room=room, sender=teacher_user, content="Hello")
        before = Notification.objects.filter(user=student_user).count()
        _create_notification_records(room, msg, teacher_user)
        after = Notification.objects.filter(user=student_user).count()
        # Student should get a notification (sender doesn't)
        assert after > before

    def test_sender_skipped(self, teacher_user, section, subject):
        from apps.chatrooms.views import _create_notification_records
        from apps.notifications.models import Notification
        room = ChatRoom.objects.create(
            room_type=RoomType.SUBJECT, section=section, subject=subject,
            name="Test Room 2",
        )
        ChatRoomMember.objects.create(room=room, user=teacher_user)
        msg = ChatMessage.objects.create(room=room, sender=teacher_user, content="Hi")
        before = Notification.objects.filter(user=teacher_user).count()
        _create_notification_records(room, msg, teacher_user)
        after = Notification.objects.filter(user=teacher_user).count()
        assert after == before  # sender doesn't get notifications
