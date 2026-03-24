# GyanGrit — Data Model Reference

> **Status: Updated 2026-03-26**
> Covers all 16 backend apps. Every model, field, and constraint is documented.

---

## Apps 1–9 (accounts, academics, content, assessments, learning, gamification, notifications, gradebook, roster)

See previous sections — these models are unchanged from 2026-03-18.
Full documentation of these models is in the git history.

---

## 10. Competitions App

### CompetitionRoom
| Field | Type | Notes |
|---|---|---|
| `title` | CharField | |
| `host` | FK → User | Teacher who created it |
| `section` | FK → Section | The class this competition is for |
| `assessment` | FK → Assessment | Questions come from here |
| `status` | CharField | `draft`, `active`, `finished` |
| `created_at` | DateTimeField | |

Status machine: `draft → active` (via `POST /start/`) `→ finished` (via `POST /finish/`).

### CompetitionParticipant
| Field | Type | Notes |
|---|---|---|
| `room` | FK → CompetitionRoom | |
| `student` | FK → User | |
| `score` | IntegerField | Recalculated after each answer |
| `rank` | IntegerField | Recalculated after each answer |
| `joined_at` | DateTimeField | |

Unique constraint: `(room, student)`.

### CompetitionAnswer
| Field | Type | Notes |
|---|---|---|
| `participant` | FK → CompetitionParticipant | |
| `question` | FK → Question | |
| `selected_option` | FK → QuestionOption | |
| `is_correct` | BooleanField | **NEVER sent to student-facing endpoints** |
| `answered_at` | DateTimeField | |

**Security invariant:** `is_correct` follows the same rule as `QuestionOption.is_correct` — never in any student-facing API response.

---

## 11. Chat Rooms App

### ChatRoom
| Field | Type | Notes |
|---|---|---|
| `room_type` | CharField | `subject`, `staff`, `officials` |
| `name` | CharField | e.g. "Class 10A Computer Science", "School — Staff" |
| `section` | FK → Section | For `subject` rooms only |
| `subject` | FK → Subject | For `subject` rooms only |
| `institution` | FK → Institution | For `staff` rooms only |
| `is_active` | BooleanField | Inactive rooms reject new messages |
| `created_at` | DateTimeField | |

Unique constraints:
- One `subject` room per `(section, subject)` pair
- One `staff` room per `institution`

**Creation rule:** Rooms are created ONLY by `TeachingAssignment.post_save` signal. Students never trigger room creation. This prevents phantom rooms.

### ChatRoomMember
Explicit membership table. This is the single source of truth for who is in which room.

| Field | Type | Notes |
|---|---|---|
| `room` | FK → ChatRoom | |
| `user` | FK → User | |
| `joined_at` | DateTimeField | |

Unique constraint: `(room, user)`.

**Why explicit membership?**
Without this, we cannot know who to notify on a new message, cannot show member counts, and cannot efficiently check access (one DB lookup vs complex role-based reconstruction).

### ChatMessage
| Field | Type | Notes |
|---|---|---|
| `room` | FK → ChatRoom | |
| `sender` | FK → User | |
| `content` | TextField | Up to 2,000 chars |
| `attachment_url` | URLField | R2 URL, nullable |
| `attachment_type` | CharField | `image` or `file`, nullable |
| `attachment_name` | CharField | Original filename, nullable |
| `parent` | FK → self | Nullable — set for replies; null for top-level |
| `is_pinned` | BooleanField | Teacher/admin can pin messages |
| `sent_at` | DateTimeField | Indexed |

Thread model: top-level messages have `parent=None`. Replies have `parent=<top-level message>`. Nested replies not supported (max 2 levels: message → reply).

---

## 12. Flashcards App

### FlashcardDeck
| Field | Type | Notes |
|---|---|---|
| `title` | CharField | |
| `description` | TextField | Optional |
| `subject` | FK → Subject | Deck is scoped to this subject |
| `section` | FK → Section | Optional — null means visible to all sections of this subject |
| `created_by` | FK → User | The teacher who created it |
| `is_published` | BooleanField | Only published decks visible to students |
| `created_at` | DateTimeField | |

### Flashcard
| Field | Type | Notes |
|---|---|---|
| `deck` | FK → FlashcardDeck | |
| `front` | TextField | Question / term |
| `back` | TextField | Answer / definition |
| `hint` | CharField | Optional hint shown before reveal |
| `order` | PositiveIntegerField | Display order within deck |
| `created_at` | DateTimeField | |

