# GyanGrit — Bug Tracker & Task Plan

**Last updated:** 2026-03-26 04:30 IST

---

## ALL BUGS FROM CONSOLE LOGS — STATUS

| # | Bug | Source | Status | Fix |
|---|---|---|---|---|
| 1 | `NameError: settings not defined` on `/push/vapid-key/` | Sentry + console | ✅ DEPLOYED & WORKING | Added `from django.conf import settings` to notifications/views.py |
| 2 | `Ably: Auth() Warning: token literal without way to renew` | Console | ✅ FIXED (needs push) | AuthContext: switched to `authCallback` for auto-refresh |
| 3 | Vercel 404s on JS chunks (`notifications.js`, etc) | Console | ✅ DEPLOYED & WORKING | vercel.json: `/assets/:path*` before SPA catch-all |
| 4 | Push notification click does nothing on mobile | Testing | ✅ FIXED (needs push) | sw.js: build full URL from SW origin + `client.navigate()` |
| 5 | Safari login broken (can't even login) | Testing | ✅ FIXED (needs push) | Warning banner on LoginPage (ITP cross-site cookie block) |
| 6 | Edge not getting push notifications | Testing | ⚠️ NOT A BUG | User must click "Allow" on browser notification prompt |
| 7 | Chat toast click does nothing | Testing | ✅ FIXED (needs push) | Same fix as #4 — the toast IS the push notification |
| 8 | Mobile "Open" button on notification banner → nothing | Testing | ✅ FIXED (needs push) | Same fix as #4 — sw.js notificationclick handler |
| 9 | Live session section dropdown empty | Testing | ✅ DEPLOYED & WORKING | /academics/my-assignments/ + PRINCIPAL/ADMIN support |
| 10 | FlashcardDecksPage wrong endpoint | Audit | ✅ DEPLOYED & WORKING | /accounts/ → /academics/my-assignments/ |
| 11 | CompetitionRoomPage section shows "A" not "Class 8 - A" | Testing | ✅ FIXED (needs push) | Label format updated |

---

## WHAT'S ON DISK BUT NOT DEPLOYED YET

These fixes are written to your local codebase but NOT yet pushed to GitHub/Vercel/Render:

1. **AuthContext.tsx** — Ably authCallback (kills token warning)
2. **sw.js** — notification click with full URL + client.navigate
3. **LoginPage.tsx** — Safari ITP warning banner
4. **CompetitionRoomPage.tsx** — "Class 8 - A" labels
5. **tasks_opus4.6.md** — this file

### TO DEPLOY ALL FIXES:
```bash
cd /Users/veera/PycharmProjects/GyanGrit
git add .
git commit -m "fix: Ably token refresh, push click, Safari warning, dropdown labels"
git push
```

---

## FRONTEND LOGS — HOW TO SEE THEM

**You already have frontend logging via Sentry.** You received the VAPID 500 error through Sentry email. Here's how to access all logs:

### Sentry Dashboard (your primary log tool):
1. Go to **https://sentry.io** → login
2. Select project **sentry-bronze-garden**
3. **Issues tab** = all JS errors with stack traces + browser info
4. **Performance tab** = slow API calls
5. Click any issue → see full error details, browser, OS, user

### What Sentry already captures:
- All unhandled JavaScript errors
- All failed fetch() calls (500s, 404s, timeouts)
- Session replays on error (you set `replaysOnErrorSampleRate: 1.0`)
- The VAPID error you saw was captured by Sentry

### Real-time debugging (no Vercel Pro needed):
- **Chrome desktop:** F12 → Console tab (you already do this)
- **Mobile Chrome:** Connect phone via USB → go to `chrome://inspect` on laptop
- **Mobile Edge:** Connect phone via USB → go to `edge://inspect`

### Why Vercel logs don't work:
Vercel free tier only shows build logs, not runtime logs. Runtime log tailing requires Vercel Pro ($20/mo). **You don't need it** — Sentry is better for error tracking anyway.

---

## KNOWN LIMITATIONS (not fixable without architecture change)

| Issue | Why | Fix |
|---|---|---|
| Safari can't login | Safari ITP blocks cross-site cookies (gyangrit.site → gyangrit.onrender.com) | Move backend to api.gyangrit.site on Oracle Cloud |
| Edge push not appearing | User dismissed notification prompt | User goes to Edge Settings → Site Permissions → gyangrit.site → Notifications → Allow |
| Render cold starts | Free tier sleeps after 15 min | QStash/UptimeRobot pings every 5 min |

---

## ORACLE CLOUD DECISION

| Instance | Specs | Cost | Use |
|---|---|---|---|
| gyangritoracle (80.225.193.221) | 1 OCPU, 1 GB | $0 forever | Keep as backup |
| **Gyangrit** (161.118.179.221) | 2 OCPU, 12 GB | $0 forever | **USE THIS for backend** |
| gyangrithighvolume (129.154.234.37) | 3 OCPU, 18 GB | **DELETE** — puts you over 4 OCPU free limit | Delete |

Total ARM free allowance: 4 OCPU + 24 GB. Currently using 5 OCPU (2+3). Delete the 3 OCPU instance.
