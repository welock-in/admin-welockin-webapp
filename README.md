# WeLockin Admin

Operations console for WeLockin: a real-time view of who is focusing right now,
every user profile with detailed stats, account moderation, and management of the
curated addiction-protection blocklist. Built with **Next.js (App Router) +
TypeScript + Tailwind**.

It is a thin, read-mostly front end over the WeLockin backend
([`cloud-backend`](https://app.connect.welock.in)); all data and every action go
through the backend's admin API under `/api/admin/*`. This app stores nothing of
its own — no database.

---

## Architecture & auth

The admin JWT is obtained from the backend and kept in an **httpOnly cookie**
(`wl_admin`), never exposed to browser JavaScript. Two paths reach the backend:

- **Server Components** read the cookie and call the backend directly
  (`src/lib/backend.ts` → `backendGet`). Initial page loads render server-side.
- **Client Components** (live polling, moderation buttons) call the same-origin
  proxy `/api/proxy/admin/*` (`src/lib/client.ts` → `apiGet` / `apiSend`), which
  injects the token from the cookie server-side and forwards to the backend.
  Supported methods: `GET`, `POST`, `PATCH`, `DELETE`.

`src/middleware.ts` gates every route behind the cookie, redirecting to `/login`
when it is missing.

**Credentials live in the *backend's* environment** (`ADMIN_USERNAME` /
`ADMIN_PASSWORD` / `ADMIN_JWT_SECRET`), not in this app. Sign-in on `/login`
forwards them to `POST /api/admin/login`, which returns a short-lived admin JWT
(default 12 h).

---

## Pages

| Route | What it shows | Backend endpoints used |
|---|---|---|
| `/login` | Username/password sign-in. | `POST /api/admin/login` (via `/api/login`) |
| `/` — **Dashboard** | Global stat cards (live now, total/suspended users, sessions today/7d, all-time & 7d focus time, active users, new users, devices) + a live-sessions panel that polls every ~10 s. | `GET /admin/overview`, `GET /admin/live-sessions` (polled) |
| `/users` | Searchable, paginated user list with per-user rollups (devices, sessions, focus time, last active, live-now). | `GET /admin/users?search=&skip=&take=&sortBy=&sortDir=` |
| `/users/[id]` | Full profile: identity, devices, a rich stat pack, synced snapshot, live sessions, recent events — plus **moderation**: suspend / unsuspend, set plan (audited grant/withdraw with reason, end date, and typed confirmation for a permanent lifetime), delete account, and force-end a live session. Includes the **payments & entitlement panel** (`PaymentPanel`): purchases and subscriptions as recorded, comp / revoke / trial reset, cancel & reactivate a subscription, and (when test mode is on) the synthetic-subscription test lab. | `GET /admin/users/:id`, `POST /admin/users/:id/{suspend,unsuspend,plan,comp,revoke,trial-reset,cancel-subscription,reactivate-subscription,test-subscription,subscription-transition,subscription-time}`, `DELETE /admin/users/:id{,/comp,/revoke,/test-subscription/:subId}`, `POST /admin/live-sessions/:id/force-end` |
| `/billing` | **Billing tasks** — the cancellation outbox owed to Lemon Squeezy. Pending rows retry on their own; **dead-lettered** rows (attempts exhausted, still unsettled) are highlighted red with a per-row **Replay**, plus a global **Drain now**. The sidebar shows a red badge with the dead-letter count. | `GET /admin/billing-tasks`, `POST /admin/billing-tasks/drain`, `POST /admin/billing-tasks/:id/replay` |
| `/protection` | **Addiction-protection** admin. Two tabs: **Blocklist** (search/filter, add one entry, bulk-import many, toggle active, delete) and **Active protection** (every account with protection ON — email, method, the partner OTP or lock-until date, and a force-disable), auto-refreshed. | `GET/POST /admin/addiction-protection`, `POST /admin/addiction-protection/import`, `PATCH/DELETE /admin/addiction-protection/:id`, `GET /admin/addiction-protection/active`, `POST /admin/addiction-protection/active/:id/disable` |
| `/notifications` | Push-notification console: send an ad-hoc push, see recent deliveries, and manage templates + rules. | `POST /admin/notifications/send`, `GET /admin/notifications/deliveries`, `GET/POST/PATCH/DELETE /admin/notifications/{templates,rules}` |

> The **Live now** figure and the live-sessions panel only populate once desktop
> clients send heartbeats (`POST /api/sessions/heartbeat`, ~every 5 min during a
> focus session). A quiet dashboard means nobody is currently focusing.

---

## Setup

```bash
cp .env.local.example .env.local   # set BACKEND_API_URL
npm install
npm run dev                        # http://localhost:3210
```

`.env.local`:

```
BACKEND_API_URL="https://app.connect.welock.in/api"   # or http://localhost:8787/api
```

On the **backend** (see `cloud-backend`), set and redeploy:

```
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="<a strong password>"      # admin login is DISABLED while empty
ADMIN_JWT_SECRET="<a long random string>" # separate from the user JWT secret
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port **3210**. |
| `npm run build` | Production build (`next build`). |
| `npm start` | Serve the production build on port 3210. |
| `npm run typecheck` | `tsc --noEmit`. |

## Deploy

A standalone Vercel/Node project (it is **not** part of the monorepo's pnpm
workspace). Set `BACKEND_API_URL` in the host's environment. It needs no database
and no other services — only reachability to the backend admin API.

---

## Project structure

```
src/
  middleware.ts               # cookie gate → redirect to /login
  app/
    login/page.tsx            # sign-in form
    api/login|logout/route.ts # set/clear the httpOnly admin-JWT cookie
    api/proxy/[...path]/route.ts   # token-injecting proxy to the backend (GET/POST/PATCH/DELETE)
    (dashboard)/
      layout.tsx              # authenticated shell (+ initial dead-letter badge count)
      page.tsx                # Dashboard (overview + live sessions)
      users/page.tsx          # user list
      users/[id]/page.tsx     # user detail + moderation + payments panel
      billing/page.tsx        # billing-task outbox (dead-letters, replay, drain)
      protection/page.tsx     # addiction-protection admin (blocklist + active locks)
      notifications/page.tsx  # push notifications (send, templates, rules)
  components/                 # Shell, LiveSessions, UserModeration, PaymentPanel,
                              # BillingTasks, ForceEndButton, Charts, ui
  lib/
    backend.ts                # server-side backend client (reads the cookie)
    client.ts                 # client-side proxy helpers (apiGet / apiSend)
    types.ts                  # shared DTO types
    format.ts                 # number/date/duration formatting
```
