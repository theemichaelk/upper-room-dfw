# Upper Room DFW — Deployment & Launch Status

## Live stack (production)

| Layer | Status | URL / ID |
|-------|--------|----------|
| Domain + SSL | Live | https://upperroomdfw.com |
| CloudFront CDN | Live | `EI9QWFII46LGX` → static + `/api/*` proxy |
| S3 static site | Live | `s3://upperroomdfw.com` |
| Amplify API | Live | `dbtc2f3y8pyam` / `main.dbtc2f3y8pyam.amplifyapp.com` |
| GitHub CI | Live | https://github.com/theemichaelk/upper-room-dfw (`main`) |

## What's working now

- Public site: home, directory (29 churches), church detail pages, pricing, features, about, training, events
- API health, listings, member login, admin login (both admin emails)
- Church registration → member dashboard
- Contact, support, newsletter, and listing intake forms → production API
- Admin dashboard: listings, users, claims, billing (dev mode), email, SEO, integrations
- Footer on all pages: Powered By The Stone Builders Rejected Michael K

## Admin logins

| Email | Password |
|-------|----------|
| `michaelk@tsbrenterprises.com` | `Kingme05$` |
| `theesaintmichael@gmail.com` | `Kingme05$` |

Demo member: `hello@thegrovearlington.org` / `demo1234`

## Deploy commands

```powershell
# Static site → S3 + CloudFront
npm run deploy:s3

# API → push to GitHub (Amplify auto-builds)
git push github main

# Regenerate sitemap before deploy
npm run generate:sitemap
```

## Amplify environment variables (set in Console or `deploy/amplify-env.json`)

| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAILS` | Comma-separated admin accounts |
| `ADMIN_PASSWORD` | Admin password (hashed on boot) |
| `JWT_SECRET` | Token signing — use a long random string |
| `APP_URL` | `https://upperroomdfw.com` |
| `STRIPE_SECRET_KEY` | Live Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Webhook at `/api/billing/webhook` |
| `STRIPE_PRICE_STANDARD` | $29/mo price ID |
| `STRIPE_PRICE_PREMIUM` | $79/mo price ID |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Transactional email |

```powershell
aws amplify update-app --app-id dbtc2f3y8pyam --region us-east-2 --environment-variables file://deploy/amplify-env.json
```

## New in this build

- **105 church listings** in `data/churches.json` + generated `churches/*.html` pages
- **S3 DB persistence** — SQLite backed up to `s3://upperroomdfw.com/data/urdfw.db` every 90s
- **Live homepage stats** — `/api/stats/public` + `js/home-stats.js`
- **Branded email templates** — welcome, password reset, leads, receipts
- **Stripe helper** — `npm run setup:stripe` and `GET /api/billing/stripe-status`

## Still needed for full production

1. **Stripe** — Add keys in Amplify env, then run `npm run setup:stripe` to verify.
2. **SMTP** — Password reset and lead emails log to console until SMTP is set.
3. **Amplify IAM** — Grant compute role `s3:PutObject` + `s3:GetObject` on `upperroomdfw.com/data/urdfw.db`
4. **Mailchimp / Vbout / Acumbamail** — Demo keys in platform; add real API keys in admin Integrations tab.
5. **Google reCAPTCHA** — Demo checkbox on support form; add real site key for spam protection.
6. **Texas sales tax** — Review with accountant before charging churches.

## DNS

`upperroomdfw.com` + `www` → CloudFront alias `d4lzb9pq4mfuf.cloudfront.net`

## Invalidate CloudFront cache after deploy

```powershell
aws cloudfront create-invalidation --distribution-id EI9QWFII46LGX --paths "/*"
```