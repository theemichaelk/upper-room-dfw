# Upper Room DFW — Church Directory Platform

A full church directory SaaS for the Dallas–Fort Worth metroplex: public directory, church registration, member portal, admin dashboard, and **real subscription billing** via Stripe.

## Run locally (production mode)

```powershell
cd ai-upper-room-dir
npm install
npm run restart    # kills port 8000 if busy, then starts server
# or: npm start
```

Open **http://localhost:8000** — static site and API run together.

Without Stripe keys, billing uses **dev mode** (records subscriptions in the database). Add Stripe keys to `.env` for real charges.

## Test

```powershell
npm run test:all        # API (6) + features (93) — 99 checks total
```

## Key pages

| Page | Purpose |
|------|---------|
| `index.html` | Marketing home |
| `directory.html` | Searchable directory (loads from `/api/listings`) |
| `register.html` | Church signup → 14-day trial |
| `member-dashboard.html` | Partner portal: billing, leads, training, listing |
| `admin.html` | Approve churches, view orders, manage platform |
| `pricing.html` | Standard $29 / Premium $79 |

## Demo accounts

- **Member:** `hello@thegrovearlington.org` / `demo1234`
- **Admin:** password from `ADMIN_PASSWORD` in `.env` (default `admin123`)

## Production deploy

See **PRODUCTION_CHECKLIST.md** for Stripe, email, domain, and launch steps.

Minimum production `.env`:

```
JWT_SECRET=<random-32-chars>
ADMIN_PASSWORD=<strong-password>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STANDARD=price_...
STRIPE_PRICE_PREMIUM=price_...
APP_URL=https://yourdomain.com
```

## Architecture

- **Frontend:** HTML + Tailwind + platform JS modules (`js/platform/`)
- **API:** Express + SQLite (`server/`)
- **Payments:** Stripe Checkout + Customer Portal + webhooks
- **Auth:** JWT bearer tokens (`urdfw_api_token` in browser)

## Adding churches

```powershell
node scripts/generate-church.js --file scripts/new-church-example.json
```

Restart the server to re-seed only on empty database; new JSON entries are picked up by the generator for static pages.