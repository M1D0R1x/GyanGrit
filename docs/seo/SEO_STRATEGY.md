# GyanGrit — Ultimate SEO & Search Engine Strategy 🚀

To get GyanGrit (a Single Page React/Vite App hosted on Vercel) fully indexed and highly visible on Google, you must overcome the "JavaScript rendering tax" and provide Google identical structured clues to a traditional HTML website.

This document serves as your master checklist when you shift gears back to marketing and SEO.

---

## 1. Domain Verification (The Fastest Way)

The very first thing you do is prove to Google you own `gyangrit.site`.

1. Go to **[Google Search Console](https://search.google.com/search-console)**.
2. Click **Add Property** and select **Domain** (Not URL prefix).
3. Type `gyangrit.site`.
4. Google will give you a `TXT` record (e.g., `google-site-verification=abc...`).
5. Open your **Vercel Dashboard** -> Settings -> Domains -> View DNS Records, and add that `TXT` record.
6. Click Verify in Google. You now have complete access to Google's ranking data!

---

## 2. Generating the Map (`sitemap.xml`)

Because React apps are fundamentally one single `index.html` file, Google's "spiders" don't know what pages exist unless you explicitly give them a map. 

You must create a file in your `frontend/public/` folder called `sitemap.xml`.

**Is it safe if anyone can view `sitemap.xml`?**
Yes! A common concern is that anyone typing `/sitemap.xml` can view all your website's links. However, this is exactly the intended behavior. The sitemap is a public directory built for search engine robots. 
*Crucial Rule*: You **must never** put authenticated or private URLs (like `/dashboard`, `/admin`, or `/classroom`) inside the `sitemap.xml`. It should strictly contain the public-facing pages listed in `LINK_SHEET.md`. Because these marketing pages are meant to be discovered anyway, exposing them in the sitemap poses zero security risk.

*Pro-Tip (Making it "Fancy")*: We can link an XML Stylesheet (`sitemap.xsl`) inside the `sitemap.xml`. This automatically renders the ugly raw XML data into a beautiful, human-readable HTML table when a person opens it in their browser, while Googlebots continue to read the raw data seamlessly in the background!

```xml
<!-- frontend/public/sitemap.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 https://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <!-- Main Entry -->
  <url>
    <loc>https://gyangrit.site/</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- Public Marketing Pages -->
  <url>
    <loc>https://gyangrit.site/about</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://gyangrit.site/contact</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://gyangrit.site/faq</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <!-- Authentication Pages -->
  <url>
    <loc>https://gyangrit.site/login</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://gyangrit.site/register</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
```

### The Stylesheet (`sitemap.xsl`)

To achieve the "fancy" look when humans view the sitemap directly:

```xml
<!-- frontend/public/sitemap.xsl -->
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>GyanGrit XML Sitemap</title>
        <style type="text/css">
          body { font-family: sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 40px; }
          h1 { color: #ffffff; }
          table { width: 100%; border-collapse: collapse; background: rgba(255, 255, 255, 0.03); }
          th, td { text-align: left; padding: 14px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
          th { background: rgba(255, 255, 255, 0.05); color: #ffffff; }
          a { color: #58a6ff; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>GyanGrit XML Sitemap</h1>
        <table>
          <thead>
            <tr>
              <th>URL Object</th>
              <th>Priority</th>
              <th>Change Frequency</th>
              <th>Last Modified</th>
            </tr>
          </thead>
          <tbody>
            <xsl:for-each select="sitemap:urlset/sitemap:url">
              <tr>
                <td><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></td>
                <td><xsl:value-of select="sitemap:priority"/></td>
                <td><xsl:value-of select="sitemap:changefreq"/></td>
                <td><xsl:value-of select="sitemap:lastmod"/></td>
              </tr>
            </xsl:for-each>
          </tbody>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
```

Once this is pushed to Vercel, go into Google Search Console and submit the exact URL: `https://gyangrit.site/sitemap.xml`.

---

## 3. Guiding the Spider (`robots.txt`)

Create another file named `robots.txt` in `frontend/public/`. This tells Google what it is allowed to read.

```text
User-agent: *
Allow: /

# Private Routes Extracted from React Router & LINK_SHEET.md
Disallow: /admin/
Disallow: /dashboard/
Disallow: /api/
Disallow: /classroom/
Disallow: /quiz/
Disallow: /settings/

# Point search engine directly to the comprehensive public sitemap map
Sitemap: https://gyangrit.site/sitemap.xml
```

---

## 4. Setting Up React Helmet (Dynamic Meta Tags)

Because Vite is an SPA (Single Page App), every page naturally shares the exact same `<title>` and `<meta>` description from `index.html`. This is a disaster for SEO. 

We installed `react-helmet-async` and wrapped the entire frontend application tree in `<HelmetProvider>`. This ensures that we can inject SEO data from any nested component.

**Step A: Global Setup (`frontend/src/main.tsx`)**
```tsx
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { RouterProvider } from "react-router-dom";
// ... other imports

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ChunkErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
        <Analytics />
        <SpeedInsights />
      </AuthProvider>
    </ChunkErrorBoundary>
  </HelmetProvider>
);
```

**Step B: Per-Page Hooking (`frontend/src/pages/AboutPage.tsx`)**
Now, on any page, we drop in a `<Helmet>` block to completely rewrite the document `<head>` dynamically:

```tsx
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "./PublicPages.css";

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="public-page">
      <Helmet>
        <title>About GyanGrit | Empowering Rural Students in Punjab</title>
        <meta name="description" content="Learn about GyanGrit, the digital education platform built as a capstone project to bring offline-first, gamified learning to rural areas." />
      </Helmet>
      
      {/* Page Content continues below... */}
      <nav className="public-nav">
```

---

## 5. The Google "Fast Track" Indexing API

If you want a page indexed in **minutes** instead of waiting weeks for Google's slow spiders:
1. Go to Google Cloud Platform (`console.cloud.google.com`).
2. Enable the **Web Search Indexing API**.
3. It allows you to forcefully "ping" Google via a script the precise moment you launch a new public feature or blog post, ensuring it shows up on Google Search results instantly.

---

## 6. Core Web Vitals (The Vercel Advantage)

Google ranks websites heavily based on **Speed**. Because you deployed the frontend to Vercel's Edge Network (Mumbai node), you already have a massive advantage.

Check your Vercel Analytics dashboard and ensure:
- **LCP (Largest Contentful Paint)**: Under 2.5 seconds (Already achieved via Vite bundle reductions).
- **FID (First Input Delay)**: Under 100ms.
- **CLS (Cumulative Layout Shift)**: Near 0 (Ensure images have fixed height/width so buttons don't jump around when loading).
