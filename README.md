# This or That (tot)

Crowd-sourced pairwise choices from Pinterest boards: admin creates instances, syncs pins, shares `/p/[slug]`; players tap, swipe, or use keys **1** / **2**.

## Test locally

1. **Env** — Copy [`.env.example`](./.env.example) to `.env.local` (or use the repo’s `.env.local` template). At minimum:

   - `DATABASE_URL="file:./prisma/dev.db"` (SQLite, no Docker)
   - `ADMIN_PASSWORD`, `ADMIN_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`

2. **DB** — From the project root:

   ```bash
   npx prisma db push
   npx prisma generate
   ```

3. **Dev server** — `npm run dev` → open [http://localhost:3000](http://localhost:3000).

4. **Admin** — [http://localhost:3000/admin](http://localhost:3000/admin). Sign in with **password** or **Google** (Connect modal). Password: `ADMIN_PASSWORD`.

5. **Google (optional)** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Web client. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` (same value), plus `GOOGLE_ALLOWED_EMAILS` (comma-separated). Authorized JavaScript origins: `http://localhost:3000`. The Connect modal uses Google’s **popup** sign-in.

6. **Pinterest (optional)** — Add `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `NEXT_PUBLIC_PINTEREST_APP_ID`. In the [Pinterest developer app](https://developers.pinterest.com/), redirect URI `http://localhost:3000/api/auth/pinterest/callback`. Use **Connect** in admin, create an instance, **Sync**, then open `/p/your-slug`.

**Postgres instead of SQLite** — Use [`docker-compose.yml`](./docker-compose.yml) (`docker compose up -d`), set `DATABASE_URL` to the Postgres URL, and in `prisma/schema.prisma` set `provider = "postgresql"`, then `npx prisma db push`.

## GitHub

This folder (`tot`) can be its **own** repository (recommended for Vercel):

```bash
cd tot
git init
git add -A
git status   # confirm .env.local and prisma/dev.db are NOT listed
git commit -m "Initial commit: This or That"
```

Create an empty repo on GitHub (no README/license if you want a clean history), then:

```bash
git remote add origin git@github.com:YOUR_USER/tot.git
git branch -M main
git push -u origin main
```

If `tot` lives inside a larger monorepo, this folder now has its **own** `.git`. Add `tot/` to the parent repo’s `.gitignore` if you do not want the parent to track it, or use a subtree/submodule workflow.

## Deploy (Vercel)

### 1. Database (production)

Vercel serverless cannot use SQLite on the filesystem. Use **PostgreSQL** (e.g. [Neon](https://neon.tech), Vercel Postgres).

1. In `prisma/schema.prisma`, set `provider = "postgresql"` under `datasource db` (keep `url = env("DATABASE_URL")`).
2. In Vercel → Project → **Environment Variables**, set `DATABASE_URL` to your Postgres connection string (same for Production / Preview if you want).
3. After the first deploy (or from your machine with prod `DATABASE_URL`):

   ```bash
   npx prisma db push
   ```

   That applies the schema to the remote database. For teams, prefer `prisma migrate` once you add migrations.

### 2. Vercel project

1. **Import** the GitHub repo (root directory should be the app root where `package.json` lives).
2. **Framework**: Next.js (auto). **Node**: 20.x (matches `engines` / `.nvmrc`).
3. **Build command**: `npm run build` (default). **Install**: `npm install` (default).
4. Copy every variable from [`.env.example`](./.env.example) into Vercel (Production at minimum). **Do not** commit `.env.local`.

### 3. OAuth URLs (production)

- **Pinterest** — In the [Pinterest app](https://developers.pinterest.com/), add redirect  
  `https://YOUR_DOMAIN/api/auth/pinterest/callback`  
  and set `NEXT_PUBLIC_PINTEREST_APP_ID` / `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET` in Vercel.
- **Google (admin)** — In Google Cloud OAuth client, add **Authorized JavaScript origins** and **redirect URIs** for `https://YOUR_DOMAIN`.

### 4. Cron (`vercel.json`)

[`vercel.json`](./vercel.json) schedules `GET /api/cron/sync` daily. **Cron jobs require a [Vercel plan that includes Cron](https://vercel.com/docs/cron-jobs)**. Set `CRON_SECRET` in Vercel; the handler expects header `Authorization: Bearer <CRON_SECRET>`.

### 5. After deploy

Open `/admin`, sign in, connect Pinterest if needed, create/sync instances, then test `/p/your-slug`.

**Local tip:** If a parent folder also has a `package-lock.json`, keep [`outputFileTracingRoot`](./next.config.ts) pointing at this project root (already set) so Next does not pick the wrong workspace root.
