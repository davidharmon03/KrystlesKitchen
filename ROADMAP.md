# Krystle's Kitchen — Feature Roadmap

Prioritized backlog of planned updates. Check items off as they ship.

---

## 📍 Current Status — May 2026

- ✅ **App is live on the internet** — backend + frontend both deployed on Render
- **Backend:** `https://krystleskitchen.onrender.com` (Node/Express + SQLite, Render Web Service)
- **Frontend:** `https://krystleskitchen-client.onrender.com` (React/Vite, Render Static Site)
- All core features complete and functional (tasks 1–12 shipped)
- **Completed this sprint:** Payment Integration (Stripe) · Data Export (ZIP) · Print-Friendly Views · Cloud Deployment
- **Next build priorities:** Full feature testing (Task 18) → PWA Polish (Task 13) → Security Audit (Task 15)
- ⚠️ Free Render tier spins down after 15min of inactivity — first request after idle takes ~30–60s to wake up
- Free/Paid tier enforcement not yet implemented (all features accessible)
- Stripe requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` env vars before billing goes live
- Domain name not yet registered
- Demo accounts removed from login page

---

## 🔲 Backlog

### ✅ 1. Meal → Entrée Refactor + Sides Recommendations *(shipped May 2026)*
- [x] **Rename all "meal" references to "entrée" throughout UI labels, headings, buttons, and placeholders**
  - DB columns and API routes kept unchanged (non-breaking)
  - UI text updated: "Entrée Swap", "Suggest an Entrée", "Entrée Gallery", "Suggested Sides", etc.
  - Files updated: `Kitchen.jsx`, `MealSwap.jsx`, `Suggestions.jsx`, `Help.jsx`, `Gallery.jsx`, `ImportRecipeModal.jsx`, `digest.js`
- [x] **Add Sides Recommendations to recipes**
  - `sides` column added to `recipes` table via safe ALTER TABLE migration in `db.js`
  - Sides field included in recipe create/edit modal (Kitchen), recipe detail view, ImportRecipeModal, and weekly digest email
  - Free-text field (comma-separated suggestions, e.g. "roasted vegetables, rice pilaf")
- [ ] **Add "Top Rated" filter to Kitchen** *(optional, carry forward)*
  - Sort/filter recipes by aggregate star rating
  - Quick win — data already exists from Meal Ratings feature

---

### ✅ 1. Spending Charts in Corner *(shipped May 2026)*
- [x] **"Spending" tab in Corner with charts**
  - Monthly group spend bar chart (last 6 months) — Chart.js Bar
  - Per-member spend doughnut chart — Chart.js Doughnut
  - Empty state when no receipt data exists
  - Brand colors: moss green, terracotta, slate
  - Responsive charts with `maintainAspectRatio: false`
  - Backend: `GET /api/korner/:groupId/stats` — monthlySpend + spendByMember from receipts table

---

### ✅ 2. Recipe Auto-Scaling *(shipped May 2026)*
- [x] **Inline servings selector on recipe detail view**
  - [−] N servings [+] adjuster in recipe modal view mode; min 1, max 50
  - All ingredient quantities scale proportionally in real time
  - "Scaled from X servings" note shown when adjusted from original
  - Scaling is display-only — source recipe unchanged in the DB
  - "Add to Shopping List" pre-initializes its multiplier from the current scale ratio
  - Fractions handled cleanly: `1/2 → 1`, `1 1/2 → 3`, `3 large eggs → 1 1/2 large eggs`, etc.
  - `client/src/utils/scaleIngredients.js` — shared utility with integer, decimal, fraction, and mixed-number parsing

---

### ✅ 3. Security Hardening *(shipped May 2026)*
- [x] **Harden the app before sharing with group or deploying to cloud**
  - `must_change_password` flag added to users table; included in login response so frontend can prompt forced change
  - `helmet.js` middleware added with Content Security Policy — secure HTTP headers on all responses
  - Rate limiting: 20 req/15min on `/api/auth`; 500 req/15min on all other `/api` routes (`express-rate-limit`)
  - Input validation on register (name, email, password ≥8 chars) and login using `express-validator`; 422 with error array on failure
  - File upload validation hardened on all multer configs (auth, korner, photos, products): only `image/jpeg`, `image/png`, `image/gif`, `image/webp`; max 5MB
- [x] **Password Reset / "Forgot Password" flow**
  - `password_reset_tokens` table: user_id, token (32-byte random hex), expires_at (1h), used flag
  - `POST /api/auth/forgot-password` — generates token, sends email via nodemailer; always returns 200 (no email enumeration)
  - `POST /api/auth/reset-password` — validates token (exists, not used, not expired), bcrypt-hashes new password, marks token used
  - Frontend: `ForgotPassword.jsx` + `ResetPassword.jsx` pages; "Forgot your password?" link added to Login page
  - Routes wired in `App.jsx`: `/forgot-password` (PublicRoute) + `/reset-password`
- [x] **JWT refresh token strategy**
  - Access tokens now expire in 15 minutes (previously 7 days)
  - `refresh_tokens` table: user_id, 32-byte random hex token, expires_at (7 days), revoked flag
  - Login and register both return `{ token, refreshToken, user }`
  - `POST /api/auth/refresh` — validates refresh token from DB, issues new access token
  - `POST /api/auth/logout` — marks refresh token revoked in DB

---

### ✅ 4. JWT Auto-Refresh (Axios Interceptor) *(shipped May 2026)*
- [x] **Add axios interceptor for seamless token refresh**
  - Intercept 401 responses in the client and silently hit `POST /api/auth/refresh` with the stored `refreshToken`
  - Retry the original request with the new `accessToken` on success
  - Redirect to login only if the refresh call also fails (i.e., refresh token expired or revoked)
  - Store `refreshToken` in memory (not `localStorage`) — never persisted to disk
  - Concurrent 401s during refresh are queued and replayed once the new token arrives
  - `logout()` now calls `POST /api/auth/logout` to revoke the refresh token server-side before clearing local state
  - `register()` also stores the refreshToken returned by the backend
  - **Note:** refreshToken is lost on hard page refresh — user re-authenticates after 15min of inactivity; localStorage persistence not implemented by design

---

### ✅ 5. PWA (Progressive Web App) *(shipped May 2026)*
- [x] **Make the app installable on phones**
  - `vite-plugin-pwa` handles manifest + Workbox service worker generation at build time
  - Web app manifest: name, icons, theme `#6B7C5C`, `display: standalone`, portrait orientation
  - Icons: `client/public/icons/icon-192.png` + `icon-512.png` (placeholder — replace with real art)
  - Workbox runtime caching: NetworkFirst for `/api/recipes` (24h) and `/api/inventory` (4h)
  - PWA meta tags + apple-touch-icon added to `index.html`
  - `InstallPrompt.jsx` — dismissable bottom banner on mobile only, uses `beforeinstallprompt` event
  - **To test:** `npm run build && npm run preview` in `client/` — service worker only activates in production build
  - ✅ **Tested and confirmed working on a real phone over local WiFi** *(May 2026)*

---

### ✅ 6. Image/Upload Compression *(shipped May 2026)*
- [x] **Compress uploaded images server-side before storing**
  - `sharp` added to server dependencies (`npm install` required)
  - `server/utils/compressImage.js` — shared helper: resizes to maxWidth, outputs WebP at quality 82
  - All 4 multer configs switched from `diskStorage` to `memoryStorage`; buffer piped through sharp before write
  - Target max widths: avatars 400px, meal photos 1200px, product images 1200px, receipts 1600px
  - All uploads saved as `.webp` — JPEG/PNG originals never hit disk
  - `server/scripts/compress-existing.js` — one-time migration: compresses existing uploads and updates DB paths; safe to re-run; preserves originals until manually deleted
  - **Note:** Receipt images moved to `uploads/receipts/` subdirectory going forward (legacy root-level receipt images handled by migration script)

