# GyanGrit — Domain & Services Guide

**Date:** 2026-03-25

---

## Domain Recommendation

### My pick: `gyangrit.site`

Here's why, comparing your three options:

| Domain | Year 1 | Renewal/yr | Verdict |
|---|---|---|---|
| `gyangrit.site` | ~$0.98 | ~$31.98 | **Best choice** — short, clean, "site" is intuitive |
| `gyangrit.space` | ~$0.98 | ~$32.48 | OK but "space" feels vague for an ed-tech platform |
| `gyangrit.online` | ~$0.98 | ~$34.98 | Longest URL, highest renewal, "online" is generic |

All three are dirt cheap year 1 (~$1) but renewals are $30-35/yr. That's the Namecheap game — cheap hook, real cost is year 2+.

**Why `.site` wins:**
- Shortest and most natural: "go to gyangrit.site"
- Intuitive for a web platform — it IS a site
- Lower renewal than `.online` and `.space`
- Easy to say aloud to rural teachers/students who aren't tech-savvy

**Alternative worth considering:** If you ever want to look more "official" for government schools, consider `gyangrit.in` (~$8/yr register, ~$10/yr renewal). The `.in` TLD signals India and government institutions respect it more.

---

## What to Buy on Namecheap

### Must buy:
1. **Domain: `gyangrit.site`** — ~$0.98 first year
   - Enable **WhoisGuard** (free with Namecheap, auto-enabled)
   - Set auto-renew ON immediately

### Do NOT buy from Namecheap:
- **Hosting** — You already have Render (backend) + Vercel (frontend). No hosting needed.
- **SSL certificate** — Vercel provides free SSL. If you move backend to EC2, use Let's Encrypt (free).
- **Website builder** — You built the frontend already.
- **VPN** — Not relevant.

### Optional but recommended:
2. **Private Email** — $11.88/year for Namecheap email
   - Gets you `admin@gyangrit.site`, `support@gyangrit.site`
   - Looks professional for capstone demo
   - Alternative: Use Zoho Mail free tier (up to 5 users) — costs $0

---

## DNS Setup After Purchase

### Step 1: Point domain to Vercel (frontend)
In Namecheap dashboard → Domain List → `gyangrit.site` → Advanced DNS:

```
Type    Host    Value                           TTL
A       @       76.76.21.21                     Automatic
CNAME   www     cname.vercel-dns.com            Automatic
```

### Step 2: Configure Vercel
In Vercel dashboard → Project → Settings → Domains:
- Add `gyangrit.site`
- Add `www.gyangrit.site`
- Vercel auto-provisions SSL

### Step 3: Backend subdomain (if migrating off Render)
If you move backend to EC2:
```
Type    Host    Value                           TTL
A       api     <EC2-elastic-IP>                Automatic
```
Then `api.gyangrit.site` → your Django backend.

If staying on Render:
```
Type    Host    Value                           TTL
CNAME   api     gyangrit.onrender.com           Automatic
```

### Step 4: Update frontend env
In Vercel → Environment Variables:
```
VITE_API_URL=https://api.gyangrit.site/api/v1
```

### Step 5: Update Django ALLOWED_HOSTS + CORS
In Render env vars (or EC2 .env):
```
ALLOWED_HOSTS=api.gyangrit.site,gyangrit.onrender.com
CORS_ALLOWED_ORIGINS=https://gyangrit.site,https://www.gyangrit.site
```

---

## Email Options (cheapest to most professional)

| Option | Cost | Mailboxes | Notes |
|---|---|---|---|
| **Zoho Mail Free** | $0/yr | 5 users | Best free option. `admin@gyangrit.site`. MX records in DNS. |
| **Namecheap Private Email** | $11.88/yr | 1 mailbox | Simple. Bundled with domain purchase. |
| **Google Workspace** | $84/yr | 1 user | Overkill for a capstone project. |
| **Forward-only** | $0 | N/A | Set up email forwarding in Namecheap to your Gmail. No send capability. |

**Current Setup:** We use the **Zoho Mail Forever Free** tier. It provides professional boxes like `noreply@gyangrit.site` and `support@gyangrit.site` for $0/yr.

### Zoho Mail Architecture
- **DNS Host:** Vercel (where `gyangrit.site` nameservers point)
- **Django Integration:** Uses a 16-character App Password generated from the `noreply` account to bypass 2FA and send emails via `smtp.zoho.in`.
- **Records Configured:** MX (10, 20, 50), SPF (TXT), DKIM (TXT), and Zoho Verification (TXT).
```
Type    Host    Value                       Priority    TTL
MX      @       mx.zoho.in                 10          Automatic
MX      @       mx2.zoho.in                20          Automatic
MX      @       mx3.zoho.in                50          Automatic
TXT     @       v=spf1 include:zoho.in ~all            Automatic
```
4. Create mailboxes: `admin@gyangrit.site`, `support@gyangrit.site`

---

## Total Cost Summary

| Item | Year 1 | Year 2+ |
|---|---|---|
| Domain `gyangrit.site` | ~$0.98 | ~$31.98 |
| Email (Zoho free) | $0 | $0 |
| Backend (Render free) | $0 | $0 |
| Frontend (Vercel free) | $0 | $0 |
| SSL (Vercel + Let's Encrypt) | $0 | $0 |
| **Total** | **~$1** | **~$32/yr** |

---

## Buy Now Checklist

1. Go to https://www.namecheap.com
2. Search `gyangrit.site`
3. Add to cart → Checkout
4. WhoisGuard: ON (free)
5. Auto-renew: ON
6. **Skip all upsells** (hosting, SSL, email, VPN — you don't need any of these)
7. Pay (~$0.98 + $0.20 ICANN fee = ~$1.18)
8. Go to Domain List → Advanced DNS → add the Vercel records above
9. Go to Vercel → add `gyangrit.site` domain
10. Wait 5-30 minutes for DNS propagation
11. Test: `https://gyangrit.site` should load your app
