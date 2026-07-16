# Floci (local AWS) + Quantum Pages env sketch

## What is Floci UI?

[floci-io/floci-ui](https://github.com/floci-io/floci-ui) is a **local-first multi-cloud console** (React/Vite + API) for the Floci emulator ecosystem — an AWS Console–style UI for **local** runtimes.

| Piece | Port | Role |
|-------|------|------|
| **Floci core** (`floci/floci`) | `4566` | Local AWS-compatible API (S3-first for us) |
| **Floci API** | `4501` | Cloud adapter proxy |
| **Floci UI** | `4500` | Web console (storage browser, etc.) |

**Philosophy:** real local data only — no fake demo resources in normal mode.

### What it can replace for Upper Room DFW

| Production (keep for go-live) | Local with Floci |
|------------------------------|------------------|
| Amplify WEB_COMPUTE + GitHub | `npm start` on laptop |
| S3 `s3://upperroomdfw.com` | Floci S3 on `:4566` |
| CloudFront invalidations | Skip (local files) |
| Route53 | Skip |
| Stripe / SMTP | Still use test keys or console logs |

**Do not** point production Amplify env at Floci. Floci is **dev-only** to stop S3/Amplify charge burn while iterating.

### Run Floci locally (Windows)

```powershell
# Minimal: Floci S3-compatible endpoint only
cd "E:\OneDrive\Documents\Factory AI.02.20.26\ai-upper-room-dir"
docker compose -f docker-compose.floci.yml up -d

# Optional console UI
docker compose -f docker-compose.floci.yml --profile ui up -d
# → http://localhost:4500
```

Or pure Docker Floci core:

```powershell
docker run -d --name floci -p 4566:4566 `
  -v /var/run/docker.sock:/var/run/docker.sock `
  -e FLOCI_DEFAULT_REGION=us-east-1 -u root floci/floci:latest
```

Health:

```powershell
curl http://localhost:4566/_floci/health
```

### Wire Upper Room DFW to Floci (dev)

Add to **local** `.env` (never commit secrets; never put Floci endpoint in Amplify prod):

```env
# --- Floci local S3 (dev only) ---
AWS_ENDPOINT_URL=http://localhost:4566
FLOCI_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
AWS_S3_FORCE_PATH_STYLE=true
DB_BACKUP_BUCKET=upperroomdfw-local
DB_BACKUP_KEY=data/urdfw.db
MEDIA_BUCKET=upperroomdfw-local
MEDIA_PUBLIC_BASE=http://localhost:8000
# Leave STRIPE/SMTP as test or empty for pure local

# Go-live: REMOVE AWS_ENDPOINT_URL / FLOCI_ENDPOINT and use real AWS + Amplify
```

Create the local bucket once (AWS CLI against Floci):

```powershell
$env:AWS_ACCESS_KEY_ID='test'; $env:AWS_SECRET_ACCESS_KEY='test'
aws --endpoint-url=http://localhost:4566 s3 mb s3://upperroomdfw-local --region us-east-1
```

Dev scripts (no Amplify/S3 charges):

```powershell
npm run floci:up
npm run dev:local          # server with Floci-oriented env hints
# When ready for production:
npm run push:live          # Amplify + real S3 + CloudFront
```

### Full floci-ui from source (optional)

```bash
git clone https://github.com/floci-io/floci-ui.git
cd floci-ui
pnpm install
cp .env.example packages/api/.env
# packages/api/.env: FLOCI_ENDPOINT=http://localhost:4566, AWS keys test/test
pnpm dev   # UI :4500 + API :4501
```

---

## Quantum Pages (QP) — exact env sketch for next wiring

Copy into `Quantum-Pages-AI-CodeSmash/.env.local` (or QP monorepo).  
**Dev storage** uses Floci; **prod** uses real AWS.

```env
# =========================================================================
# Quantum Pages AI — environment sketch (Floci-aware)
# =========================================================================

# --- Server ---
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000

# --- Auth ---
JWT_SECRET=change-me-qp-jwt-32chars-minimum!!
SESSION_SECRET=change-me-qp-session
COOKIE_SECRET=change-me-qp-cookie

# --- Database ---
MONGODB_URI=mongodb://localhost:27017/quantum-pages

# --- Storage mode: local | floci | aws ---
STORAGE_MODE=floci

# Floci (dev only — same as Upper Room)
AWS_ENDPOINT_URL=http://localhost:4566
FLOCI_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
AWS_S3_FORCE_PATH_STYLE=true
AWS_S3_BUCKET_NAME=quantum-pages-local
AWS_S3_ACCESS_KEY_ID=test
AWS_S3_SECRET_ACCESS_KEY=test
AWS_S3_REGION=us-east-1

# Production AWS (go-live — set STORAGE_MODE=aws, clear AWS_ENDPOINT_URL)
# AWS_S3_BUCKET_NAME=your-prod-bucket
# AWS_S3_ACCESS_KEY_ID=AKIA...
# AWS_S3_SECRET_ACCESS_KEY=...
# AWS_S3_REGION=us-east-1
# AMPLIFY_APP_ID=
# CLOUDFRONT_DIST_ID=

# --- AI ---
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2023-05-15
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
OPENAI_API_KEY=
CONTENTBOT_API_KEY=
CONTENTBOT_BASE_URL=https://api.contentbot.ai/v2

# --- SEO / SERP ---
SEMRUSH_API_KEY=
AHREFS_API_KEY=
SERPAPI_API_KEY=
QUANTUM_SERP_BASE_URL=http://127.0.0.1:7000
QUANTUM_SERP_DEFAULT_ENGINE=bing
QUANTUM_SERP_AUTOSTART=true
QUANTUM_SERP_API_KEY=
QUANTUM_SERP_CLOUD_URL=https://api.openserp.org

# --- Email ---
EMAIL_PROVIDER=vbout
EMAIL_FROM=support@quantumpages.ai
VBOUT_API_KEY=
VBOUT_LIST_ID=
ACUMBAMAIL_AUTH_TOKEN=
ACUMBAMAIL_LIST_ID=

# --- Payments ---
STRIPE_MODE=test
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

# --- OAuth (optional) ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- Google traffic (admin dashboards — same pattern as Upper Room) ---
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GA4_PROPERTY_ID=
GSC_SITE_URL=https://quantumpages.ai/
GA4_MEASUREMENT_ID=G-

# --- Maps / misc ---
GOOGLE_MAPS_API_KEY=
```

### Switch matrix

| Goal | STORAGE_MODE | AWS_ENDPOINT_URL | Deploy |
|------|--------------|------------------|--------|
| Local free iteration | `floci` | `http://localhost:4566` | none |
| Staging | `aws` | *(empty)* | Amplify/S3 staging |
| Go-live | `aws` | *(empty)* | Amplify + prod S3 + CF |

---

## Upper Room — Google traffic admin (GA4 + GSC)

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=urdfw-analytics@PROJECT.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# or: GOOGLE_APPLICATION_CREDENTIALS=C:\secrets\urdfw-sa.json
GA4_PROPERTY_ID=123456789
GSC_SITE_URL=https://upperroomdfw.com/
GA4_MEASUREMENT_ID=G-XXXXXXXX
```

Admin UI: **Admin → Analytics** loads `/api/analytics/admin` which includes `traffic` (GA4 sessions + GSC queries).  
Without credentials, the panel shows setup instructions; platform DB KPIs still work.