---

### ✅ 7. Group Chat *(shipped May 2026)*
- [x] **Simple in-app message thread per group**
  - `messages` table: `id, group_id, user_id, content, deleted, created_at`
  - `GET /api/chat/:groupId` — last 100 messages, chronological; `?before=<iso>` for pagination
  - `GET /api/chat/:groupId/since/:iso` — polling endpoint (new messages only)
  - `POST /api/chat/:groupId` — send a message
  - `DELETE /api/chat/:groupId/:messageId` — soft-delete (author only)
  - Frontend: `client/src/pages/Chat.jsx` — polls every 10s, auto-scroll, "Load older" button
  - Member avatars + display names; consecutive messages from same user collapse the name/avatar
  - Your messages right-aligned (moss bubble), others left-aligned (white border bubble)
  - Auto-growing textarea; Enter to send, Shift+Enter for newline; soft-delete on hover
  - Nav link added to sidebar under Kitchen Orders
  - Logout race condition fixed — `logout().then(navigate)` (logout is now async)

---

### ✅ 8. Notification Preferences *(shipped May 2026)*
- [x] **Let users control which notifications they receive**
  - `notification_prefs TEXT DEFAULT '{}'` column added to `users` table (safe ALTER migration)
  - `GET /api/auth/notification-prefs` + `PUT /api/auth/notification-prefs` — load/save prefs per user
  - `DEFAULT_NOTIFICATION_PREFS` exported from `auth.js` (all true); used as fallback across backend
  - `notifications.js` — `createNotification` checks user's pref for the notification type before inserting; `notifyGroupMembers` checks each member individually
  - `digest.js` — filters out members with `email_digest: false` before sending
  - Frontend: Notification Preferences card added to Profile page with grouped toggle switches
  - Toggles: Weekly Email Digest · Meal Swap · Corner · Cuisine · Kultivate · Kitchen Orders · Expiry Reminders
  - `invite_received` always delivered (not gated by preferences)
  - Logout button in Profile also fixed to `logout().then(navigate)` (async logout)

---

### ✅ 9. 🔄 Group Sync Mode (Auto / Manual) *(shipped May 2026)*

Users can control how and when their data syncs with the group. Useful for offline-first use and when on mobile data.

**Implementation shipped:**
- `sync_mode TEXT DEFAULT 'auto'` on `users` table; `last_synced_at DATETIME` on `group_members` (both safe ALTER migrations)
- `PUT /api/groups/:id/sync-ping` — updates `last_synced_at` for the calling user
- `GET /api/groups/:id` now includes `last_synced_at` per member
- `sync_mode` included in `/api/auth/me` response; settable via `PUT /api/auth/profile`
- `client/src/contexts/SyncContext.jsx` — global sync state: auto-pings on mount + tab-focus in auto mode; axios interceptor counts mutations in manual mode for the pending badge; `syncNow()` for manual trigger
- `SyncProvider` wraps app inside `AuthProvider` in `App.jsx`
- **Sidebar sync badge** (Layout.jsx) — colored dot + status label + "Sync Now (N)" button in manual mode
- **Dashboard member cards** — colored dot per member (🟢 <1d, 🟡 1–3d, 🔴 3+d) + "Synced X ago" / "Never synced"
- **Profile page** — Auto-sync toggle + Sync Now button with pending count in manual mode

**Sync settings (per user, stored in profile/settings):**
- **Auto Sync** — pings last_synced_at on mount and tab focus. Current behavior.
- **Manual Sync** — axios interceptor counts mutations; Sync Now button in nav and profile page.

**Sync status indicator:**

Show a small status badge in the nav (or sidebar) indicating current sync state:
- 🟢 **Synced** — up to date with the group
- 🟡 **Pending** — local changes waiting to be synced (manual mode only)
- 🔴 **Offline** — no connection, all changes queuing locally
- 🔵 **Syncing...** — active sync in progress

**What gets synced per channel:**
- Kitchen: recipes, photos
- Corner: receipts, meal credits
- Cuisine: inventory, shopping lists, bulk buy items
- Kultivate: garden plants, harvests
- Meal Swap: status updates
- Notifications: mark-read state

**Implementation notes:**
- In local mode (current): sync is just API calls — this feature controls when those calls fire
- In cloud mode: add a `pending_sync` queue (IndexedDB) for offline writes; background sync API flushes the queue when online
- Add a `sync_mode` field (`auto|manual`) to user settings/profile (DB + profile page toggle)
- Show last-synced timestamp: "Last synced 3 minutes ago"
- Conflict resolution: last-write-wins for most fields; for Corner receipts and credits, flag conflicts for manual review

**Profile/Settings page addition:**
- Toggle switch: "Auto-sync with group" (on/off)
- When off: "Sync Now" button appears in the sidebar nav with a badge count of pending changes

**Group Sync Visibility:**

Each group member's last sync timestamp is stored server-side and visible to everyone in the group.

- `last_synced_at` column on the `group_members` table — updated automatically on every successful sync (auto or manual)
- Visible in two places:
  1. **Group member cards on the Dashboard** — small "Last synced X ago" line under each member's name/avatar (e.g. "Synced 2 hours ago"; shown in amber if stale)
  2. **Sync status panel** (collapsible, accessible from the sync badge in nav) — lists all members with a color-coded dot: 🟢 synced within 24h, 🟡 1–3 days, 🔴 3+ days out of sync
- Stale members (3+ days) trigger a gentle nudge notification: "Marcus hasn't synced in 4 days — their data may be outdated"
- Group admin can view the full sync status panel from Corner or group settings

**Implementation note:** `last_synced_at DATETIME` column on `group_members` table; `PUT /api/groups/:id/sync-ping` endpoint called on every successful data push; frontend formats relative time ("2 hours ago", "3 days ago")

---

### ✅ 10. Payment Integration (Stripe) *(shipped May 2026)*
- [x] **Implement subscription billing for the Group Plan**
  - Choose provider: Stripe (more control, more setup) or LemonSqueezy (simpler, handles tax/VAT)
  - Subscription management: create, upgrade, cancel, billing portal
  - Webhook handling: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
  - Update `users.plan` field from `free` → `paid` on successful payment; revert on cancellation
  - Frontend: upgrade prompt card on group-locked pages, billing settings page for admin
  - **Notes:** Prerequisite for the Free/Paid tier enforcement. Only the group admin pays — members join free. Both Stripe and LemonSqueezy require a Terms of Service and Privacy Policy before account approval (see Cloud Checklist). Test thoroughly in sandbox/test mode before going live.

---

### ✅ 11. Data Export *(shipped May 2026)*
- [x] **Allow users to download their own data**
  - "Download My Data" button in profile/settings
  - Export as ZIP containing: recipes (JSON or CSV), inventory (CSV), spending history (CSV), meal swap history (CSV), uploaded photos
  - Admin can export full group data
  - **Notes:** Builds user trust and could become a legal requirement depending on user locations (GDPR/CCPA). Also useful as a personal backup. Generate the ZIP server-side and stream the download.

---

### ✅ 12. Print-Friendly Views *(shipped May 2026)*
- [x] **Add print stylesheets and print buttons for key pages**
  - Shopping Lists — clean printout with section headers, checkboxes, no nav/sidebar
  - Recipe Detail — formatted recipe card with ingredients, steps, and photo
  - Label Generator — already prints, but verify print CSS is clean
  - Add `@media print` stylesheet to hide nav, sidebar, modals, and non-essential UI
  - Add a "Print" button (🖨️) on shopping list and recipe detail views
  - **Notes:** People use shopping lists at the store and recipes in the kitchen — paper is still king in both places. Quick win — mostly CSS with a `window.print()` call.

