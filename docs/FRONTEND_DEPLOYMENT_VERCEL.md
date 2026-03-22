# GyanGrit — Frontend Deployment on Vercel

> Platform: [vercel.com](https://vercel.com)
> Framework: **Vite + React + TypeScript**
> Why Vercel: Best-in-class for Vite SPAs. Free tier is generous. Auto-deploy on git push.
> Zero config needed beyond env vars.

---

## Prerequisites

1. GitHub repo with the frontend at `frontend/`
2. Backend deployed on Render (see `docs/BACKEND_DEPLOYMENT_RENDER.md`)
3. Backend URL noted: `https://gyangrit-backend.onrender.com`

---

## Step 1 — Add `vercel.json`

Create `frontend/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This ensures React Router handles all routes — without it, refreshing any non-root page returns a 404.

---

## Step 2 — Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** → select your GitHub repo
3. Configure the project:

| Field | Value |
|---|---|
| **Framework Preset** | `Vite` (auto-detected) |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

4. Click **Deploy**

---

## Step 3 — Set Environment Variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Key | Value | Environment |
|---|---|---|
| `VITE_API_URL` | `https://gyangrit-backend.onrender.com/api/v1` | Production |
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Development (optional) |

**Important:** Vercel only exposes `VITE_` prefixed env vars to the browser. All others are build-time only.

---

## Step 4 — Update `frontend/src/services/api.ts`

The base URL should read from the env var:

```ts
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
```

If it's currently hardcoded to `http://localhost:8000/api/v1`, change it.

---

## Step 5 — Update `vite.config.ts` for production

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,   // disable in prod for smaller bundle
    chunkSizeWarningLimit: 800,
  },
  // No proxy needed in production — direct API calls to Render
});
```

For local dev, keep the proxy:
```ts
server: {
  proxy: {
    "/api": "http://localhost:8000",
  }
}
```

---

## Step 6 — Backend CORS

After deploying the frontend, Vercel gives you a URL like:
`https://gyangrit.vercel.app`

Go to Render → `gyangrit-backend` → Environment Variables → update:

```
CORS_ALLOWED_ORIGINS=https://gyangrit.vercel.app,https://yourdomain.com
```

Then trigger a Render redeploy.

---

## Step 7 — Custom Domain (optional)

1. In Vercel → Project → **Domains**
2. Add your domain (e.g. `app.gyangrit.in`)
3. Add the DNS records Vercel shows you at your domain registrar
4. Vercel auto-provisions an SSL certificate (Let's Encrypt)

---

## Vercel Free Tier Limits

| Limit | Free |
|---|---|
| Bandwidth | 100 GB/mo |
| Deployments | Unlimited |
| Custom domains | Yes |
| SSL | Auto (free) |
| Build minutes | 6000 min/mo |
| Team members | 1 (hobby) |

Free tier is more than enough for capstone and early production.

---

## Auto-deploy on git push

Once connected, every push to `main` triggers a new Vercel build automatically.

For preview deployments (non-main branches):
- Every PR gets its own preview URL: `https://gyangrit-pr-42.vercel.app`
- Useful for testing before merging

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Page refresh returns 404 | Missing `vercel.json` rewrites | Add `frontend/vercel.json` |
| API calls fail in production | `VITE_API_URL` not set or wrong | Check Vercel env vars |
| CORS errors | Backend `CORS_ALLOWED_ORIGINS` missing Vercel URL | Add Vercel URL to Render env |
| Login session not persisting | Cookies blocked cross-origin | Ensure `credentials: "include"` in all fetch calls |
| Blank page after deploy | JS bundle error — check browser console | Run `npm run build` locally first |
| Build fails | Missing dependency or TS error | Run `npx tsc --noEmit` locally first |

---

## Cookie & Session Notes

GyanGrit uses HTTP-only session cookies for auth. For these to work cross-origin (Vercel frontend → Render backend):

1. Backend must set `SameSite=None; Secure` on cookies in production
2. Backend must have `SESSION_COOKIE_SAMESITE = "None"` and `SESSION_COOKIE_SECURE = True`
3. Frontend must send `credentials: "include"` on every fetch (already done in `api.ts`)
4. Both domains must be HTTPS (both Render and Vercel are HTTPS by default)

Add to `prod.py`:
```python
SESSION_COOKIE_SAMESITE = "None"
SESSION_COOKIE_SECURE   = True
CSRF_COOKIE_SAMESITE    = "None"
CSRF_COOKIE_SECURE      = True
```

---

## Summary Checklist

```
[ ] frontend/vercel.json created with rewrites
[ ] VITE_API_URL set in Vercel env vars
[ ] api.ts reads from import.meta.env.VITE_API_URL
[ ] Backend CORS_ALLOWED_ORIGINS includes Vercel URL
[ ] Backend SESSION_COOKIE_SAMESITE = "None" in prod.py
[ ] npm run build passes locally (0 TS errors, 0 build errors)
[ ] First deploy successful — visit the Vercel URL and log in
```
