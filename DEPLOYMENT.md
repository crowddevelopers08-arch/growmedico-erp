# Deploying Grow Medico ERM to Vercel (with Web Push)

Goal: a permanent `https://…` URL so notifications reach the **laptop Action Center**
and the **mobile notification bar** — even when the app tab is closed.

The code is already on GitHub: `crowddevelopers08-arch/growmedico-erp` (branch `main`).

---

## 1. Import the repo into Vercel

1. Go to https://vercel.com → **Add New… → Project**.
2. **Import** the `growmedico-erp` GitHub repo (authorize GitHub if asked).
3. Framework preset auto-detects **Next.js**. Leave Build/Install commands as default
   — the repo's `build` script already runs `prisma generate && next build`, and
   `pnpm` is auto-detected from `pnpm-lock.yaml`.
4. **Don't click Deploy yet** — add the environment variables first (next step).

## 2. Add Environment Variables (Project → Settings → Environment Variables)

Copy the **values** from your local `.env` (never commit that file — it's gitignored).
Set each for **Production** (and Preview, if you want PR previews to work):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon pooled URL (from your `.env`) |
| `DATABASE_URL_UNPOOLED` | Neon direct URL — the app actually uses this one |
| `NEXTAUTH_SECRET` | same as local |
| `NEXTAUTH_URL` | **set to your Vercel URL** once known, e.g. `https://growmedico-erp.vercel.app` |
| `VAPID_PUBLIC_KEY` | from `.env` |
| `VAPID_PRIVATE_KEY` | from `.env` (secret) |
| `VAPID_SUBJECT` | `mailto:crowddevelopers08@gmail.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same value as `VAPID_PUBLIC_KEY` (exposed to browser) |

Notes:
- The DB is the **same Neon database** you use locally, so the admin user and all
  data already exist — **no seeding needed** on Vercel.
- The extra `PG*` / `POSTGRES_*` vars in `.env` are optional (the app only reads
  `DATABASE_URL` / `DATABASE_URL_UNPOOLED`). Copying them does no harm.

## 3. First deploy → then fix NEXTAUTH_URL

1. Click **Deploy**. Wait for it to finish; note the URL (e.g. `https://growmedico-erp.vercel.app`).
2. Set `NEXTAUTH_URL` to that exact URL (Settings → Environment Variables).
3. **Redeploy** (Deployments → ⋯ → Redeploy) so login uses the right URL.

## 4. Turn on push (each device, once)

On **any** device — laptop or phone — open the Vercel URL, log in, then:

- Click the **bell → "Turn on desktop notifications"** (or the **Enable push** button on `/notifications`).
- Approve the browser's **"Allow notifications?"** prompt.

**iPhone/iPad only:** Safari requires the app be installed first —
open the URL in Safari → **Share → Add to Home Screen** → open it from that icon →
then enable push. (Android/desktop Chrome/Edge/Firefox work directly.)

## 5. Test it

1. Enable push on your phone, then **close the tab**.
2. From another account/browser, trigger an event (send a DM, approve a leave, assign a task).
3. The notification appears in the phone's **notification bar** and the laptop's
   **Action Center** — even with the app closed. ✅

---

## Good to know

- **Web Push works on Vercel serverless** because it's delivered by the browser's
  push service (FCM/APNs/Mozilla), not a live server connection.
- **In-app instant SSE toasts** don't fire across serverless invocations on Vercel
  (the in-memory subscriber map isn't shared). The app falls back to a 30s poll +
  refetch-on-focus, so the bell/badge stay current. For true instant in-app toasts
  on a hosted deploy, swap `lib/notification-stream.ts` for Redis/Upstash pub-sub.
- **Schema changes later:** after editing `prisma/schema.prisma`, run
  `npx prisma db push` locally against the Neon DB (production reads the same DB).
- **Rotate VAPID keys for a real production launch** — the current keys were
  generated in dev. If you rotate them, every device must re-enable push.
- **HTTPS is automatic on Vercel**, which is what makes service workers / push work
  on mobile (they're blocked on plain `http://` + LAN IP in local dev).
