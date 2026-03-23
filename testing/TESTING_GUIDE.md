# GyanGrit — Testing Guide

> **Last updated:** 2026-03-25
> Stack: Django 4.2 · PostgreSQL (Supabase) · React 18 + Vite + TypeScript

---

## Table of Contents

1. [Testing Strategy Overview](#1-testing-strategy-overview)
2. [What to Test (by area)](#2-what-to-test-by-area)
3. [Tool Recommendations by Test Type](#3-tool-recommendations-by-test-type)
4. [Backend — Django Unit + Integration Tests](#4-backend--django-unit--integration-tests)
5. [Frontend — React Component Tests](#5-frontend--react-component-tests)
6. [API Tests — Postman / Bruno](#6-api-tests--postman--bruno)
7. [End-to-End Tests — Playwright](#7-end-to-end-tests--playwright)
8. [Real-Time Tests — Ably + Chat](#8-real-time-tests--ably--chat)
9. [Security Tests](#9-security-tests)
10. [Performance Tests](#10-performance-tests)
11. [AI Agent Recommendations](#11-ai-agent-recommendations)
12. [Quick Manual Smoke Test Checklist](#12-quick-manual-smoke-test-checklist)

---

## 1. Testing Strategy Overview

GyanGrit has the following critical test boundaries:

| Layer | Risk if broken | Priority |
|---|---|---|
| Auth + session enforcement | Students see other students' data | 🔴 Critical |
| Role-based access control | STUDENT accesses TEACHER endpoints | 🔴 Critical |
| Chat room membership | Student sees rooms they shouldn't | 🔴 Critical |
| `is_correct` never exposed | Student gets quiz answers | 🔴 Critical |
| Signal enrollment (chat/competition) | Student misses rooms on registration | 🟠 High |
| Notification delivery | Teacher message not seen by student | 🟠 High |
| OTP login flow | Teacher/principal can't log in | 🟠 High |
| Ably token capability | Student subscribes to wrong channels | 🟠 High |
| Single-device enforcement | Two sessions active simultaneously | 🟡 Medium |
| Competition room lifecycle | Room stays in draft state | 🟡 Medium |
| Gradebook CRUD | Teacher loses grade entries | 🟡 Medium |
| TypeScript build | Vercel deployment fails | 🟡 Medium |

---

## 2. What to Test (by area)

### Backend apps to cover

```
accounts/     → registration, OTP, login, logout, single-session
academics/    → section assignment, teaching assignment signals
chatrooms/    → room creation, membership, message send, notification creation
competitions/ → room lifecycle, answer scoring, Ably token capability
assessments/  → is_correct never in student response, scoring accuracy
notifications/→ Notification.send(), unread count, mark read
gamification/ → point ledger, badge award
gradebook/    → entry CRUD, scoping to teacher's sections
```

### Frontend pages to cover

```
LoginPage, RegisterPage, VerifyOtpPage, CompleteProfilePage
DashboardPage, CoursesPage, LessonsPage, LessonPage
AssessmentTakePage (is_correct never shown)
ChatRoomPage (sidebar, send, reply, thread, notification toast)
CompetitionRoomPage (join, answer, leaderboard)
AdminChatManagementPage
```

---

## 3. Tool Recommendations by Test Type

| Test Type | Recommended Tool | Token Cost | Why |
|---|---|---|---|
| Django unit/integration | **pytest-django** (free, local) | None | Native, fast, no API calls |
| React components | **Vitest + Testing Library** (free, local) | None | Same Vite pipeline, no build step |
| API testing (manual+automated) | **Bruno** (free, open-source) | None | Better than Postman, offline, stores collections in git |
| End-to-end browser tests | **Playwright** (free, local) | None | Best E2E tool, TypeScript native |
| AI-assisted test writing | **Google Gemini 1.5 Pro** (free tier) | Gemini tokens | Best free model for writing test suites from code context |
| AI code review + tests | **OpenAI Codex** (via Cursor/Copilot) | OpenAI tokens | Good at pytest patterns |
| Security scanning | **Bandit** (Python, free) + **ESLint Security plugin** | None | Static analysis, no AI needed |
| Load/performance | **k6** (free, local) | None | Script-based, works with session auth |
| Database inspection | Supabase Dashboard + **pgAdmin** | None | Direct SQL queries |

> **Claude usage:** Only use Claude for small targeted fixes when tests fail unexpectedly. Write the bulk of tests using Gemini (free tier handles large context) or locally with Copilot.

---

## 4. Backend — Django Unit + Integration Tests

### Setup

```bash
cd backend
pip install pytest pytest-django pytest-cov factory-boy faker

# Create pytest.ini at backend/
cat > pytest.ini << 'EOF'
[pytest]
DJANGO_SETTINGS_MODULE = gyangrit.settings.dev
python_files = tests.py test_*.py *_test.py
python_classes = Test*
python_functions = test_*
EOF
```

### Run all backend tests

```bash
cd backend
pytest                          # run all
pytest apps/chatrooms/          # single app
pytest -k "test_send_message"   # single test by name
pytest --cov=apps --cov-report=html  # coverage report
```

### Key test files to write

**`backend/apps/accounts/tests.py`** — auth flow
```python
# What to test:
# - Student registration creates correct section assignment
# - Signal fires on section save → chat room enrollment
# - OTP generated and expires after 5 attempts
# - Single-device: second login invalidates first session
# - /api/v1/accounts/me/ returns correct role
```

**`backend/apps/chatrooms/tests.py`** — chat rooms (highest risk)
```python
# What to test:
# - TeachingAssignment signal creates subject room
# - Student signal enrolls in EXISTING rooms only (not all 12)
# - Student cannot access room they are not a member of (403)
# - Student cannot POST to message/ (top-level) — only reply
# - Teacher CAN post top-level
# - Admin can access any room
# - _create_notification_records creates Notification for each member
# - _push_chat_notification skips sender
```

**`backend/apps/assessments/tests.py`** — is_correct never exposed
```python
# What to test:
# - GET /api/v1/assessments/<id>/ as STUDENT → is_correct not in response
# - POST submit answer → is_correct not in response
# - Teacher CAN see is_correct via teacher endpoint
```

**`backend/apps/competitions/tests.py`** — Ably token scoping
```python
# What to test:
# - POST /realtime/token/ as STUDENT with channel_type=chat
#   → capability includes notifications:{user_id}
#   → capability includes chat:{room_id} for each membership
#   → capability does NOT include competition:*
# - POST /realtime/token/ as STUDENT with channel_type=competition
#   → capability includes competition:{room_id} only
```

### Sample test (chatrooms)

```python
# backend/apps/chatrooms/tests.py
from django.test import TestCase
from apps.accounts.models import User
from apps.academics.models import Institution, ClassRoom, Section, Subject, TeachingAssignment
from apps.chatrooms.models import ChatRoom, ChatRoomMember, RoomType

class ChatRoomSignalTest(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name="Test School")
        self.classroom   = ClassRoom.objects.create(name="10", institution=self.institution)
        self.section     = Section.objects.create(name="A", classroom=self.classroom)
        self.subject     = Subject.objects.create(name="Maths")
        self.teacher     = User.objects.create_user(
            username="t1", role="TEACHER",
            institution=self.institution, is_active=True
        )
        self.student = User.objects.create_user(
            username="s1", role="STUDENT", is_active=True
        )

    def test_teaching_assignment_creates_room(self):
        ta = TeachingAssignment.objects.create(
            teacher=self.teacher, section=self.section, subject=self.subject
        )
        room = ChatRoom.objects.filter(
            room_type=RoomType.SUBJECT, section=self.section, subject=self.subject
        ).first()
        self.assertIsNotNone(room)
        self.assertEqual(room.name, "Class 10A Maths")
        self.assertTrue(ChatRoomMember.objects.filter(room=room, user=self.teacher).exists())

    def test_student_only_enrolled_in_existing_rooms(self):
        # No teaching assignment yet — room does not exist
        self.student.section = self.section
        self.student.save()
        # Student should NOT be in any rooms (no TA = no rooms)
        self.assertEqual(self.student.chat_memberships.count(), 0)

    def test_student_enrolled_after_teaching_assignment(self):
        # First create the room via TA signal
        TeachingAssignment.objects.create(
            teacher=self.teacher, section=self.section, subject=self.subject
        )
        # Then assign student to section
        self.student.section = self.section
        self.student.save()
        self.assertEqual(self.student.chat_memberships.count(), 1)

    def test_student_cannot_access_unjoined_room(self):
        from django.test import RequestFactory
        from apps.chatrooms.views import message_history
        # Create room but don't enroll student
        room = ChatRoom.objects.create(
            room_type=RoomType.SUBJECT, section=self.section,
            subject=self.subject, name="Class 10A Maths"
        )
        factory = RequestFactory()
        request = factory.get(f"/api/v1/chat/rooms/{room.id}/history/")
        request.user = self.student
        response = message_history(request, room_id=room.id)
        self.assertEqual(response.status_code, 403)
```

### Using Gemini to write backend tests

1. Go to [aistudio.google.com](https://aistudio.google.com) (free)
2. Upload the file you want tests for (e.g. `chatrooms/views.py`)
3. Prompt: *"Write a complete Django TestCase for this file. Cover all view functions, test 403 for unauthorized access, test signal side effects, use factory_boy for fixtures. Use Django's TestCase not pytest."*
4. Copy output → paste into `tests.py` → run `pytest`

---

## 5. Frontend — React Component Tests

### Setup

```bash
cd frontend
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom

# Add to vite.config.ts:
# test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' }
```

Create `frontend/src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

### Run frontend tests

```bash
cd frontend
npx vitest              # watch mode
npx vitest run          # single run
npx vitest --coverage   # with coverage
npx vitest --ui         # browser UI
```

### Key tests to write

**`src/pages/__tests__/ChatRoomPage.test.tsx`**
```typescript
// What to test:
// - Sidebar renders when rooms.length > 1
// - Monitoring banner always visible
// - Student sees reply-only notice in subject rooms
// - Student has no top-level input bar
// - Teacher has input bar + file attach button
// - Toast appears when notif:new event fires
// - Thread panel opens on "X replies" click
```

**`src/pages/__tests__/AssessmentTakePage.test.tsx`**
```typescript
// What to test:
// - Options rendered without is_correct field
// - Submit button disabled until option selected
// - Cannot change answer after submission
```

### Sample test (ChatRoomPage sidebar)

```typescript
// frontend/src/pages/__tests__/ChatRoomPage.test.tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock services
vi.mock('../../services/chat', () => ({
  listChatRooms: vi.fn().mockResolvedValue([
    { id: 1, name: 'Class 10A Maths', room_type: 'subject', is_active: true, ably_channel: 'chat:1' },
    { id: 2, name: 'Class 10A Physics', room_type: 'subject', is_active: true, ably_channel: 'chat:2' },
  ]),
  getChatHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 4, role: 'STUDENT', username: 'student1' } }),
}));

test('sidebar shows when more than one room', async () => {
  render(<ChatRoomPage />);
  const sidebar = await screen.findByText('Rooms');
  expect(sidebar).toBeInTheDocument();
});

test('monitoring banner always visible', async () => {
  render(<ChatRoomPage />);
  const banner = await screen.findByText(/This chat is monitored/i);
  expect(banner).toBeInTheDocument();
});
```

### Using Gemini for frontend tests

Prompt: *"Write Vitest + Testing Library tests for this React component. Mock all service imports with vi.mock(). Test: sidebar visibility conditions, role-based UI differences (STUDENT vs TEACHER), empty states, error states."*

---

## 6. API Tests — Postman / Bruno

### Why Bruno over Postman

Bruno is open-source, stores collections as plain `.bru` files in your repo, works fully offline, and has no account requirement.

### Install Bruno

```bash
# macOS
brew install --cask bruno

# Or download from: https://www.usebruno.com/
```

### Setup collection

```
testing/bruno/
  ├── environments/
  │   ├── local.bru      (http://127.0.0.1:8000)
  │   └── production.bru (https://gyangrit.onrender.com)
  ├── auth/
  │   ├── login.bru
  │   ├── verify-otp.bru
  │   └── me.bru
  ├── chat/
  │   ├── list-rooms.bru
  │   ├── send-message.bru
  │   └── send-message-as-student-forbidden.bru
  └── assessments/
      ├── take-assessment.bru
      └── verify-no-is_correct.bru
```

### Critical API tests to write in Bruno

```
# 1. Auth flow
POST /api/v1/accounts/login/          → get sessionid cookie
POST /api/v1/accounts/login/verify-otp/ → set session

# 2. is_correct never in student response (highest risk)
GET /api/v1/assessments/<id>/         as STUDENT
  → assert response.questions[0].options[0] does NOT have "is_correct" key

# 3. Chat room access control
GET /api/v1/chat/rooms/<id>/history/  as STUDENT not in room → expect 403
GET /api/v1/chat/rooms/<id>/history/  as STUDENT in room    → expect 200

# 4. Student cannot post top-level message
POST /api/v1/chat/rooms/<id>/message/ as STUDENT (no parent_id) → expect 403

# 5. Ably token capability
POST /api/v1/realtime/token/ as STUDENT { channel_type: "chat" }
  → assert token.capability has "notifications:{user_id}"
  → assert token.capability does NOT have "competition:*"

# 6. Admin can see all rooms, student only sees their own
GET /api/v1/chat/rooms/ as ADMIN    → contains official room
GET /api/v1/chat/rooms/ as STUDENT  → only rooms they're enrolled in
```

### Bruno test script example (inline)

```javascript
// In Bruno test tab for "verify-no-is_correct.bru"
test("is_correct not in student options response", function() {
  const data = res.getBody();
  const questions = data.questions || [];
  questions.forEach(q => {
    q.options.forEach(opt => {
      expect(opt).not.toHaveProperty("is_correct");
    });
  });
});
```

---

## 7. End-to-End Tests — Playwright

Playwright tests the full browser flow — real login, real navigation, real UI interactions.

### Install

```bash
cd frontend  # or project root
npm install --save-dev @playwright/test
npx playwright install chromium  # lightweight, just install Chromium
```

Create `playwright.config.ts` at project root:
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './testing/e2e',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
  },
});
```

### Run E2E tests

```bash
# Start backend + frontend first, then:
npx playwright test                     # run all
npx playwright test --headed            # watch in browser
npx playwright test auth.spec.ts        # single file
npx playwright codegen http://localhost:5173  # RECORD new tests by clicking
```

### Key E2E scenarios

```typescript
// testing/e2e/auth.spec.ts
test('student can log in and see dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=username]', 'student1');
  await page.fill('[name=password]', 'GyanGrit@2024');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');
  expect(page.url()).toContain('/dashboard');
});

// testing/e2e/chat.spec.ts
test('student sees monitoring banner in chat', async ({ page }) => {
  // login as student1 first...
  await page.goto('/chat');
  await expect(page.getByText(/This chat is monitored/)).toBeVisible();
});

test('teacher can send message, student sees bell update', async ({ browser }) => {
  // Two browser contexts — teacher + student simultaneously
  const teacherCtx = await browser.newContext();
  const studentCtx = await browser.newContext();
  // ... login both, teacher sends, student bell increments
});
```

### Use Playwright Codegen (easiest way to write tests)

```bash
npx playwright codegen http://localhost:5173
```
This opens a browser where you just **click through the app normally** and it generates the TypeScript test code automatically. Best way to build your test suite without writing from scratch.

---

## 8. Real-Time Tests — Ably + Chat

### Test Ably token has correct capability

```bash
cd backend
python3 manage.py shell -c "
from apps.accounts.models import User
from apps.chatrooms.models import ChatRoomMember

student = User.objects.get(username='student1')
room_ids = list(ChatRoomMember.objects.filter(user=student).values_list('room_id', flat=True))
print('Student rooms:', room_ids)
print('Expected capability keys:')
for rid in room_ids:
    print(f'  chat:{rid}')
print(f'  notifications:{student.id}')
"
```

### Test message → notification pipeline

```bash
cd backend
python3 manage.py shell -c "
from apps.chatrooms.models import ChatRoom, ChatMessage
from apps.accounts.models import User
from apps.chatrooms.views import _create_notification_records
from apps.notifications.models import Notification

teacher  = User.objects.get(username='teacher1')
student  = User.objects.get(username='student1')
room     = teacher.chat_memberships.first().room
before   = Notification.objects.filter(user=student).count()

msg = ChatMessage.objects.create(room=room, sender=teacher, content='Test message')
_create_notification_records(room, msg, teacher)

after = Notification.objects.filter(user=student).count()
print(f'Notifications: {before} → {after}  (created: {after - before})')

# Cleanup
msg.delete()
Notification.objects.filter(user=student, message__contains='Test message').delete()
"
```

### Test Ably HTTP publish

```bash
cd backend
python3 manage.py shell -c "
from apps.chatrooms.views import _push_chat_notification
from apps.chatrooms.models import ChatRoom, ChatMessage
from apps.accounts.models import User

teacher = User.objects.get(username='teacher1')
room    = teacher.chat_memberships.filter(room__room_type='subject').first().room
msg     = type('msg', (), {'content': 'test', 'attachment_url': None})()
result  = _push_chat_notification(room, msg, teacher)
print('Ably publish result (check backend logs for errors)')
"
```

---

## 9. Security Tests

### Bandit — Python static analysis

```bash
pip install bandit
cd backend
bandit -r apps/ -f txt -o ../testing/bandit_report.txt
cat ../testing/bandit_report.txt
```

Key issues to look for:
- B106: hardcoded passwords
- B324: weak hash algorithms  
- B501/B502: insecure SSL usage
- B608: SQL injection risks

### ESLint security plugin

```bash
cd frontend
npm install --save-dev eslint-plugin-security
# Add to eslint config: plugins: ['security']
npx eslint src/ --rule 'security/detect-object-injection: warn'
```

### Manual security checklist

Run these curl commands against local backend:

```bash
BASE=http://127.0.0.1:8000

# 1. Unauthenticated access → should return 302 or 401/403
curl -s $BASE/api/v1/chat/rooms/ | python3 -m json.tool

# 2. Student accessing teacher endpoint → should return 403
# (login as student first, copy sessionid cookie)
COOKIE="gyangrit_sessionid=YOUR_STUDENT_SESSION"
curl -s -H "Cookie: $COOKIE" $BASE/api/v1/chat/admin/rooms/ | python3 -m json.tool

# 3. is_correct never in assessment response as student
curl -s -H "Cookie: $COOKIE" $BASE/api/v1/assessments/ | python3 -c "
import json,sys
data = json.load(sys.stdin)
# Check no option has is_correct
found = False
for item in data if isinstance(data, list) else [data]:
    for q in item.get('questions', []):
        for opt in q.get('options', []):
            if 'is_correct' in opt:
                print('SECURITY FAIL: is_correct exposed to student!')
                found = True
if not found:
    print('PASS: is_correct not in student response')
"
```

---

## 10. Performance Tests

### k6 — load testing

```bash
# Install k6: https://k6.io/docs/get-started/installation/
brew install k6

# Create testing/k6/load_test.js
```

```javascript
// testing/k6/load_test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,         // 10 virtual users
  duration: '30s', // for 30 seconds
};

export default function () {
  // Health check
  const r1 = http.get('https://gyangrit.onrender.com/api/v1/health/');
  check(r1, { 'health 200': (r) => r.status === 200 });

  // Simulate authenticated list rooms (replace with real session cookie)
  const headers = { Cookie: 'gyangrit_sessionid=YOUR_SESSION' };
  const r2 = http.get('https://gyangrit.onrender.com/api/v1/chat/rooms/', { headers });
  check(r2, { 'rooms 200': (r) => r.status === 200 });

  sleep(1);
}
```

```bash
k6 run testing/k6/load_test.js
```

---

## 11. AI Agent Recommendations

### For writing backend (Django) tests

**Best: Google Gemini 1.5 Pro** (free at [aistudio.google.com](https://aistudio.google.com))
- Has 1M token context window — paste entire `views.py` + `models.py`
- Prompt: *"Write complete Django TestCase classes for these views. Cover: auth required, role restrictions (403 for wrong role), success cases, signal side effects, edge cases. Use Django's `TestCase` and `RequestFactory`. Do not use mocks unless absolutely necessary — prefer real DB objects."*
- Good output quality, handles complex Django ORM correctly

**Alternative: Cursor with GPT-4o** (if you have Cursor)
- Open `views.py`, press Cmd+K: *"Write tests for this file"*
- Understands project context from open files

**For small fixes when tests fail: Claude free tier**
- Paste the failing test + error → ask for the fix only
- Don't ask it to write entire test suites (wastes tokens)

### For writing frontend (Vitest) tests

**Best: Gemini 1.5 Pro**
- Paste the `.tsx` component file
- Prompt: *"Write Vitest + React Testing Library tests. Mock all imports using vi.mock(). Test rendering, user interactions with userEvent, role-based conditional rendering. The auth context is accessed via useAuth() hook."*

**Alternative: GitHub Copilot** (if you have it)
- Open the test file, start typing `test('` and Copilot will autocomplete based on the component it can see in the editor

### For E2E (Playwright) tests

**Best: Use Playwright Codegen** (no AI needed)
```bash
npx playwright codegen http://localhost:5173
```
Just click through the flows you want to test. It records TypeScript automatically. Fastest approach with zero AI tokens spent.

**Then use Gemini to refine:** Paste the recorded test and ask: *"Add assertions for: bell count changes, error states, loading states"*

### For security analysis

**Best: Bandit (local) + Claude for fix guidance**
Run Bandit to find issues, then paste only the flagged code to Claude free tier for the fix.

### Summary table

| Task | Use This | Cost |
|---|---|---|
| Write Django test suites | Gemini 1.5 Pro (aistudio.google.com) | Free |
| Write React/Vitest tests | Gemini 1.5 Pro | Free |
| Record E2E tests | Playwright Codegen (local) | Free |
| Fix a failing test | Claude free tier | Free |
| Security static analysis | Bandit (Python) / ESLint | Free |
| Load testing | k6 (local) | Free |
| API collection | Bruno (local) | Free |

---

## 12. Quick Manual Smoke Test Checklist

Run this after every deployment to catch regressions fast.

### Auth (5 min)

- [ ] Student can register with join code → lands on complete-profile
- [ ] Student logs in with username/password → lands on dashboard
- [ ] Teacher logs in → OTP sent → verify OTP → lands on teacher dashboard
- [ ] Second login from different tab/browser invalidates first session

### Chat (5 min)

- [ ] Student with 12 rooms sees sidebar with room names
- [ ] Monitoring banner visible in every room
- [ ] Student sees only "Tap Reply" hint, no top-level input
- [ ] Teacher types message → student's bell badge increments
- [ ] Student clicks bell → sees "New message in Class 10A Maths"
- [ ] Teacher message appears in student notification panel
- [ ] Thread opens when clicking "X replies"

### Assessment (3 min)

- [ ] Student opens assessment → options visible, no `is_correct` field
- [ ] Student submits answer → gets result page, no correct/incorrect shown before time
- [ ] Teacher opens same assessment → can see correct answers

### Competition (3 min)

- [ ] Teacher creates room → status shows "Lobby"
- [ ] Student joins → appears in participant list
- [ ] Teacher starts → room status changes to "Live"
- [ ] Student answers → leaderboard updates

### Notifications (2 min)

- [ ] Bell shows correct unread count
- [ ] Mark all read → count goes to 0
- [ ] New chat message → bell updates without page refresh

---

## Running Everything Together

```bash
# Terminal 1: Backend
cd backend && python3 manage.py runserver

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Run tests
cd backend && pytest apps/ -v              # Django tests
cd frontend && npx vitest run              # React tests
npx playwright test                        # E2E tests
```

---

*For questions about specific test patterns, refer to the relevant skill files in `/mnt/skills/user/`.*