---

### 13. Full PWA Polish — Phone & Tablet Install Experience

The PWA scaffolding is in place (`vite-plugin-pwa`, service worker, manifest, icons, `InstallPrompt`). What's still missing is a complete cross-platform install experience.

**Current gaps:**
- `InstallPrompt.jsx` only handles the `beforeinstallprompt` event — works on Android/Chrome but **iOS Safari never fires that event**. iOS users currently get no install guidance.
- Viewport doesn't declare `viewport-fit=cover` — app doesn't fill behind iPhone notch / Dynamic Island.
- No offline indicator shown to the user when the network is down.
- Service worker cache version (`brand-hub-v1`) never bumped — stale caches persist across deploys.

**What to build:**
- [ ] **iOS "Add to Home Screen" instructions** — detect iOS Safari (`/iPhone|iPad|iPod/.test(ua) && !window.MSStream`), check `window.navigator.standalone !== true`, show a step-by-step modal: *Tap Share → Add to Home Screen → Add*. Delay 3s so the page loads first.
- [ ] **Viewport safe-area** — add `viewport-fit=cover` to `index.html` viewport meta tag; add CSS `padding: env(safe-area-inset-*)` to the app shell so content doesn't hide behind the notch.
- [ ] **Offline toast** — listen for `online`/`offline` events; show a small non-blocking banner when the device loses connection ("You're offline — changes will sync when reconnected").
- [ ] **Cache version bump strategy** — update `CACHE_NAME` in `sw.js` on every deploy; automate via `vite.config.js` build timestamp injection.
- [ ] **Additional icon sizes** — add `icon-180.png` (Apple Touch Icon), `icon-32.png`, `icon-16.png` (favicon). Update `index.html` and `vite.config.js` manifest.
- [ ] **Desktop PWA** — the current manifest and prompt are mobile-only. Enable install on desktop Chrome/Edge too (`md:hidden` guard removed from the prompt banner).
- [ ] **Splash screens (iOS)** — `apple-touch-startup-image` meta tags for common screen sizes prevent a white flash on launch.

**Testing notes:**
- Android: `npm run build && npm run preview` over local WiFi — Chrome will offer install
- iOS: open in Safari, confirm banner appears and instructions are accurate
- Desktop: Chrome address bar install icon should appear

---

### 14. Expanded Payment Methods

**Current state:** Stripe Checkout with `payment_method_types: ['card']` only.

**What to build:**
- [ ] **Switch to `automatic_payment_methods`** — remove the `payment_method_types` array from `billing.js` `create-checkout` call and replace with `automatic_payment_methods: { enabled: true }`. This single change lets Stripe automatically show every method the customer's device, country, and currency supports: PayPal, Apple Pay (iOS Safari), Google Pay (Android Chrome), Link, Cash App Pay, Klarna, Afterpay, etc. No code changes needed per-method — Stripe handles the display logic.
- [ ] **Enable methods in Stripe Dashboard** — go to *Settings → Payment methods* in the Stripe Dashboard and enable: PayPal, Apple Pay, Google Pay, Link, and any others desired. Stripe won't show a method in Checkout until it's enabled in the Dashboard, even with `automatic_payment_methods` on.
- [ ] **Payment method display on Billing page** — add a row of accepted payment icons (Visa, Mastercard, Amex, PayPal, Apple Pay, Google Pay) below the upgrade button so users know what's accepted before they click.
- [ ] **Stripe test mode verification** — test each method in sandbox: use Stripe's test card numbers, PayPal sandbox, and simulate Apple Pay/Google Pay with Chrome DevTools.
- [ ] **Webhook coverage** — verify existing webhook handlers cover `payment_intent.payment_failed` for failed renewals; add a notification to the group admin when a payment fails.

**Implementation note — single line change in `server/routes/billing.js`:**
```js
// Replace:
payment_method_types: ['card'],

// With:
automatic_payment_methods: { enabled: true },
```

---

### 15. App-Wide Security & Bundle Audit

A dedicated review pass before the app goes to production. Goal: reduce attack surface, minimize bundle size, and verify everything is production-hardened.

**Security audit tasks:**
- [ ] **Dependency audit** — run `npm audit` in both `client/` and `server/`; resolve any high/critical CVEs. Check for packages that have better-maintained alternatives.
- [ ] **Auth route hardening** — review all `authMiddleware`-protected routes; confirm no endpoint accidentally returns another user's data. Add `user_id` scope checks on every query that touches user-specific rows.
- [ ] **Input sanitization pass** — audit every `req.body` field used in SQL queries; confirm all use parameterized queries (no string concatenation). Grep for `db.run(\`` and `db.all(\`` to catch any that aren't parameterized.
- [ ] **File upload hardening** — currently validates MIME type from the `Content-Type` header (client-supplied). Add `file-type` library to validate magic bytes server-side regardless of what the client claims.
- [ ] **Rate limiting review** — current limits are 20/15min (auth) and 500/15min (general). Review whether 500 is too permissive; consider per-user limits on write operations.
- [ ] **CORS tighten** — confirm `FRONTEND_URL` env var is set in production and `origin: '*'` is never used.
- [ ] **Helmet CSP review** — current CSP allows `'unsafe-inline'` for styles. Audit and tighten where possible; add `connect-src` to restrict API origins.
- [ ] **JWT secret strength** — confirm `JWT_SECRET` in `.env` is at least 32 random bytes; document minimum entropy requirement.
- [ ] **Refresh token cleanup** — add a cron job to purge expired/revoked refresh tokens from the DB periodically (currently they accumulate indefinitely).
- [ ] **SQLite WAL file** — confirm `data.db-wal` and `data.db-shm` are excluded from version control (`.gitignore`).

**Bundle size audit tasks:**
- [ ] **Run `vite build --report`** — generates a visual treemap; identify any unexpectedly large dependencies.
- [ ] **Lazy-load heavy pages** — `Kitchen.jsx`, `Kuzine.jsx`, `Kultivate.jsx`, `MealSwap.jsx` are large. Switch to `React.lazy()` + `Suspense` for route-level code splitting.
- [ ] **Audit icon imports** — `lucide-react` is imported as named exports, which is correct. Verify no `import * as Icons from 'lucide-react'` anywhere (that would pull the entire library).
- [ ] **Chart.js tree-shake** — confirm only needed Chart.js modules are registered (`BarController`, `DoughnutController`, etc.) instead of importing the full bundle.
- [ ] **Remove unused dependencies** — cross-reference `package.json` with actual imports; remove anything not used.
- [ ] **Image optimization** — confirm all icons in `public/icons/` are optimally compressed; generate WebP versions where possible.
- [ ] **Service worker cache scope** — review what `sw.js` caches and confirm it doesn't cache API responses that should always be fresh (auth routes, real-time data).

**Output:** A prioritized list of findings with severity (Critical / High / Medium / Low) and recommended fix for each.

---

### 16. Ownership Model & Deployment Architecture Decision

This task is about finalizing **how the app is distributed, who owns what, and where the data lives.** This is a design and infrastructure decision — not a code change — but it has big downstream implications for everything else.

---

#### What the model should be

- **One admin per app instance** — the person who downloads the app and pays for it. They are the group creator. They send invite links to their group members (already built via `group_invitations` table and email invite flow).
- **Members join free** — they receive an invite link, register an account, and get access to all group features without paying. The admin's subscription covers the whole group.
- **All data interaction happens through that shared backend** — admin and members all read/write from the same database. This is already how the app works.

