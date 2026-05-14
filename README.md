# Krystle's Brand Hub

A private group meal prep and lifestyle management app for small groups (up to 5 couples).

## Features

- **Kitchen** — recipe library, URL import, auto-scaling, photo gallery
- **Corner** — group finance, receipts, spending charts
- **Cuisine** — inventory, shopping lists, barcode scanner, vacuum seal log, bulk buy
- **Garden** — plant tracker, harvest log, growing guides
- **Entrée Swap** — weekly meal assignments and status tracking
- **Kitchen Orders** — curated menu and meal request system
- **Kultivate** — garden and harvest management
- **Group Chat** — in-app messaging
- **Suggestions** — meal ideas and app feedback voting
- **PWA** — installable on iOS, Android, and desktop

## Tech Stack

- **Frontend**: React 18, Vite 8, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: SQLite (via sqlite/sqlite3)
- **Auth**: JWT with refresh tokens, bcrypt
- **File uploads**: Multer
- **Email**: Nodemailer (Gmail SMTP)
- **Security**: Helmet, express-rate-limit, express-validator

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Clone the repo
2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```
3. Install client dependencies:
   ```bash
   cd client
   npm install --legacy-peer-deps
   ```
4. Create `server/.env` (see `server/.env.example`)
5. Start both servers:
   - Double-click `start.bat`, or
   - Run `node index.js` in `server/` and `npm run dev` in `client/`

### Environment Variables

See `server/.env.example` for all required variables.

## Deployment (Render)

- **Server**: Render Web Service (Node), root dir `server/`, start command `node index.js`
- **Client**: Render Static Site, root dir `client/`, build command `npm install --legacy-peer-deps && npm run build`, publish dir `dist`
- See `RENDER_SETUP.md` for full deployment guide

## Brand Colors

- Moss Green: `#6B7C5C`
- Terracotta: `#C4714F`
- Slate: `#6B7280`
