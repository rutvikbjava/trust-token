# Blockchain-Based IoT Authentication Framework

A lightweight, serverless authentication system for IoT devices using blockchain ledger technology and dynamic trust tokens.

## Features

- **Device Registration**: Secure credential generation with HMAC-based authentication
- **Blockchain Ledger**: Immutable audit trail of all authentication events
- **Dynamic Trust Scores**: Adaptive security based on device behavior (0-100 scale)
- **Smart Token Lifetime**: Trust-based token expiration (1-30 minutes)
- **Replay Attack Prevention**: Nonce-based one-time use authentication
- **Auto-blocking**: Devices with trust < 20 are automatically revoked
- **Chain Integrity Verification**: Cryptographic validation of entire ledger
- **Interactive Dashboard**: Real-time monitoring and device simulation

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL)
- **Crypto**: Node.js built-in crypto module (SHA-256, HMAC-SHA256)
- **Deployment**: Vercel

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd block-chain-project
npm install
```

### 2. Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase.sql`
3. Go to **Project Settings** → **API**
4. Copy your **Project URL** and **service_role key**

### 3. Configure Environment

Create `.env.local` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...your-service-role-key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Deploy to Vercel

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## API Endpoints

### Device Management

#### Register Device
```http
POST /api/register
Response: { device_id, secret }
```

#### Authenticate Device
```http
POST /api/auth
Body: { device_id, timestamp, nonce, hmac }
Response: { success, trust_score, token?, message }
```

#### Revoke Device
```http
POST /api/revoke
Body: { device_id }
Response: { success, message }
```

### Token Operations

#### Verify Token
```http
POST /api/verify
Body: { token }
Response: { valid, device_id?, trust?, message }
```

### Data & Monitoring

#### List Devices
```http
GET /api/devices
Response: { devices: [...] }
```

#### Get Blockchain Ledger
```http
GET /api/ledger
Response: { blocks: [...] }
```

#### Verify Chain Integrity
```http
GET /api/integrity
Response: { valid, brokenBlock?, message }
```

### Simulation & Testing

#### Simulate Device Behavior
```http
POST /api/simulate
Body: { device_id, mode: "good" | "attacker" }
Response: { success, results }
```

#### Tamper with Block (Demo)
```http
POST /api/tamper
Body: { idx }
Response: { success, message }
```

## Authentication Flow

### Device Registration
1. Generate random device_id and secret
2. Store hashed secret in database
3. Log REGISTER event to blockchain
4. Return credentials (secret shown only once)

### Authentication Process
```javascript
// Device computes HMAC
const hmac = HMAC-SHA256(secret, device_id + timestamp + nonce);

// Device sends auth request
POST /api/auth {
  device_id,
  timestamp,  // Current Unix timestamp
  nonce,      // Random unique value
  hmac
}

// Server validates:
1. HMAC signature matches
2. Timestamp is fresh (<60 seconds)
3. Nonce not previously used (replay prevention)
4. Device not revoked

// On success:
- Update trust score (+5)
- Check for burst activity (>5 auths/min → -10)
- Issue token with dynamic lifetime
- Log AUTH_SUCCESS to blockchain
```

### Token Verification
```javascript
// Token format: {device_id,trust,exp,jti}.HMAC_signature

POST /api/verify { token }

// Server checks:
1. HMAC signature valid
2. Token not expired
3. Device not revoked
```

## Trust Score System

| Event | Impact | Description |
|-------|--------|-------------|
| Successful Auth | +5 | Normal authentication |
| Failed Auth | -15 | Wrong credentials |
| Burst Activity | -10 | >5 auths in 60 seconds |
| Passive Recovery | +1/hour | Time-based healing |
| Auto-Block | Revoke | Trust < 20 |

### Token Lifetime by Trust Level

- **High Trust (≥70)**: 30 minutes
- **Medium Trust (40-69)**: 5 minutes  
- **Low Trust (<40)**: 1 minute

## Blockchain Structure

Each block contains:
```javascript
{
  idx: integer,           // Sequential index
  timestamp: datetime,    // Block creation time
  event: string,         // REGISTER, AUTH_SUCCESS, AUTH_FAIL, TOKEN_ISSUED, REVOKE
  device_id: string,     // Associated device
  data: json,            // Event-specific data
  prev_hash: string,     // Previous block hash
  hash: string           // SHA256(idx+timestamp+event+device_id+data+prev_hash)
}
```

## Security Features

1. **Secret Storage**: Secrets stored hashed (SHA-256)
2. **Replay Prevention**: Nonce table ensures one-time use
3. **Timestamp Validation**: 60-second freshness window
4. **HMAC Authentication**: Shared secret never transmitted
5. **Token Signing**: HMAC-signed tokens prevent tampering
6. **Revocation**: Immediate blocking of compromised devices
7. **Immutable Ledger**: Blockchain provides audit trail

## Dashboard Usage

### Register a Device
1. Click **Register Device**
2. Save the displayed secret (shown only once)
3. Device appears in devices table

### Simulate Good Device
1. Click **Simulate Good Device**
2. Enter device_id
3. Performs 10 successful authentications
4. Trust score increases by ~50 points

### Simulate Attacker
1. Click **Simulate Attacker**
2. Enter device_id
3. Performs burst auths + failed attempts
4. Trust score drops by ~40+ points

### Verify Chain Integrity
1. Click **Verify Chain**
2. System checks all block hashes
3. Reports any tampering

### Tamper Block (Demo)
1. Click **Tamper Block**
2. Enter block index
3. Modifies block data to break hash
4. Run **Verify Chain** to detect tampering

## Project Structure

```
/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Dashboard UI
│   └── api/
│       └── [action]/
│           └── route.js       # API endpoints
├── lib/
│   └── core.js                # Core logic (crypto, blockchain, auth)
├── supabase.sql               # Database schema
├── package.json               # Dependencies
├── .env.local                 # Environment variables (not in git)
├── .env.local.example         # Template for env vars
└── README.md                  # This file
```

## Example: IoT Device Implementation

```javascript
// Device-side code (example in Node.js)
const crypto = require('crypto');

const DEVICE_ID = 'your-device-id';
const SECRET = 'your-secret-key';
const API_URL = 'https://your-app.vercel.app';

async function authenticate() {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Compute HMAC
  const hmac = crypto
    .createHmac('sha256', SECRET)
    .update(`${DEVICE_ID}${timestamp}${nonce}`)
    .digest('hex');
  
  // Send auth request
  const response = await fetch(`${API_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: DEVICE_ID, timestamp, nonce, hmac })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Authenticated! Token:', result.token);
    console.log('Trust score:', result.trust_score);
    return result.token;
  } else {
    console.error('Auth failed:', result.message);
    return null;
  }
}

// Authenticate every 5 minutes
setInterval(authenticate, 5 * 60 * 1000);
authenticate(); // Initial auth
```

## Troubleshooting

### "Device not found" error
- Ensure device is registered first
- Check device_id spelling

### "Replay attack detected"
- Generate new nonce for each request
- Don't reuse nonces

### "Stale timestamp"
- Ensure device clock is synchronized
- Timestamp must be within 60 seconds

### "Device revoked"
- Device trust score dropped below 20
- Or manually revoked by admin
- Register new device

### Chain integrity fails
- Expected after using "Tamper Block" demo
- In production, indicates security breach

## License

MIT

## Author

Created for IoT security research and education.