This model is already built. The open question is **where the backend server and database actually live.**

---

#### The core architectural question: Cloud vs. Local

There are three realistic options. Each has a different cost, complexity, and user experience tradeoff.

---

**Option A — Cloud-hosted (recommended for most cases)**

The Express backend and database run on a cloud server (Railway, Render, Fly.io). The React frontend is deployed to Vercel or Netlify. Every user — admin and members alike — connects over the internet from any device.

- ✅ Works on any device, anywhere — phone, tablet, desktop, browser, PWA
- ✅ Group members can join from their own phones without any setup
- ✅ Real-time group sync works naturally (everyone hits the same server)
- ✅ Admin doesn't need their computer on for others to use the app
- ✅ Automatic updates when the app is redeployed
- ❌ Requires a monthly hosting cost (Railway/Render free tiers work for small groups; ~$5–10/mo for dedicated)
- ❌ Data lives on someone else's infrastructure (mitigated by Data Export feature)
- ❌ Requires internet — no offline writes without the sync queue (Task 9 / IndexedDB)

**This is the architecture the app is currently built for.** SQLite works fine for a single group; the Cloud Checklist (below) covers the migration to PostgreSQL when ready.

---

**Option B — Self-hosted on the admin's machine (home server / NAS)**

The admin runs the Express server on their own Windows PC, Mac, or a cheap always-on device (Raspberry Pi, old laptop, NAS like Synology). Other group members connect to it over local WiFi — or remotely via a tunnel like Cloudflare Tunnel or Tailscale (no port forwarding required).

- ✅ Zero monthly hosting cost after setup
- ✅ All data stays on the admin's hardware — full privacy and control
- ✅ Works offline on the local network
- ✅ Admin can back up the SQLite `data.db` file directly
- ❌ Admin's machine must be on and running for members to access the app
- ❌ Remote access requires a tunnel (Cloudflare Tunnel is free and relatively simple)
- ❌ More setup friction — admin needs to install Node.js, run the server, configure the tunnel
- ❌ Updates are manual (pull the latest code, restart the server)

**This option is viable and worth supporting with a simple setup guide.** The app already runs this way on David's machine. Adding a `start.bat` / `start.sh` launcher and documenting Cloudflare Tunnel setup would make it shareable.

---

**Option C — Per-device (each user runs their own copy)**

Each user installs the full app (frontend + backend) on their own device. No shared server. Data lives entirely on each person's phone or PC.

- ✅ Maximum privacy — no shared infrastructure
- ✅ Works fully offline
- ❌ **Group features break entirely** — there's no shared server to sync through, so Corner, Meal Swap, shared shopping lists, chat, and notifications all stop working
- ❌ Not viable for this app's purpose without a P2P sync layer (extremely complex)

**Not recommended.** The app is fundamentally group-first. Abandoning a shared server means abandoning the core value proposition.

---

#### Recommendation

**Start with Option B (self-hosted on David's machine)** using Cloudflare Tunnel for remote access — this is already working, zero new cost, and Krystle's crew can use it right now. When the group outgrows it or David wants reliability without his PC running 24/7, **migrate to Option A (Railway/Render cloud hosting)** using the Cloud Deployment Checklist below.

The app doesn't need to change architecturally for either option — it's the same Express + SQLite (or PostgreSQL) stack either way.

---

#### Tasks for this roadmap item

- [ ] **Document the self-hosted setup** — write a `SETUP.md` in the project root: install Node.js, `npm install` in both `client/` and `server/`, copy `.env.example` to `.env`, `npm run build` in client, `npm start` in server. Simple enough for a non-developer admin.
- [ ] **Create a `start.bat` launcher** — Windows batch file that starts the server and optionally opens the browser. Double-click to run.
- [ ] **Cloudflare Tunnel guide** — short doc: create a free Cloudflare account, install `cloudflared`, `cloudflared tunnel --url http://localhost:3001`. Members get a stable public URL without port forwarding. Works even on home ISPs with CGNAT.
- [ ] **Decide and document the data residency model** — update the app's Help page and any future Terms of Service with: "Your data lives on [cloud server / admin's machine]. The group admin controls the data." Be explicit about this before sharing with real users.
- [ ] **Admin-only settings page** — a `/admin` route (gated by `user.role === 'admin'`) where the group owner can: view all members, remove members, see storage usage, trigger a full group data export, and view server health. Currently these actions require direct DB access.
- [ ] **Cloud migration** — when ready, follow the Cloud Deployment Checklist. The transition from Option B → Option A is: export SQLite data, import to PostgreSQL, point the DNS at the new server. The Data Export feature (Task 11) makes the user-data side of this easy.

---

### 18. Full Feature Test Plan

A complete end-to-end test of every feature in the app. Run this before inviting real users, before going cloud, and after any major code change. Work through it top to bottom — each section builds on the one before it. Mark each item ✅ pass or ❌ fail with a short note.

**How to run:** Two browser windows, two accounts (admin + one member). Use the seeded `krystle@example.com / password123` account as the admin, register a second fresh account as the member.

---

#### 🔐 Auth

- [ ] **Register** — create a new account; confirm redirect to dashboard
- [ ] **Login** — log in with existing account; confirm JWT stored, dashboard loads
- [ ] **Wrong password** — confirm error message, no crash
- [ ] **Forgot password** — request reset email; confirm email arrives (check server console if email not configured); follow link; set new password; confirm login works with new password
- [ ] **Token auto-refresh** — stay logged in for 15+ minutes without touching the page; make an API call (navigate to a page); confirm no logout redirect (interceptor silently refreshed the token)
- [ ] **Logout** — click sign out; confirm redirect to login; confirm refresh token is revoked (logging back in immediately should work but old token should not)
- [ ] **Session persistence** — log in, close the tab, reopen the app URL; confirm still logged in

---

#### 👤 Profile

- [ ] **Avatar upload** — upload a JPG or PNG; confirm it appears in sidebar, header, and member cards; confirm it's compressed to WebP on the server
- [ ] **Display name change** — update name; confirm it updates in the sidebar header and dashboard immediately
- [ ] **Social links** — add an Instagram handle and a website URL; confirm icons appear in the social links preview
- [ ] **Notification preferences** — toggle off "Weekly Email Digest"; save; reload the page; confirm toggle is still off
- [ ] **Sync mode toggle** — switch to Manual; confirm Sync Now button appears in sidebar; switch back to Auto
- [ ] **Billing link** — confirm Plan & Billing card shows current plan; confirm clicking Manage/Upgrade navigates to `/billing`
- [ ] **Data export** — click Download; confirm a `.zip` file downloads; open the zip and verify `recipes.json`, `spending.csv`, `inventory.csv`, `swaps.csv`, `garden.csv`, `harvests.csv` are all present

---

#### 👥 Groups

- [ ] **Create group** — as admin, create a group with a unique name; confirm invite code appears
- [ ] **Email invite** — send an invite to the second account's email; confirm invitation email arrives (or check server log); follow the link; confirm second account joins the group
- [ ] **Invite code join** — log out of second account; register a third account; join via the invite code directly; confirm membership
- [ ] **Group appears on dashboard** — confirm group name and member count show on dashboard for all members
- [ ] **Member cards** — confirm all members appear with name, avatar, and sync status dot

---

#### 🍳 Kitchen (Recipes)

