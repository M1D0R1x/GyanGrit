# GyanGrit — Critical Security Tests
# Run manually against local backend. These verify the highest-risk scenarios.

BASE="http://127.0.0.1:8000"

echo "=== GyanGrit Security Smoke Tests ==="
echo ""

# ─────────────────────────────────────────────────────────────────
# 1. Unauthenticated access to protected endpoint
# ─────────────────────────────────────────────────────────────────
echo "TEST 1: Unauthenticated access to chat rooms"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/chat/rooms/")
if [ "$STATUS" = "403" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "401" ]; then
  echo "  PASS: Got $STATUS (access denied)"
else
  echo "  FAIL: Got $STATUS (expected 401/403/302)"
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# 2. Unauthenticated access to admin endpoint
# ─────────────────────────────────────────────────────────────────
echo "TEST 2: Unauthenticated access to admin chat management"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/chat/admin/rooms/")
if [ "$STATUS" = "403" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "401" ]; then
  echo "  PASS: Got $STATUS (access denied)"
else
  echo "  FAIL: Got $STATUS (expected 401/403/302)"
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# Instructions for authenticated tests
# ─────────────────────────────────────────────────────────────────
echo "=== For authenticated tests ==="
echo ""
echo "1. Log in via browser as student1"
echo "2. Open DevTools → Application → Cookies"
echo "3. Copy gyangrit_sessionid value"
echo "4. Set STUDENT_SESSION=<value> in your shell"
echo "5. Run:"
echo ""
echo '   # is_correct not exposed to student'
echo '   curl -s -H "Cookie: gyangrit_sessionid=$STUDENT_SESSION" \'
echo '        http://127.0.0.1:8000/api/v1/assessments/ | \'
echo '        python3 -c "import json,sys; data=json.load(sys.stdin); \'
echo '        [print(\"FAIL\" if \"is_correct\" in opt else \"PASS\", opt) \'
echo '        for item in (data if isinstance(data,list) else [data]) \'
echo '        for q in item.get(\"questions\",[]) for opt in q.get(\"options\",[])]"'
echo ""
echo '   # Student cannot access admin endpoint (expect 403)'
echo '   curl -s -H "Cookie: gyangrit_sessionid=$STUDENT_SESSION" \'
echo '        http://127.0.0.1:8000/api/v1/chat/admin/rooms/'
echo ""
echo '   # Student cannot post top-level chat message (expect 403)'
echo '   curl -s -X POST \'
echo '        -H "Cookie: gyangrit_sessionid=$STUDENT_SESSION" \'
echo '        -H "Content-Type: application/json" \'
echo '        -H "X-CSRFToken: $CSRF_TOKEN" \'
echo '        -d "{\"content\": \"test\"}" \'
echo '        http://127.0.0.1:8000/api/v1/chat/rooms/9/message/'
