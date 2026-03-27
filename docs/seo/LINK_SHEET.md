# GyanGrit — Public Canonical Link Sheet 🔗

This document defines the strict, authoritative list of URLs that belong in the `sitemap.xml` and are intended for Google/Bing indexing.

> [!WARNING]
> **Strict Rule:** Never include routes that require authentication in this list or the sitemap. Do not list endpoints like `/dashboard`, `/profile`, `/api/*`, or dynamically generated session parameters. 

## Approved Public URLs

| Page Route | Canonical URL | Priority | Change Frequency | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Home** | `https://gyangrit.site/` | `1.0` | Daily | Main landing page, highest SEO value. Primary entry point. |
| **About Us** | `https://gyangrit.site/about` | `0.8` | Monthly | Details mission, capstone context, and the team behind GyanGrit. |
| **Contact** | `https://gyangrit.site/contact` | `0.8` | Yearly | Support email, contact form, and official contact information. |
| **FAQ** | `https://gyangrit.site/faq` | `0.7` | Monthly | Frequently asked questions. Crucial for rich snippets in Google Search. |
| **Login** | `https://gyangrit.site/login` | `0.5` | Yearly | The sign-in portal. Needs indexing so users searching "GyanGrit login" find it. |
| **Register** | `https://gyangrit.site/register` | `0.5` | Yearly | The join-code entry portal. |

## Hidden UI Routes (Do NOT Index)
These routes exist in the React Router (`router.tsx`) but must be blocked in `robots.txt` and excluded from `sitemap.xml`:
- `/dashboard/*` (Student, Teacher, Principal, Official portals)
- `/classroom/*` (Live LiveKit interactions)
- `/quiz/*` (Active assessment sessions)
- `/settings/*` (User profile configurations)

## Indexing Implementation Checklist

- [ ] Ensure `frontend/public/sitemap.xml` matches the **Approved Public URLs** table above exactly.
- [ ] Ensure `frontend/public/robots.txt` explicitly disallows the folders listed under **Hidden UI Routes**.
- [ ] Ensure that React Router (`router.tsx`) strictly maps these paths identically.
- [ ] Verify that React Helmet Async injects independent `<title>` and `<meta name="description">` tags for each approved public URL.
