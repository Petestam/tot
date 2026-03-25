# This or That (tot)

Crowd-sourced pairwise choices from Pinterest boards: admin creates instances, syncs pins, shares `/p/[slug]`; players tap, swipe, or use keys **1** / **2**.

## Test locally

1. **Database** — The app uses **PostgreSQL** with the [**Neon serverless**](https://neon.tech/docs/serverless/serverless-driver) driver via [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless) + [`@prisma/adapter-neon`](https://www.npmjs.com/package/@prisma/adapter-neon). **SQLite `file:` URLs are not supported.**

   **Option A — Neon** — Create a project at [neon.tech](https://neon.tech) and set **`DATABASE_URL`** to the **pooled** connection string (`*-pooler*` host). The Vercel + Neon integration usually provides this as `DATABASE_URL`.

   **Option B — Docker Postgres** — `docker compose up -d`, then `DATABASE_URL=postgresql://tot:tot@localhost:5432/tot`.

2. **Env** — Copy [`.env.example`](./.env.example) to `.env.local`. Required:

   - `DATABASE_URL`
   - `ADMIN_PASSWORD`, `ADMIN_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`

3. **Schema** — From the project root:

   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Dev server** — `npm run dev` → open [http://localhost:3000](http://localhost:3000). If you ever switch databases or see stale `.next` module errors, run `npm run clean` first.

5. **Admin** — [http://localhost:3000/admin](http://localhost:3000/admin). Sign in with **password** or **Google** (Connect modal). Password: `ADMIN_PASSWORD`.

6. **Google (optional)** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Web client. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` (same value), plus `GOOGLE_ALLOWED_EMAILS` (comma-separated). Authorized JavaScript origins: `http://localhost:3000`. The Connect modal uses Google’s **popup** sign-in.

7. **Pinterest (optional)** — Add `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `NEXT_PUBLIC_PINTEREST_APP_ID`. The app builds the OAuth `redirect_uri` from **where you are** (`window.location.origin` in the browser; request headers + `VERCEL_URL` on the server), so it tracks each deployment URL automatically. Stored access tokens are refreshed automatically when Pinterest returns a refresh token; if Pinterest revokes the session entirely, use **Disconnect** and **Connect** again.

   In the [Pinterest developer app](https://developers.pinterest.com/), you must still **whitelist** each redirect URI (Pinterest does not allow wildcards). Format: `https://<host>/api/auth/pinterest/callback` (never `/admin`). Add at least:

   - Local: `http://localhost:3000/api/auth/pinterest/callback`
   - Production: `https://your-app.vercel.app/api/auth/pinterest/callback` and/or your custom domain

   Preview deployments use a different `*.vercel.app` host each time — add those redirect URIs too if you use **Connect** from previews, or only connect from production. Use **Connect** in admin, create an instance, **Sync**, then open `/p/your-slug`.

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

Use **[Neon](https://neon.tech)** (or any Postgres). In Vercel → **Environment Variables**, set **`DATABASE_URL`** (Neon’s **pooled** URL is best for serverless).

If `prisma db push` ever errors through the pooler, run it once with Neon’s **direct** (non-pooler) URL in `DATABASE_URL` locally, then switch back.

Apply the schema after the first deploy:

```bash
npx prisma db push
```

### 2. Vercel project

1. **Import** the GitHub repo (root directory should be the app root where `package.json` lives).
2. **Framework**: Next.js (auto). **Node**: 20.x (matches `engines` / `.nvmrc`).
3. **Build command**: `npm run build` (default). **Install**: `npm install` (default).
4. Copy every variable from [`.env.example`](./.env.example) into Vercel (Production at minimum). **Do not** commit `.env.local`.

### Auto-deploy on every Git push

Deployments from Git are **not** configured in this repo; they are turned on when the project is tied to GitHub in Vercel.

1. Open **[vercel.com/new](https://vercel.com/new)** → **Import Git Repository**.
2. Pick **GitHub**, install/authorize the Vercel app for your account/org if asked, then select **`Petestam/tot`** ([github.com/Petestam/tot](https://github.com/Petestam/tot)).
3. Leave **Root Directory** as **`.`** (repository root), confirm **Framework Preset** is Next.js, then **Deploy**.

After the first successful deploy:

- **Pushes to `main`** → new **Production** deployment (your live URL).
- **Pushes to other branches** → **Preview** deployments (unique URLs per branch/PR).

To confirm or change behavior: **Vercel** → your project → **Settings** → **Git** (production branch, ignored build step, etc.).

**CLI (optional)** — after `npx vercel login`, from this repo:

```bash
npx vercel link --yes              # create or attach a Vercel project
npx vercel git connect https://github.com/Petestam/tot.git
```

That connects the linked Vercel project to the same remote so pushes trigger builds the same way as the dashboard import.

### 3. OAuth URLs (production)

- **Pinterest** — In the [Pinterest app](https://developers.pinterest.com/), whitelist  
  `https://YOUR_DOMAIN/api/auth/pinterest/callback` (not `/admin`). Set `NEXT_PUBLIC_PINTEREST_APP_ID`, `PINTEREST_APP_ID`, and `PINTEREST_APP_SECRET` in Vercel. Redirect URI is **dynamic** per deployment; only set `NEXT_PUBLIC_APP_URL` if you hit a rare proxy issue (see [`.env.example`](./.env.example)).
- **Google (admin)** — In Google Cloud OAuth client, add **Authorized JavaScript origins** and **redirect URIs** for `https://YOUR_DOMAIN`.

### 4. Cron (`vercel.json`)

[`vercel.json`](./vercel.json) schedules `GET /api/cron/sync` daily. **Cron jobs require a [Vercel plan that includes Cron](https://vercel.com/docs/cron-jobs)**. Set `CRON_SECRET` in Vercel; the handler expects header `Authorization: Bearer <CRON_SECRET>`.

### 5. After deploy

Open `/admin`, sign in, connect Pinterest if needed, create/sync instances, then test `/p/your-slug`.

**Local tip:** If a parent folder also has a `package-lock.json`, keep [`outputFileTracingRoot`](./next.config.ts) pointing at this project root (already set) so Next does not pick the wrong workspace root.
