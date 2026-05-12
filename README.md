# Krystle's Brand Hub

> Healthy. Organic. Community-driven meal management.

A full-stack web app for Krystle's brand ecosystem — a 5-couple meal swap group built around organic cooking, professional food prep, and shared finances.

---

## The Four Channels

| Channel | Focus |
|---|---|
| **Krystle's Kitchen** | Recipe library with tags, skill tags (flash freeze, vacuum seal), and How-To references |
| **Krystle's Korner** | Group Finance Hub — receipt uploads, The Equalizer (fair share calculator), Meal Credits |
| **Krystle's Kuzine** | Prep & Inventory — group inventory, shared shopping list, vacuum seal log |
| **Krystle's Kultivate** | The Garden — plant tracking, harvest logging, seasonal calendar, auto-stock inventory |

Plus a **Label Generator** for printable parchment-ready instruction cards for vacuum-sealed bags.

---

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Express + Node.js
- **Database:** SQLite (via `better-sqlite3`) — auto-created on first run
- **Auth:** JWT + bcrypt
- **File uploads:** multer (receipt images)

---

## Quick Start

### Prerequisites
- Node.js 18+

### Setup (run once)

**macOS / Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

**Windows (PowerShell):**
```powershell
cd server; npm install; cd ../client; npm install; cd ..
mkdir server\uploads -ErrorAction SilentlyContinue
```

### Run the app

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd server
npm start
# Running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# Open http://localhost:5173
```

---

## Demo Accounts

The database is seeded automatically on first run:

| Name | Email | Password |
|------|-------|----------|
| Krystle | krystle@example.com | password123 |
| Marcus | marcus@example.com | password123 |
| Dana | dana@example.com | password123 |

All three are in the **"Krystle's Crew"** group (invite code: `KREW2024`).

---

## Project Structure

```
krystles-brand-hub/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── pages/           # Kitchen, Korner, Kuzine, Kultivate, Labels
│   │   ├── components/      # Layout, Navbar
│   │   ├── contexts/        # AuthContext
│   │   ├── App.jsx
│   │   └── api.js           # Axios instance with JWT interceptor
│   ├── tailwind.config.js   # Brand colors (moss, terra, cream, parchment)
│   └── vite.config.js       # Dev proxy → backend
│
├── server/                  # Express backend
│   ├── routes/
│   │   ├── auth.js          # Register / Login / Me
│   │   ├── groups.js        # Create / Join groups
│   │   ├── recipes.js       # Recipe CRUD
│   │   ├── korner.js        # Receipts, Equalizer, Meal Credits
│   │   ├── kuzine.js        # Inventory, Shopping, Vacuum Log
│   │   └── kultivate.js     # Plants, Harvests, Calendar
│   ├── middleware/auth.js   # JWT verification
│   ├── db.js                # SQLite schema + seed data
│   ├── uploads/             # Receipt images (auto-created)
│   └── index.js             # Express app entry
│
├── setup.sh                 # One-command setup
└── README.md
```

---

## Database Tables

`users` · `groups` · `group_members` · `recipes` · `receipts` · `meal_credits` · `inventory_items` · `shopping_list_items` · `vacuum_seal_log` · `garden_plants` · `harvest_logs`

---

## Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Moss | `#4d7c59` | Primary actions, nav, accents |
| Terra | `#c4622d` | Kitchen, labels, alerts |
| Slate | `#6b7280` | Neutral UI elements |
| Cream | `#faf7f2` | Page background |
| Parchment | `#f5edd8` | Label cards, highlight areas |

---

## API Reference

```
POST /api/auth/register        — Create account
POST /api/auth/login           — Login
GET  /api/auth/me              — Current user + groups

POST /api/groups               — Create group
GET  /api/groups               — My groups
GET  /api/groups/:id           — Group details + members
POST /api/groups/join          — Join by invite code

GET  /api/recipes              — All visible recipes
POST /api/recipes              — Create recipe
PUT  /api/recipes/:id          — Edit recipe
DELETE /api/recipes/:id        — Delete recipe

GET  /api/korner/:gid/receipts     — Group receipts
POST /api/korner/:gid/receipts     — Add receipt (multipart)
GET  /api/korner/:gid/equalizer    — Fair share calculation
GET  /api/korner/:gid/meal-credits — Credit balances + history
POST /api/korner/:gid/meal-credits — Log credit

GET  /api/kuzine/:gid/inventory    — Inventory list
POST /api/kuzine/:gid/inventory    — Add item
PUT  /api/kuzine/:gid/inventory/:id
DELETE /api/kuzine/:gid/inventory/:id
GET  /api/kuzine/:gid/shopping     — Shopping list
POST /api/kuzine/:gid/shopping
PATCH /api/kuzine/:gid/shopping/:id/toggle
GET  /api/kuzine/:gid/vacuum-log
POST /api/kuzine/:gid/vacuum-log

GET  /api/kultivate/:gid/plants    — Garden plants
POST /api/kultivate/:gid/plants
PUT  /api/kultivate/:gid/plants/:id
GET  /api/kultivate/:gid/harvests
POST /api/kultivate/:gid/harvests  — Log harvest (+ auto-inventory)
GET  /api/kultivate/:gid/calendar  — Grouped by harvest month
```