- [ ] **Create recipe** — add title, description, ingredients (one per line), steps, tags, skill tags, sides, mark public
- [ ] **View recipe** — open the recipe card; confirm all fields display correctly
- [ ] **Edit recipe** — change the title and one ingredient; save; confirm changes persist on reload
- [ ] **Recipe scaling** — open a recipe; tap [+] to increase servings; confirm ingredient quantities update proportionally
- [ ] **Add to shopping list** — from recipe view, add ingredients to the group shopping list; confirm they appear in Cuisine
- [ ] **Photo upload** — upload a meal photo to a recipe; confirm it appears as the hero image in the recipe modal
- [ ] **Recipe import** — use "Import from URL" with a real recipe page URL; confirm fields are auto-populated
- [ ] **Delete recipe** — delete a recipe; confirm it disappears from the list
- [ ] **Search/filter** — search by keyword; filter by tag; confirm results are correct
- [ ] **Print recipe** — open a recipe in view mode; click the printer icon; confirm browser print dialog opens with clean layout (no sidebar/nav)

---

#### 💰 Corner (Spending & Bulk Buy)

- [ ] **Add receipt** — upload a receipt image and enter an amount and description; confirm it appears in the receipts list
- [ ] **Spending charts** — navigate to the Spending tab; confirm the monthly bar chart and per-member doughnut chart render with data
- [ ] **Meal credits** — add meal credits for a member; confirm the credit appears
- [ ] **The Equalizer** — confirm the balance calculation shows who owes what across the group
- [ ] **Bulk buy run** — create a new bulk buy run; add items from multiple members; confirm all items appear under the run

---

#### 📦 Cuisine (Inventory & Shopping)

- [ ] **Add inventory item** — add a protein with a use-by date; confirm it appears in the inventory list
- [ ] **Edit inventory item** — change the quantity; confirm it updates
- [ ] **Delete inventory item** — delete an item; confirm it's removed
- [ ] **Vacuum seal log** — add a vacuum seal entry with seal date and expiry date; confirm it appears in the log
- [ ] **Product search** — search for a product by name in the product catalog; confirm results appear
- [ ] **Barcode scan** — scan a real product barcode; confirm Open Food Facts lookup returns product data
- [ ] **Shopping list — create** — create a new shopping list named "Weekly Shop"
- [ ] **Shopping list — add item** — search for a product and add it to the list; add a second item manually
- [ ] **Shopping list — check off** — tap an item to check it; confirm it moves to the bottom with strikethrough style
- [ ] **Shopping list — clear checked** — clear all checked items; confirm they're removed
- [ ] **Shopping list — print** — click Print; confirm browser print dialog opens with clean list layout (no sidebar/nav, checkboxes visible)
- [ ] **Complete list** — mark the list as complete; confirm it's archived

---

#### 🌿 Garden (Kultivate)

- [ ] **Add plant** — add a plant with name, date planted, and expected harvest date
- [ ] **Log harvest** — log a harvest for the plant with yield amount; confirm it appears in the harvest log
- [ ] **Auto-add to inventory** — after logging a harvest, confirm the option to add it to inventory; confirm it appears in Cuisine inventory
- [ ] **Growing Guides** — browse the plant guide library; open a guide; confirm companion plants, spacing, and tips are displayed

---

#### 🔄 Meal Swap

- [ ] **Create swap week** — create a new swap week with a swap day
- [ ] **Assign entrée** — assign an entrée name (and optionally a recipe) to a member for the week
- [ ] **Mark entrée ready** — change an entrée status to "ready"; confirm the notification fires
- [ ] **Rate an entrée** — submit a star rating and comment on another member's entrée
- [ ] **View swap history** — confirm past swap weeks appear

---

#### 🛒 Kitchen Orders

- [ ] **Add menu item** — link a recipe to the menu and mark it available
- [ ] **Place an order** — as a member, request a menu item with quantity and note
- [ ] **Accept/decline order** — as admin, accept or decline the request; confirm status updates for the requester
- [ ] **Mark order ready** — mark an accepted order as ready; confirm a notification is sent to the requester

---

#### 💬 Group Chat

- [ ] **Send a message** — send a message as admin; confirm it appears in the chat
- [ ] **Receive a message** — as member (second browser), send a message; confirm it appears for admin within 10 seconds (polling)
- [ ] **Consecutive messages** — send 3 messages in a row from the same user; confirm the avatar/name only shows on the first
- [ ] **Delete a message** — hover over your own message; click delete; confirm it's removed (soft-deleted)
- [ ] **Load older** — if more than 100 messages exist, confirm "Load older" button appears and loads the previous page

---

#### 🔔 Notifications

- [ ] **Notification fires** — perform an action that triggers a notification (e.g. log a harvest, post a bulk buy run); confirm the bell badge appears for the relevant member
- [ ] **Mark as read** — open the notification dropdown and click a notification; confirm the badge clears
- [ ] **Notification preference respected** — turn off "Garden" notifications in Profile; log another harvest; confirm no notification is created for members who have it disabled

---

#### 📅 Group Calendar

- [ ] **Add event** — create a calendar event with a title, date, and type (planting, harvest, swap day, etc.)
- [ ] **View event** — confirm the event appears on the correct date
- [ ] **Delete event** — delete the event; confirm it's removed

---

#### 📸 Meal Gallery

- [ ] **Upload photo** — upload a photo with a caption and stage (plated, stored, prep)
- [ ] **View gallery** — confirm the photo appears in the group gallery feed
- [ ] **Filter by stage** — filter by "plated"; confirm only plated photos show
- [ ] **Delete photo** — delete your own photo; confirm it's removed

---

#### 🏷️ Label Generator

- [ ] **Fill out a label** — enter item name, contents, source, cook temp, cook time, seal date, and notes
- [ ] **Add QR code** — enter a URL in the link field; confirm the QR code preview appears
- [ ] **Multiple labels** — add a second label; switch between them using the selector tabs
- [ ] **Print labels** — click Print Labels; confirm the browser print dialog shows only the label cards (no editor panel)

---

#### 🔧 Equipment

- [ ] **Browse catalog** — confirm the equipment catalog loads with categories and recommended items
- [ ] **Add group equipment** — add a catalog item to the group's equipment list with quantity and condition
- [ ] **View group equipment** — confirm the added item appears in the group's owned equipment list

---

#### 💡 Suggestions

- [ ] **Submit suggestion** — submit a meal suggestion
- [ ] **Vote** — upvote a suggestion from the second account; confirm the vote count updates
- [ ] **Change status** — mark a suggestion as planned; confirm the status label updates

---

#### ❓ Help

- [ ] **Help page loads** — confirm all sections are present and readable on mobile and desktop

---

#### 💳 Billing

- [ ] **Billing page loads** — navigate to `/billing`; confirm current plan is shown
- [ ] **Upgrade flow (test mode)** — click Upgrade; confirm redirect to Stripe Checkout (requires `STRIPE_SECRET_KEY` set in `.env`); use a Stripe test card (`4242 4242 4242 4242`); confirm redirect back to `/billing?success=true`; confirm plan shows as Pro
- [ ] **Billing portal** — as a Pro user, click Manage; confirm redirect to Stripe Billing Portal

---

#### 📱 PWA & Mobile

- [ ] **Install on Android** — open the app in Chrome on Android; confirm the install banner appears; install; confirm the app opens full-screen from the home screen icon
- [ ] **Install on iOS** — open the app in Safari on iPhone/iPad; confirm install instructions appear; follow them; confirm the app opens full-screen from the home screen icon
- [ ] **Offline shell** — install the PWA; turn off WiFi; open the app; confirm the shell loads (may not have fresh data but should not show a browser error page)
- [ ] **Responsive layout** — on a phone, confirm the sidebar is hidden, the hamburger menu works, and all modals are usable with touch

