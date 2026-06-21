const { execSync } = require('child_process');
const fs = require('fs');

const DIST_ID = 'EI9QWFII46LGX';
const raw = JSON.parse(execSync(`aws cloudfront get-distribution-config --id ${DIST_ID} --output json`, { encoding: 'utf8' }));
const cfg = raw.DistributionConfig;
const etag = raw.ETag;

const hasAmplify = cfg.Origins.Items.some((o) => o.Id === 'Amplify-upper-room-api');
if (!hasAmplify) {
  cfg.Origins.Items.push({
    Id: 'Amplify-upper-room-api',
    DomainName: 'main.dbtc2f3y8pyam.amplifyapp.com',
    OriginPath: '',
    CustomHeaders: { Quantity: 0 },
    CustomOriginConfig: {
      HTTPPort: 80,
      HTTPSPort: 443,
      OriginProtocolPolicy: 'https-only',
      OriginSslProtocols: { Quantity: 1, Items: ['TLSv1.2'] },
      OriginReadTimeout: 30,
      OriginKeepaliveTimeout: 5,
    },
    ConnectionAttempts: 3,
    ConnectionTimeout: 10,
    OriginShield: { Enabled: false },
  });
  cfg.Origins.Quantity = cfg.Origins.Items.length;
}

if (!cfg.CacheBehaviors.Items) cfg.CacheBehaviors.Items = [];
const hasApi = cfg.CacheBehaviors.Items.some((b) => b.PathPattern === '/api/*');
if (!hasApi) {
  cfg.CacheBehaviors.Items.unshift({
    PathPattern: '/api/*',
    TargetOriginId: 'Amplify-upper-room-api',
    ViewerProtocolPolicy: 'redirect-to-https',
    AllowedMethods: {
      Quantity: 7,
      Items: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
      CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
    },
    Compress: true,
    CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
    OriginRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
    TrustedSigners: { Enabled: false, Quantity: 0 },
    TrustedKeyGroups: { Enabled: false, Quantity: 0 },
    SmoothStreaming: false,
    LambdaFunctionAssociations: { Quantity: 0 },
    FunctionAssociations: { Quantity: 0 },
    FieldLevelEncryptionId: '',
  });
  cfg.CacheBehaviors.Quantity = cfg.CacheBehaviors.Items.length;
}

cfg.DefaultRootObject = 'index.html';
cfg.Comment = 'Upper Room DFW - S3 static + Amplify API CDN';

const input = { Id: DIST_ID, IfMatch: etag, DistributionConfig: cfg };
const path = 'C:/Users/PC54/upper-room-from-s3/deploy/cf-update-input.json';
fs.mkdirSync('C:/Users/PC54/upper-room-from-s3/deploy', { recursive: true });
fs.writeFileSync(path, JSON.stringify(input));
const out = execSync(`aws cloudfront update-distribution --cli-input-json fileb://${path.replace(/\\/g, '/')}`, { encoding: 'utf8' });
console.log(out);