# Production Database Seeding

Render deploys **only build and start the API**. It does **not** run seed scripts. If hotel lists are empty in production, the MongoDB `properties` collection was never seeded.

## Quick diagnosis

While logged in on production, check:

```bash
curl -H "Authorization: Bearer <token>" https://moustache-kme8.onrender.com/properties
```

- `[]` → run seeds (below)
- `[{...}, ...]` with ~38 items → hotels exist; check frontend `VITE_API_BASE_URL`

## Option A: Render Shell (recommended)

1. Render dashboard → `moustache-kme8` → **Shell**
2. Run:

```bash
cd backend
npm run seed:production
```

This uses the `MONGO_URI` already configured on Render.

## Option B: From your machine

Copy `MONGO_URI` from Render → Environment, then:

```bash
cd backend
export MONGO_URI="mongodb+srv://..."
npm run seed:production
```

## Option C: Admin API (after deploy with bootstrap route)

Requires admin login with `settings.manage` permission:

```bash
TOKEN="<jwt from login>"
curl -X POST https://moustache-kme8.onrender.com/api/admin/bootstrap/seed \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

## What `seed:production` runs

1. `seed:admin` — admin user, role, profile (idempotent)
2. `seed:properties` — 38 Moustache hotels (`status: ACTIVE`)
3. `seed:ezee-properties` — eZee PMS credentials per hotel

Default admin (if newly created):

- Email: `admin@moustachecrm.local`
- Password: `Admin@123`

## Optional additional seeds

```bash
npm run seed:property-directories   # Knowledge → Hotel Directory content
npm run seed:everything             # CRM pipelines, stages, scoring (no hotels)
```

## Environment checklist

| Service | Variable | Value |
|---------|----------|-------|
| Render | `MONGO_URI` | Production Atlas URI |
| Render | `JWT_SECRET` | Strong secret |
| Render | `FRONTEND_URL` | `https://tubular-mooncake-84659c.netlify.app` |
| Netlify | `VITE_API_BASE_URL` | `https://moustache-kme8.onrender.com` |

After changing Netlify env vars, trigger a **new deploy** (Vite bakes env at build time).

## Expected result

| Check | Expected |
|-------|----------|
| `GET /properties` | ~38 properties |
| Lead form hotel dropdown | ACTIVE hotels listed |
| Integration Hub → eZee | "38 of 38 configured" |
| Book Room | Works when lead has itinerary with hotel + dates |