---

#### 🔁 Sync Mode

- [ ] **Auto mode** — with auto sync enabled, navigate around the app; confirm the sidebar sync badge shows "Synced" and updates the timestamp
- [ ] **Manual mode** — switch to manual sync; perform a write action (add an inventory item); confirm the badge shows "Pending (1)"; click Sync Now; confirm badge returns to "Synced"
- [ ] **Offline indicator** — disconnect from the internet; confirm the badge shows "Offline" (red dot)

---

#### 🖨️ Print Views

- [ ] **Recipe print** — open a recipe in view mode; click the printer icon; confirm print preview shows recipe content cleanly with no sidebar, header, or buttons
- [ ] **Shopping list print** — open a shopping list; click Print; confirm print preview shows grouped items with checkboxes and section headers, no nav

---

**Test sign-off:** Date ________ · Tester ________ · Build/version ________ · Pass ☐ / Fail ☐ (list failures below)

---

### ✅ 17. Cloud Deployment *(shipped May 2026 — Render for both backend and frontend)*

**Goal:** Move the app off David's local machine and onto cloud infrastructure that runs 24/7, is accessible from any device anywhere, and scales cleanly as the group grows. This is the production-ready path.

**Chosen stack:**
- **Backend:** [Railway](https://railway.app) — hosts the Express server + PostgreSQL database in one place, one dashboard. Free tier available; ~$5/mo for always-on.
- **Frontend:** [Vercel](https://vercel.com) — deploys the React/Vite build automatically on every git push. Generous free tier, global CDN.
- **File storage:** [Cloudflare R2](https://www.cloudflare.com/products/r2/) — stores uploaded files (avatars, meal photos, product images, receipts). Zero egress fees. Free for low volume.
- **Domain:** Register a `.com` via Namecheap or Cloudflare (~$10–12/year), point it at Vercel (frontend) and Railway (backend API).

---

#### Phase 1 — PostgreSQL Migration (biggest task, do first)

The app currently uses SQLite (`data.db` local file). PostgreSQL is required for cloud hosting because Railway and most cloud providers don't support SQLite.

- [ ] **Audit `db.js` for SQLite-specific syntax** — find and replace:
  - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
  - `datetime('now')` → `NOW()`
  - `TEXT DEFAULT '{}'` (JSON columns) → `JSONB DEFAULT '{}'` (PostgreSQL native JSON)
  - `PRAGMA foreign_keys = ON` → remove (PostgreSQL enforces FKs by default)
  - `PRAGMA journal_mode = WAL` → remove (not applicable)
  - `sqlite3` and `sqlite` packages → `pg` (node-postgres) package
- [ ] **Rewrite `db.js`** — replace the `open()` / `sqlite` wrapper with a `pg.Pool`. Query signatures change: `db.get()` → `pool.query()` returning `rows[0]`; `db.all()` → `pool.query()` returning `rows`; `db.run()` → `pool.query()`.
- [ ] **Create a PostgreSQL schema file** (`server/schema.sql`) — all `CREATE TABLE IF NOT EXISTS` statements converted to PostgreSQL syntax. Run this once on the new Railway database to set up the schema.
- [ ] **Data migration script** — a one-time `server/scripts/migrate-sqlite-to-pg.js` that reads from the local SQLite `data.db` and bulk-inserts into the Railway PostgreSQL database. Run once, verify row counts, then decommission SQLite.
- [ ] **Test locally with PostgreSQL** — install PostgreSQL locally (or use Docker: `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres`) and verify all routes work before touching Railway.

---

#### Phase 2 — File Storage Migration (Cloudflare R2)

Currently uploads live in `server/uploads/` on disk. In the cloud, the server's disk is ephemeral — files disappear on restart. R2 is the fix.

- [ ] **Create a Cloudflare account** and enable R2. Create a bucket named `krystles-hub`.
- [ ] **Install `@aws-sdk/client-s3`** — R2 is S3-compatible, so the AWS SDK works with a custom endpoint.
- [ ] **Create `server/utils/r2.js`** — S3 client pointed at the R2 endpoint (`https://<account_id>.r2.cloudflarestorage.com`), with `PutObjectCommand` for upload and `GetObjectCommand` (or pre-signed URLs) for retrieval.
- [ ] **Update all multer configs** — after `sharp` compresses the image buffer, pipe it to R2 instead of writing to disk. Return the R2 object key (not a local path) to store in the database.
- [ ] **Update image URL generation** — replace `${API_BASE}/uploads/avatars/...` style URLs with R2 public bucket URLs or pre-signed URLs. The R2 bucket can be made public for read access so images load directly without going through the API server.
- [ ] **Migrate existing uploads** — a one-time script to upload every file from `server/uploads/` to R2 and update the DB paths.

---

#### Phase 3 — Railway Backend Deployment

- [ ] **Create a Railway account** at railway.app. Start a new project.
- [ ] **Add a PostgreSQL database** from the Railway template. Copy the `DATABASE_URL` connection string.
- [ ] **Connect the GitHub repo** to Railway. Set the root directory to `server/`. Railway auto-detects Node.js and runs `npm start`.
- [ ] **Set environment variables** in Railway dashboard:
  ```
  DATABASE_URL=<from Railway PostgreSQL>
  JWT_SECRET=<32+ random bytes>
  REFRESH_TOKEN_SECRET=<32+ random bytes>
  FRONTEND_URL=https://yourdomain.com
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_PRICE_ID=price_...
  R2_ACCOUNT_ID=...
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
  R2_BUCKET_NAME=krystles-hub
  EMAIL_USER=...
  EMAIL_PASS=...
  ```
- [ ] **Run schema migration** — connect to the Railway PostgreSQL instance and run `schema.sql` to create all tables.
- [ ] **Run data migration** — run `migrate-sqlite-to-pg.js` pointed at Railway's `DATABASE_URL` to import existing data.
- [ ] **Verify API health** — hit `https://<railway-app>.railway.app/api/health` and confirm `{ status: 'ok' }`.

---

#### Phase 4 — Vercel Frontend Deployment

- [ ] **Create a Vercel account** at vercel.com. Import the GitHub repo. Set root directory to `client/`.
- [ ] **Set environment variable** in Vercel dashboard:
  ```
  VITE_API_URL=https://<railway-app>.railway.app
  ```
- [ ] **Verify build** — Vercel runs `npm run build`. Confirm no build errors. The PWA manifest and service worker will be included in the build output automatically.
- [ ] **Test the deployed app** — register a new account, create a group, upload a photo, send a chat message. Verify all routes work against the Railway backend.

---

#### Phase 5 — Domain & Final Wiring

- [ ] **Register a domain** — e.g. `krystleshub.com` via Namecheap or Cloudflare (~$10–12/year).
- [ ] **Point domain at Vercel** — add the custom domain in Vercel dashboard; add CNAME/A records at the registrar. Vercel provisions SSL automatically.
- [ ] **Add API subdomain** — create `api.krystleshub.com` as a custom domain on the Railway service. Update `VITE_API_URL` on Vercel to `https://api.krystleshub.com`.
- [ ] **Update Stripe webhook URL** — in Stripe Dashboard, update the webhook endpoint from localhost to `https://api.krystleshub.com/api/billing/webhook`.
- [ ] **Update CORS** — confirm `FRONTEND_URL=https://krystleshub.com` is set in Railway so the backend only accepts requests from the real domain.
- [ ] **Update PWA manifest** — confirm `start_url` and `scope` in `vite.config.js` still work with the production domain (they should — both are `/`).
- [ ] **Test install on a real phone** — open `https://krystleshub.com` in Chrome on Android or Safari on iOS. Verify the install prompt appears and the PWA installs correctly.

---

#### Phase 6 — Go-Live Checklist

- [ ] Terms of Service page (`/terms`) — required by Stripe before live payments
- [ ] Privacy Policy page (`/privacy`) — required by Stripe; also required for App Store if native app is ever pursued
- [ ] Test Stripe live mode — make a real $1 test purchase (use a real card, then immediately cancel via billing portal to get a refund)
- [ ] Set up error monitoring — create a free [Sentry](https://sentry.io) account, add the Sentry SDK to both server and client, verify errors are captured
- [ ] Set up uptime monitoring — free [UptimeRobot](https://uptimerobot.com) pinging `https://api.krystleshub.com/api/health` every 5 minutes with email alert on downtime
- [ ] Back up the Railway PostgreSQL database — enable Railway's automatic backups or set up a weekly `pg_dump` cron
- [ ] Send Krystle's crew their invite links from the production URL

---

**Estimated monthly cost at launch:**
- Railway (backend + PostgreSQL): ~$5–10/mo
- Vercel (frontend): $0 (free tier)
- Cloudflare R2 (file storage): $0 (free up to 10GB storage / 1M requests)
- Domain: ~$1/mo amortized
- **Total: ~$6–11/mo**

---

## 💳 Free vs. Paid Tiers

The app will use a freemium model. All users get a free tier. Upgrading to the paid tier unlocks group collaboration features.

---

### Free Tier (Individual Use)

Everything a single user needs to manage their own kitchen and garden:

- ✅ Account (register, login, profile, avatar, social links)
- ✅ [Name]'s Kitchen — personal recipe library (create, tag, photo, how-to skills)
- ✅ [Name]'s Cuisine — personal inventory, vacuum seal log, personal shopping lists, product catalog + barcode lookup
- ✅ [Name]'s Kultivate — garden tracker, harvest log, auto-stock inventory, Growing Guides library
- ✅ Equipment — browse the catalog and reference standard supplies
- ✅ Label Generator — print parchment instruction cards with QR codes
- ✅ Help page

**Not available on Free:**
- ❌ Creating or joining a group
- ❌ Invite codes / email invites
- ❌ Any group-shared features (Corner, Meal Swap, shared shopping lists, Bulk Buy, Personal Inventory Calendar, Meal Gallery, Notifications, Weekly Digest, Sync)

---

### Paid Tier (Group Plan) — unlocks everything above PLUS:

- ✅ Create a group (up to 5 members including yourself)
- ✅ Invite up to 4 other users by email or invite code
- ✅ [Name]'s Corner — receipt pooling, The Equalizer, Meal Credits
- ✅ Meal Swap — weekly swap planner, Swap Day, status tracking
- ✅ Bulk Buy runs — shared Sam's Club/Costco coordination with per-item settlement
- ✅ Shared Shopping Lists — group-visible lists with section grouping
- ✅ Personal Inventory Calendar — per-user freezer inventory with expiry tracking and use-by date reminders
- ✅ Meal Gallery — group photo feed (plated, stored, prep stages)
- ✅ In-app Notifications — group activity alerts
- ✅ Weekly Email Digest — group summary email
- ✅ Group Sync Mode — auto/manual sync with last-synced visibility

---

### Implementation Notes (for when we build this)

- Add a `plan` field to `users` table: `free | paid`
- Middleware: `requirePaid` — returns 403 with upgrade prompt if `user.plan === 'free'`
- Apply `requirePaid` to all group routes (`/api/groups`, `/api/korner`, `/api/swaps`, `/api/digest`, etc.)
- Frontend: group-locked pages show an "Upgrade to unlock groups" card instead of content
- Upgrade flow: for now (local/dev), an admin toggle in the DB. For cloud: integrate Stripe or LemonSqueezy for payments
- Free users who are invited to a group by a paid member can participate without paying — they're a "guest" group member. Their individual channels stay free; they gain access to shared group features only.

**Pricing suggestion (to be finalized):**
- Free: $0 forever
- Group Plan: ~$4–6/month per group creator (members join at no charge through the app)

**Payment model:**
- Only the group creator (admin) holds the paid subscription
- The 4 invited members join and use all group features at no charge through the app
- If the group admin wants to split the monthly cost with their members, that's up to them — they can use Corner's Equalizer or handle it however they like outside the app
- The app never collects payment from anyone except the group admin account
- One subscription per group; if a user creates multiple groups they pay per group (a multi-group plan could be offered later)

**Roles to document:**
- `group_admin` — the account that created the group; holds the paid plan; can invite/remove members, create swap weeks, send digest, manage group settings
- `group_member` — invited users; free to join; can use all group features but cannot manage group settings or invite others

**Implementation note:** The `plan` field stays on the `users` table (`free | paid`). The `group_members` table already has a `role` field or needs one added (`admin | member`). Payment processing only ever touches the admin user's account.

---

## ☁️ Cloud & Cross-Platform Deployment (Future)

**Goal:** Move from local-only to a cloud-hosted app with optional local mode for offline/low-connectivity use.

### Cloud Deployment Plan

- Host the Express backend on a cloud provider (Railway, Render, or Fly.io recommended — free tiers available, easy Node.js deploy)
- Replace SQLite with PostgreSQL (hosted on Railway/Supabase/Neon) — migration will require converting SQLite-specific syntax (e.g. `AUTOINCREMENT` → `SERIAL`, date functions)
- Store uploaded files (avatars, meal photos, product images) in cloud object storage (Cloudflare R2 or AWS S3) instead of local `uploads/` folder
- Deploy the React frontend to Vercel or Netlify (static hosting, free tier)
- Environment variables (`.env`) will need to be configured in the cloud provider's dashboard

### Local / Offline Mode (Per-Device)

- The PWA (backlog item #5) enables install-to-home-screen on Android and iOS
- Service worker caches key pages (shopping list, recipes, inventory) for offline reading
- Offline writes queue locally and sync when connection is restored (IndexedDB + background sync) — see **Group Sync Mode (item #9)** for the full sync architecture and per-channel breakdown
- Parts that always require internet: Open Food Facts barcode/search, email digest sending, group sync

### Mobile App (Native — Further Future)

- React Native or Capacitor (wraps existing React code) for true native iOS/Android app
- Capacitor is preferred — reuses 90% of current React components, adds native camera (barcode scanner), push notifications, and app store distribution
- iOS: requires Apple Developer account ($99/year)
- Android: Google Play ($25 one-time)

### When Ready to Go Cloud — Checklist

- [ ] Swap SQLite → PostgreSQL — **create a detailed migration plan first** (see notes below)
  - `db.js` is 72KB — significant conversion effort
  - Convert `AUTOINCREMENT` → `SERIAL`, SQLite date functions → PostgreSQL equivalents, `TEXT` defaults, boolean handling
  - Write and test migration script against a copy of the production database
  - ⚠️ **Back up the SQLite database before running migration**
- [ ] Set up S3/R2 bucket for file uploads (update multer storage config)
- [ ] Configure CORS for production domains
- [x] Complete Security Hardening (backlog item #3) — done
- [ ] Deploy backend to Railway/Render
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Register and point a custom domain
- [ ] Test email digest with production SMTP
- [ ] Create Terms of Service and Privacy Policy (required by Stripe/LemonSqueezy before account approval; also needed for user trust since you're handling personal data)
- [ ] Add error logging and monitoring — Winston or Pino for structured server logs; Sentry for real-time error alerts (free tier available)
- [ ] ⚠️ Back up SQLite database before starting PostgreSQL migration

---

## 🔮 Future Enhancements (Not Yet Scheduled)

Tracked ideas from feature implementation docs. Not prioritized — pick up when relevant backlog items are done.

### Simplify Channel Nav Labels
- [ ] Remove the personalized first name prefix from sidebar nav links — `{fn}'s Kitchen` → `Kitchen`, `{fn}'s Corner` → `Corner`, `{fn}'s Cuisine` → `Cuisine`, `{fn}'s Garden` → `Garden`
- [ ] The user's name in the upper-left of the sidebar is enough personalization
- [ ] Update `Layout.jsx` channels array — remove `${fn}` from all labels
- [ ] Check page headers inside each page (Kitchen.jsx, Korner.jsx, etc.) and simplify those too if they repeat the name

### Responsive Layout Polish — Device-Specific Optimization
- [ ] **Audit current layouts on real devices** — test on S24+, Galaxy Z Fold, Samsung Tab S6, and desktop/widescreen; document what scrolls unnecessarily or looks cramped
- [ ] **S24+ / tall phone** — single column, larger tap targets, bottom-anchored action buttons, reduce card padding so more content fits without scrolling
- [ ] **Galaxy Z Fold (folded)** — treat as narrow phone; unfolded (tablet mode) gets two-column layout with sidebar always visible
- [ ] **Samsung Tab S6 / tablet landscape** — two or three column grid for dashboard, sidebar always visible, modals wider, recipe cards in a grid not a list
- [ ] **Desktop / widescreen** — three-column layouts where appropriate (sidebar + content + detail panel), wider modals, more data visible without scrolling
- [ ] **Use Tailwind breakpoints consistently** — `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px); audit every page for missing responsive classes
- [ ] **Test foldable viewport change** — Galaxy Z Fold fires a resize event when unfolded; app should reflow without a full reload
- [ ] **Kitchen/recipe modal** — on tablet+, show recipe detail as a side panel instead of a full-screen modal
- [ ] **Dashboard** — on tablet+, show group members and stats in a multi-column grid instead of stacked cards

### SMS / Twilio Integration
- [ ] **Add phone number field to user profiles** — optional, stored on `users` table; shown in Profile settings with a "Verify" button
- [ ] **Twilio account setup** — sign up at twilio.com, get a phone number (~$1/mo), note `ACCOUNT_SID`, `AUTH_TOKEN`, `FROM_NUMBER` env vars
- [ ] **SMS 2FA** — swap email code delivery in `POST /api/auth/2fa/send` for Twilio SMS when user has a verified phone number on file; fall back to email if no phone
- [ ] **Group chat SMS notifications** — when a group member is offline, send an SMS digest of new chat messages (configurable in notification prefs)
- [ ] **Estimated cost:** ~$0.0075/text via Twilio; suitable once app has paying users to offset the cost

### Barcode Scanner Enhancements *(from CAMERA_BARCODE_SCANNER.md)*
- [ ] Upgrade to `quagga2` for better damage/angle tolerance on physical barcodes
- [ ] Batch scanning mode — scan multiple items without closing the modal
- [ ] Scan history / favorites — quick re-add previously scanned products
- [ ] Haptic / sound feedback on successful scan
- [ ] Offline barcode cache — store recent Open Food Facts lookups for offline use
- [ ] Multi-format support — EAN-13, UPC-A, QR codes from the same scanner

### Recipe Import Enhancements *(from RECIPE_IMPORT_URL.md)*
- [ ] Auto photo crawl — pull hero image from recipe page during import
- [ ] Batch import — paste multiple URLs to import several recipes at once
- [ ] Import history / recent imports — quick re-import or review past imports
- [ ] `recipe-scrapers` fallback — use HTML scraping for sites without JSON-LD markup
- [ ] Duplicate detection — warn if an imported recipe matches an existing one
- [ ] Auto-tagging — suggest skill tags based on imported recipe content (e.g. "vacuum seal", "flash freeze")
- [ ] Ingredient normalization — standardize units and ingredient names on import
- [ ] Source attribution — display original URL on imported recipe cards

---

## ✅ Completed Features

- [x] **Meal Request / Order Page — "Krystle's Kitchen Orders"** *(shipped May 2026)*
  - `menu_items` table — recipes Krystle marks as available for order (price label, note, show/hide toggle)
  - `meal_requests` table — client requests with quantity, note, and status flow (`pending → accepted → ready → picked_up`, or `declined`)
  - `role` column added to `users` table via safe migration
  - Backend: `GET/POST/PUT/DELETE /api/orders/menu/:groupId` (admin) + `GET/POST /api/orders/requests` + `PUT /api/orders/requests/:id/status`
  - Admin view: Menu Manager (add from recipe library, toggle visibility, inline price/note edit, remove) + Requests tab (status badge, action buttons, decline confirm)
  - Client/Member view: recipe card grid browse with image, description, sides, price + Request modal (quantity 1–10 + note) + My Requests tab with color-coded status badges
  - Notifications: new request → notifies group admin; status → ready/declined → notifies requester
  - "Kitchen Orders" added to sidebar/mobile nav (ShoppingBag icon)
  - Route: `/orders` in App.jsx

- [x] Four named channels: Kitchen, Corner, Cuisine, Kultivate
- [x] Equipment tracking + Standard Supplies catalog
- [x] Product catalog with Open Food Facts integration + barcode text input
- [x] Shopping lists with section grouping and check-off
- [x] Bulk Buy runs with per-item cost settlement
- [x] Meal Swap — weekly, one meal per person, Swap Day, full status flow
- [x] Personal Inventory Calendar with expiry color coding
- [x] Meal Gallery with photo upload (plated / stored / prep stages)
- [x] Label Generator with QR codes
- [x] In-app Notifications with bell icon
- [x] Weekly Email Digest
- [x] User profiles with avatar and social links
- [x] Plant Growing Guides library (20+ plants, external resource links)
- [x] Help page with all features documented
- [x] Personalized channel names (uses logged-in user's first name)
- [x] Email invitations for group members
- [x] Logout + password show/hide toggle
- [x] Suggestions page — Meal Ideas + App Feedback with upvote/downvote voting
- [x] Mobile optimization — responsive layout, hamburger nav, touch-friendly tap targets, mobile-first modals *(built and code-complete; full phone testing deferred until cloud deployment)*
- [x] Camera Barcode Scanner — live camera modal with jsQR, scan overlay, fallback to manual input; integrated in Cuisine inventory + vacuum seal forms
- [x] Recipe Import from URL — cheerio-based JSON-LD parser with OG metadata fallback, backend fetch endpoint, ImportRecipeModal with two-step preview/edit flow, prep/cook time fields, image preview; integrated in Kitchen
- [x] Meal Ratings — 1–5 stars + comment per completed swap entrée; aggregate rating display on Kitchen recipe cards; rate button in past swaps view
- [x] Meal → Entrée Refactor + Sides Recommendations — all user-facing "meal" text renamed to "entrée"; `sides` column added to recipes with create/edit/detail/import/digest support
- [x] **Page Rename: Kultivate → Garden** *(shipped May 2026)*
  - Display text updated across Layout, Dashboard, Help, Kultivate page header, Labels default/placeholder, and Profile notification prefs
  - API routes (`/api/kultivate`), DB columns, file names, and URL paths unchanged (non-breaking)

- [x] **Page Rename: Korner → Corner, Kuzine → Cuisine** *(shipped May 2026)*
  - Display text updated across Layout, Dashboard, Help, Kultivate, Labels, and ROADMAP
  - No files or routes renamed — API routes (`/api/korner`, `/api/kuzine`) and DB column names unchanged (non-breaking)

---

*Last updated: May 2026*
