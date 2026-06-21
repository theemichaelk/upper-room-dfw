# Upper Room DFW — Production Readiness Checklist

## Platform (built in this repo)

- [x] Express API server (`server/index.js`) — site + API on one port
- [x] SQLite database with users, clients, listings, orders, leads, support
- [x] Seed data from `data/churches.json` on first run
- [x] JWT authentication (register, login, forgot/reset password)
- [x] Admin authentication with env-configurable password
- [x] Member registration → trial → dashboard flow
- [x] Listing CRUD synced to directory API
- [x] Leads API with email notifications
- [x] Support tickets API
- [x] Stripe Checkout + Billing Portal + webhooks (when keys set)
- [x] Dev billing mode (no Stripe keys — records paid status in DB)
- [x] Frontend auto-detects `/api/health` and switches to remote mode
- [x] Member dashboard Stripe redirect + billing portal button
- [x] Production Terms of Service & Privacy Policy
- [x] `.env.example` with all required variables
- [x] API test suite (`npm run test:api`)
- [x] Feature test suite (`npm run test:features`)

## Your launch steps (configure once)

- [x] `.env` created for local dev (change `JWT_SECRET` + `ADMIN_PASSWORD` before public launch)
- [ ] Set strong `ADMIN_PASSWORD` (not `admin123`) before going live
- [ ] Create [Stripe account](https://dashboard.stripe.com) and add:
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET` (endpoint: `https://yourdomain.com/api/billing/webhook`)
  - [ ] `STRIPE_PRICE_STANDARD` — recurring $29/mo price ID
  - [ ] `STRIPE_PRICE_PREMIUM` — recurring $79/mo price ID
- [ ] Configure SMTP for transactional email (or use dev console logging)
- [ ] Set `APP_URL=https://upperroomdfw.com` (your real domain)
- [ ] Deploy server with HTTPS (Railway, Render, Fly.io, VPS, etc.)
- [ ] Point domain DNS to deployment
- [ ] Run `npm start` in production (not static-only `serve`)
- [ ] Test full flow: register → login → subscribe → listing live → lead received
- [ ] Have accountant review sales tax for Texas SaaS

## Quick start (local)

```powershell
cd ai-upper-room-dir
copy .env.example .env
npm install
npm start
# Open http://localhost:8000
npm run test:api
npm run test:features
```

Demo member: `hello@thegrovearlington.org` / `demo1234`  
Admin: password from `ADMIN_PASSWORD` (default `admin123` until you change it)