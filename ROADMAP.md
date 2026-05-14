# Krystle's Kitchen — Roadmap

Full-stack group kitchen app (React + Node/Express + SQLite) deployed on Render. This is a working dev doc — not a changelog.

---

## ✅ Completed

- ✅ **Recipe URL Import** — cheerio-based JSON-LD parser, OG fallback, two-step ImportRecipeModal
- ✅ **Entrée Refactor** — recipe auto-scaling (inline servings adjuster, real-time ingredient math), ingredient parser, `sides` column added, all "meal" UI text → "entrée"
- ✅ **Spending Charts** — bar + doughnut via Chart.js in Corner.jsx, backend stats endpoint
- ✅ **Kitchen Orders Page** — Orders.jsx with menu manager + meal requests, separate admin and client views, status flow + notifications
- ✅ **Security Hardening** — helmet + CSP, rate limiting (express-rate-limit), input validation (express-validator), bcrypt, file upload MIME hardening, forgot/reset password flow
- ✅ **PWA Setup** — vite-plugin-pwa, hand-written sw.js (bypasses Workbox apostrophe-in-path bug), manifest, install prompt, tested on real phone over WiFi
- ✅ **JWT Auto-Refresh** — 15min access token + 7-day refresh token, axios interceptor with 401 queue, silent refresh, server-side revocation on logout
- ✅ **Page Renames** — Korner → Corner, Kuzine → Cuisine, Kultivate → Garden; source files renamed, routes updated, nav labels cleaned
- ✅ **Render Cloud Deployment** — render.yaml Blueprint, backend + static client live at krystleskitchen.onrender.com / krystleskitchen-client.onrender.com
- ✅ **GitHub Repo Cleanup** — .gitignore improved, README rewritten clean

---

## 🔧 In Progress / Next Up

- 🔲 **Vercel Disconnect + Git History Squash** — manual steps provided to user; pending user action
- 🔲 **Image Compression** — server-side sharp/WebP conversion on upload

---

## 📋 Backlog

- 🔲 **Group Chat** — in-app message thread per group
- 🔲 **Notification Preferences** — per-user toggles for which notifications fire
- 🔲 **Group Sync Mode** — auto/manual sync with last-synced visibility per member
- 🔲 **Payment Integration** — Stripe subscription billing for the Group Plan
- 🔲 **Data Export** — ZIP download of user/group data (recipes, inventory, spending, photos)
- 🔲 **Print-Friendly Views** — @media print stylesheets for shopping lists and recipe cards
- 🔲 **Cross-device Responsive Testing** — PC, Android, iPhone, Galaxy Z Fold, iPad, Mac

---

*Last updated: May 2026*
