# Deploying to Render

## Prerequisites
- Render account at render.com
- GitHub repo with this project pushed to it

## Step 1 — Push to GitHub
If not already on GitHub, create a repo and push:
```
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Step 2 — Deploy via Blueprint (render.yaml)
1. Log into render.com
2. Click **New** → **Blueprint**
3. Connect your GitHub repo
4. Render will detect `render.yaml` and create both services automatically

## Step 3 — Set environment variables
After the Blueprint creates your services, go to each service's **Environment** tab and fill in:

### Server service (krystles-brand-hub-server):
- `JWT_SECRET` — auto-generated, leave as-is
- `EMAIL_HOST` — `smtp.gmail.com`
- `EMAIL_PORT` — `587`
- `EMAIL_USER` — your Gmail address
- `EMAIL_PASS` — Gmail App Password (not your regular password — see Step 6)
- `FRONTEND_URL` — your client's Render URL (e.g. `https://krystles-brand-hub-client.onrender.com`)

### Client service (krystles-brand-hub-client):
- `VITE_API_URL` — your server's Render URL + `/api` (e.g. `https://krystles-brand-hub-server.onrender.com/api`)

> **Important:** After setting `VITE_API_URL` on the client service, trigger a manual redeploy — Vite bakes env vars at build time, so the service needs to rebuild to pick up the value.

## Step 4 — Persistent storage for SQLite
The free Render tier has an **ephemeral filesystem** — your SQLite database resets on each deploy.

**Option A (Simple — $7/month):** Add a Render Persistent Disk to the server service:
- Server service → **Disks** → **Add Disk**
- Mount path: `/data`
- Size: 1 GB (expandable later)
- `db.js` already writes to `/data/data.db` in production — no further code changes needed.

**Option B (Free workaround):** Migrate to Render's free PostgreSQL. Requires replacing `sqlite`/`sqlite3` with `pg` and rewriting all queries — significant lift, do this when you're ready to scale.

## Step 5 — File uploads
Uploaded photos and avatars are stored on the server's local disk. On Render, these will be lost on redeploy unless you add the same Persistent Disk from Step 4.

Mount the disk at `/data` and update any upload paths in `server/routes/` to use `/data/uploads/` in production.

Long-term: migrate to **Cloudinary** (free tier handles image compression too). Env vars are already stubbed in `.env.example`.

## Step 6 — Gmail App Password setup
1. Go to [myaccount.google.com](https://myaccount.google.com) → **Security** → **2-Step Verification** → **App Passwords**
2. Create an app password for "Mail"
3. Use that 16-character password as `EMAIL_PASS` — not your regular Gmail password

## Step 7 — Free tier cold starts
Render free tier spins down after 15 min of inactivity. First request after that takes 30–60 seconds to wake up.

To avoid this:
- Upgrade the server service to the **$7/month Starter** plan, or
- Use a free uptime monitor like [UptimeRobot](https://uptimerobot.com) to ping `/api/health` every 10 minutes

## Step 8 — Ongoing deploys
After any code change: push to GitHub → Render auto-deploys both services.

Check **Logs** under each service for startup errors.
