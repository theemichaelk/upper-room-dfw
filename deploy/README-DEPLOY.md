# Upper Room DFW — Deployment

## Stack

- **NOT Next.js** — Express + static HTML (no `.next`)
- **S3** `upperroomdfw.com` — static HTML/JS/CSS/images (index: `index.html`)
- **CloudFront** `d4lzb9pq4mfuf.cloudfront.net` — CDN; `/api/*` proxies to Amplify
- **Amplify** `main.dbtc2f3y8pyam.amplifyapp.com` — WEB_COMPUTE Express API + SSR routes
- **GitHub** https://github.com/theemichaelk/upper-room-dfw (branch `main`)

## Live URLs

| Service | URL |
|---------|-----|
| CDN (static + API) | https://d4lzb9pq4mfuf.cloudfront.net |
| API health | https://d4lzb9pq4mfuf.cloudfront.net/api/health |
| Amplify | https://main.dbtc2f3y8pyam.amplifyapp.com |

## Deploy static to S3

```powershell
npm run deploy:s3
```

## Deploy API (Amplify via GitHub)

Push to GitHub — Amplify auto-builds `.amplify-hosting/` from `amplify.yml`:

```powershell
git push github main
```

Set Amplify env vars: `JWT_SECRET`, `ADMIN_PASSWORD`, `STRIPE_*`, `APP_URL=https://upperroomdfw.com`

## DNS

Point `upperroomdfw.com` CNAME → `d4lzb9pq4mfuf.cloudfront.net`

## Demo logins (seeded on API boot)

- Admin: password `admin123` (or `ADMIN_PASSWORD` env)
- Member: `hello@thegrovearlington.org` / `demo1234`