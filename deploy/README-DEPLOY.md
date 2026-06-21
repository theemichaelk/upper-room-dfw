# Upper Room DFW — Deployment

## Stack (this repo)

- **NOT Next.js** — there is no `.next` folder. This is **Express + static HTML**.
- **S3** (`upperroomdfw.com`) — static files (HTML, JS, CSS, images)
- **CloudFront** — CDN in front of S3 website endpoint
- **Amplify / App Runner / EC2** — Node.js host for `server/index.js` (API, auth, Stripe)

## Quick deploy static to S3

```powershell
cd "E:\OneDrive\Documents\Factory AI.02.20.26\ai-upper-room-dir"
node scripts/add-powered-by-footer.js
aws s3 sync . s3://upperroomdfw.com --region us-east-2 --delete `
  --exclude "node_modules/*" --exclude ".env" --exclude "server/data/*" `
  --exclude ".git/*" --exclude ".vscode/*"
```

## CloudFront (one-time)

```powershell
aws cloudfront create-distribution --distribution-config file://deploy/cloudfront-distribution.json
```

Point `upperroomdfw.com` DNS CNAME to the CloudFront domain (e.g. `d1234.cloudfront.net`).

## Amplify (full API + site)

1. Connect GitHub repo to Amplify Console
2. Build spec: `amplify.yml` (npm ci, no Next build)
3. **Start command:** `node server/index.js`
4. Env vars: `JWT_SECRET`, `ADMIN_PASSWORD`, `STRIPE_*`, `APP_URL=https://upperroomdfw.com`, `PORT=8080`

API routes (`/api/*`) only work on the Node host — not on S3 alone.