# WeLockin Admin

Operations console for WeLockin: live focus sessions, all user profiles with
detailed statistics, and moderation (suspend / delete / change plan / force-end
a session). Built with **Next.js (App Router) + TypeScript + Tailwind**.

It talks to the WeLockin backend (`cloud-backend`, deployed at
`https://app.connect.welock.in`) via the admin API under `/api/admin/*`.

## How auth works

- The admin **username/password live in the backend's environment**
  (`ADMIN_USERNAME` / `ADMIN_PASSWORD`), not in this app.
- You sign in on `/login`; this app forwards the credentials to
  `POST /api/admin/login`, receives a short-lived admin JWT, and stores it in an
  **httpOnly cookie** (never exposed to browser JS).
- Server components read the cookie to call the backend directly; client
  components (live polling, moderation) go through `/api/proxy/admin/*`, which
  injects the token server-side.

## Setup

```bash
cd admin-dashboard
cp .env.local.example .env.local   # set BACKEND_API_URL
npm install
npm run dev                        # http://localhost:3210
```

`.env.local`:

```
BACKEND_API_URL="https://app.connect.welock.in/api"   # or http://localhost:8787/api
```

On the **backend**, set (and redeploy):

```
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="<a strong password>"
ADMIN_JWT_SECRET="<random string>"
```

Live sessions only appear once clients start sending heartbeats
(`POST /api/sessions/heartbeat`), which the desktop app does every ~5 minutes
during a focus session.

## Deploy

Deploy as a separate Vercel/Node project (it is not part of the pnpm workspace).
Set `BACKEND_API_URL` in the host's env.