### FlashcardProgress
SM-2 algorithm state per student per card. Created on first review.

| Field | Type | Notes |
|---|---|---|
| `student` | FK → User | |
| `card` | FK → Flashcard | |
| `repetitions` | PositiveIntegerField | Number of successful reviews |
| `ease_factor` | FloatField | Default 2.5, min 1.3 — how easy the card feels |
| `interval` | PositiveIntegerField | Days until next review |
| `next_review` | DateField | Indexed — used to find "due today" cards |
| `total_reviews` | PositiveIntegerField | Total times reviewed |
| `correct_count` | PositiveIntegerField | Times rated ≥ 2 |
| `last_reviewed` | DateTimeField | Nullable |

Unique constraint: `(student, card)`.

**SM-2 algorithm (`apply_rating(quality)`):**
- `quality=0,1` (wrong) → reset `repetitions=0`, `interval=1`
- `quality=2,3` (correct) → `interval *= ease_factor`, `repetitions += 1`
- `ease_factor += 0.1 - (3-q) * (0.08 + (3-q) * 0.02)`, min 1.3
- `next_review = today + interval days`

---

## 13. Live Sessions App

### LiveSession
| Field | Type | Notes |
|---|---|---|
| `title` | CharField | |
| `section` | FK → Section | The class this session is for |
| `subject` | FK → Subject | Optional — general class or subject-specific |
| `teacher` | FK → User | Who hosts it |
| `status` | CharField | `scheduled`, `live`, `ended` |
| `livekit_room_name` | CharField | Unique — `gyangrit-{section_id}-{uuid8}` |
| `scheduled_at` | DateTimeField | When it's planned |
| `started_at` | DateTimeField | Null until teacher clicks Start |
| `ended_at` | DateTimeField | Null until teacher clicks End |
| `description` | TextField | Optional |
| `created_at` | DateTimeField | |

`livekit_room_name` is the room identifier in LiveKit Cloud. Unique across the platform.

### LiveAttendance
| Field | Type | Notes |
|---|---|---|
| `session` | FK → LiveSession | |
| `student` | FK → User | |
| `joined_at` | DateTimeField | When they joined |
| `left_at` | DateTimeField | Nullable — when they left |
| `is_present` | BooleanField | Default True on join |

Unique constraint: `(session, student)`. Created automatically when student calls `join/`.

---

## 14. AI Assistant App

### ChatConversation
One conversation session per student per subject.

| Field | Type | Notes |
|---|---|---|
| `student` | FK → User | |
| `subject` | FK → Subject | Optional — null for general questions |
| `started_at` | DateTimeField | |
| `updated_at` | DateTimeField | Auto-updated |

### AIChatMessage
Individual message within a conversation.

| Field | Type | Notes |
|---|---|---|
| `conversation` | FK → ChatConversation | |
| `role` | CharField | `user` or `assistant` |
| `content` | TextField | The message text |
| `created_at` | DateTimeField | Indexed |

**Why persist conversations?**
- Students can resume previous conversations
- Teachers can see what questions students are asking (future analytics)
- Context window management — last N messages sent to Gemini

---

## 15. Key Constraints Summary (updated)

| Constraint | Where Enforced |
|---|---|
| Chat room only created by TeachingAssignment signal | `chatrooms/signals.py` — student signal never creates rooms |
| Student only enrolled in existing chat rooms | `chatrooms/signals.py` handle_user_save — uses filter(), not get_or_create |
| Admin bypasses chat room membership check | `_user_can_access_room()` — explicit `if user.role == "ADMIN"` |
| `is_correct` never in student competition response | `CompetitionAnswer` never serialised to student endpoints |
| Student LiveKit token `canPublish=False` | `_make_livekit_token(can_publish=False)` for STUDENT role |
| Student Ably token scoped to enrolled rooms only | `ably_token` view enumerates `ChatRoomMember` for student |
| Flashcard progress deduplication | `unique_together (student, card)` + `apply_rating()` always updates |
| SM-2 ease_factor minimum | `max(1.3, ...)` in `apply_rating()` — prevents ease factor going too low |
| One LiveKit room name per session | `livekit_room_name` unique constraint |
| AI responses curriculum-scoped | Gemini system prompt blocks off-topic responses |
| CONN_MAX_AGE=0 in prod | gevent + persistent connections = thread-sharing crash |
