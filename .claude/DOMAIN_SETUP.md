# GyanGrit — Domain Setup & Business Email Guide

**Domain:** `gyangrit.site` (purchased on Namecheap)
**Date:** 2026-03-26

---

## Step 1: Update Render Environment Variables

Go to Render Dashboard → gyangrit service → Environment → edit these vars:

```
ALLOWED_HOSTS=gyangrit.onrender.com,api.gyangrit.site
CORS_ALLOWED_ORIGINS=https://gyangrit.site,https://www.gyangrit.site,https://gyan-grit.vercel.app
```

Keep the old `gyan-grit.vercel.app` origin until DNS is fully propagated, then you can remove it.

---

## Step 2: Vercel Custom Domain

1. Go to https://vercel.com → your GyanGrit project → Settings → Domains
2. Click "Add Domain"
3. Enter: `gyangrit.site`
4. Vercel will show you DNS records to add. It usually asks for:
   - An `A` record pointing `@` to `76.76.21.21`
   - A `CNAME` for `www` pointing to `cname.vercel-dns.com`

---

## Step 3: Namecheap DNS Records

Go to Namecheap → Domain List → `gyangrit.site` → Advanced DNS

Delete ALL existing records (parking page records), then add:

```
Type      Host    Value                     TTL
A         @       76.76.21.21               Automatic
CNAME     www     cname.vercel-dns.com      Automatic
```

If you later want a separate backend subdomain (api.gyangrit.site):
```
CNAME     api     gyangrit.onrender.com     Automatic
```

Wait 5-30 minutes for propagation. Test: `https://gyangrit.site` should load your app.

---

## Step 4: Vercel Environment Variable Update

In Vercel → Project Settings → Environment Variables, the `VITE_API_URL` stays as:
```
VITE_API_URL=https://gyangrit.onrender.com/api/v1
```

This is correct — the frontend calls the Render backend directly. The custom domain is only for the frontend URL.

---

## Step 5: Business Email Setup (Zoho Mail — Free)

### Why Zoho?
- Free tier: 5 users, 5GB each
- Custom domain email: `admin@gyangrit.site`, `noreply@gyangrit.site`
- Webmail + IMAP/SMTP access
- No credit card required

### Setup Steps:

1. Go to https://www.zoho.com/mail/zohomail-pricing.html
2. Click "Free Plan" → "Sign Up"
3. Enter your domain: `gyangrit.site`
4. Create your admin account (e.g., `admin@gyangrit.site`)
5. Zoho will ask you to verify domain ownership

### DNS Records for Zoho Mail

Add these to Namecheap → Advanced DNS (alongside the Vercel records):

```
Type    Host    Value                           Priority    TTL
MX      @       mx.zoho.in                     10          Automatic
MX      @       mx2.zoho.in                    20          Automatic
MX      @       mx3.zoho.in                    50          Automatic
TXT     @       v=spf1 include:zoho.in ~all    -           Automatic
```

Zoho may also ask for a DKIM record — follow their wizard.

### Create These Mailboxes:

| Email | Purpose |
|---|---|
| `admin@gyangrit.site` | Admin account, receives all system alerts |
| `noreply@gyangrit.site` | OTP emails, password resets, system notifications |
| `support@gyangrit.site` | Student/teacher support queries |

### Integrate noreply Email with Django

Update Render environment variables:
```
EMAIL_HOST=smtp.zoho.in
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@gyangrit.site
EMAIL_HOST_PASSWORD=<zoho-app-password>
DEFAULT_FROM_EMAIL=GyanGrit <noreply@gyangrit.site>
```

To generate Zoho app password:
1. Login to https://accounts.zoho.in
2. Security → App Passwords → Generate
3. Name it "GyanGrit Django"
4. Copy the password to Render

Then update `backend/gyangrit/settings/base.py`:

```python
# ── Email ─────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.zoho.in")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "GyanGrit <noreply@gyangrit.site>")
```

Then update `backend/apps/accounts/services.py` to use the new email settings when sending OTP emails.

---

## Step 6: Vercel Frontend Logging (Free Alternative)

Vercel's log tail requires Pro plan ($20/mo). Here are free alternatives:

### Option A: Sentry (Already Set Up)
You already have Sentry configured. Frontend errors are captured automatically.
- Go to https://sentry.io → your project → Issues tab
- All JS errors, failed API calls, and unhandled exceptions show up here
- This covers 90% of what you need logs for

### Option B: Browser Console
1. Open the deployed site in Chrome
2. Right-click → Inspect → Console tab
3. All `console.error` and `console.warn` messages appear here
4. Network tab shows all API calls with status codes

### Option C: LogFlare + Vercel (Free Tier)
1. Go to https://logflare.app → sign up free
2. Create a source → copy the API key
3. In Vercel → Settings → Log Drains → add LogFlare
4. Free tier: 5M events/month

### Option D: Simple Client-Side Error Reporting
Add this to `main.tsx` to log errors to your backend:
```typescript
window.addEventListener("error", (event) => {
  navigator.sendBeacon("/api/v1/health/", JSON.stringify({
    error: event.message,
    source: event.filename,
    line: event.lineno,
  }));
});
```

**My recommendation:** Just use Sentry. It's already set up, captures everything automatically, and has a generous free tier (5K events/month).

---

## Complete DNS Record Summary

After all setup, your Namecheap DNS should look like:

```
Type    Host    Value                           Priority    TTL
A       @       76.76.21.21                    -           Automatic
CNAME   www     cname.vercel-dns.com           -           Automatic
MX      @       mx.zoho.in                     10          Automatic
MX      @       mx2.zoho.in                    20          Automatic
MX      @       mx3.zoho.in                    50          Automatic
TXT     @       v=spf1 include:zoho.in ~all    -           Automatic
```

---

## Checklist

- [ ] Render: update ALLOWED_HOSTS + CORS_ALLOWED_ORIGINS
- [ ] Vercel: add `gyangrit.site` as custom domain
- [ ] Namecheap: add A + CNAME records for Vercel
- [ ] Test: https://gyangrit.site loads the app
- [ ] Zoho: sign up, verify domain, add MX records
- [ ] Zoho: create admin, noreply, support mailboxes
- [ ] Zoho: generate app password
- [ ] Render: update EMAIL_HOST_USER + EMAIL_HOST_PASSWORD to Zoho
- [ ] Test: OTP email arrives from noreply@gyangrit.site
