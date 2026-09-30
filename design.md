# Design Document

## Architecture

### System Overview
```
┌─────────────┐
│   Browser   │
│  (page.js)  │
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────────────────┐
│   Next.js API Routes    │
│ /api/[action]/route.js  │
│   (Serverless)          │
└──────┬──────────────────┘
       │ @supabase/supabase-js
       ↓
┌─────────────────────────┐
│   Supabase PostgreSQL   │
│  - devices table        │
│  - blockchain table     │
│  - nonces table         │
└─────────────────────────┘
```

### Technology Stack
- **Frontend**: Next.js 14 App Router, React, vanilla CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL)
- **Crypto**: Node.js crypto module (SHA-256, HMAC-SHA256)
- **Deployment**: Vercel

## Database Schema

### Table: devices
```sql
- device_id (TEXT, PK)
- secret_hash (TEXT) - SHA256(secret)
- trust_score (INTEGER, default 50)
- is_revoked (BOOLEAN, default false)
- last_auth_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
```

### Table: blockchain
```sql
- idx (SERIAL, PK)
- timestamp (TIMESTAMPTZ)
- event (TEXT) - REGISTER, AUTH_SUCCESS, AUTH_FAIL, TOKEN_ISSUED, REVOKE
- device_id (TEXT)
- data (JSONB)
- prev_hash (TEXT)
- hash (TEXT)
```

### Table: nonces
```sql
- device_id (TEXT)
- nonce (TEXT)
- used_at (TIMESTAMPTZ)
- PRIMARY KEY (device_id, nonce)
- Index on used_at for cleanup
```

## Core Modules (lib/core.js)

### 1. Crypto Functions
```javascript
// hashSHA256(data) → hex string
// hmacSHA256(key, data) → hex string
// generateSecret() → random 32-byte hex string
// generateDeviceId() → random 16-byte hex string
```

### 2. Blockchain Functions
```javascript
// addBlock(supabase, event, device_id, data)
//   1. Get last block's hash
//   2. Create new block with prev_hash
//   3. Compute hash = SHA256(idx+timestamp+event+device_id+data+prev_hash)
//   4. Insert into blockchain table

// verifyChain(supabase)
//   1. Fetch all blocks ordered by idx
//   2. Recompute each hash and check prev_hash link
//   3. Return {valid: true/false, brokenBlock: idx or null}
```

### 3. Trust Score Functions
```javascript
// calculateTrustScore(currentScore, event, lastAuthTime)
//   - AUTH_SUCCESS: +5 (max 100)
//   - AUTH_FAIL: -15 (min 0)
//   - Burst (>5 auths in 60s): -10
//   - Passive recovery: +1 per hour since lastAuthTime

// getTokenLifetime(trustScore)
//   - trust >= 70: 1800s (30 min)
//   - trust >= 40: 300s (5 min)
//   - trust < 40: 60s (1 min)
```

### 4. Token Functions
```javascript
// issueToken(supabase, device_id, trust_score, secret)
//   1. Calculate expiry based on trust
//   2. Generate JTI (random ID)
//   3. Create payload: {device_id, trust, exp, jti}
//   4. Sign: token = payload + '.' + HMAC(secret, payload)
//   5. Log TOKEN_ISSUED to blockchain
//   6. Return token

// verifyToken(supabase, token, secret)
//   1. Split token into payload and signature
//   2. Verify HMAC signature
//   3. Parse payload
//   4. Check expiry
//   5. Check device not revoked
//   6. Return {valid, device_id, trust}
```

### 5. Authentication Functions
```javascript
// authenticateDevice(supabase, device_id, timestamp, nonce, hmac)
//   1. Fetch device secret_hash and trust_score
//   2. Check device not revoked
//   3. Verify timestamp (max 60s old)
//   4. Check nonce not used (prevent replay)
//   5. Compute expected HMAC
//   6. Compare with provided HMAC
//   7. Update trust score
//   8. Log to blockchain (AUTH_SUCCESS or AUTH_FAIL)
//   9. Insert nonce
//   10. Return {success, trust_score, token (if success)}
```

## API Endpoints

### POST /api/register
**Request**: `{}`  
**Response**: `{device_id, secret}` (secret shown once)  
**Logic**:
1. Generate device_id and secret
2. Hash secret with SHA256
3. Insert into devices table (trust=50)
4. Add REGISTER block
5. Return credentials

### POST /api/auth
**Request**: `{device_id, timestamp, nonce, hmac}`  
**Response**: `{success, trust_score, token?, message}`  
**Logic**:
1. Call authenticateDevice()
2. If successful, issue token
3. Return result

### POST /api/verify
**Request**: `{token}`  
**Response**: `{valid, device_id?, trust?, message}`  
**Logic**:
1. Extract device_id from token
2. Fetch device secret_hash
3. Verify token signature and expiry
4. Return device trust score

### POST /api/revoke
**Request**: `{device_id}`  
**Response**: `{success, message}`  
**Logic**:
1. Update devices SET is_revoked=true
2. Add REVOKE block
3. Return success

### GET /api/devices
**Response**: `{devices: [{device_id, trust_score, is_revoked, created_at}]}`  
**Logic**: Query devices table

### GET /api/ledger
**Response**: `{blocks: [{idx, timestamp, event, device_id, data, hash}]}`  
**Logic**: Query blockchain ordered by idx DESC

### GET /api/integrity
**Response**: `{valid, brokenBlock?, message}`  
**Logic**: Call verifyChain()

### POST /api/simulate
**Request**: `{device_id, mode: 'good' | 'attacker'}`  
**Response**: `{message, results}`  
**Logic**:
- good: Perform 10 successful auths with delays
- attacker: 6 burst auths (trigger -10), then 2 failed auths

### POST /api/tamper
**Request**: `{idx}`  
**Response**: `{success, message}`  
**Logic**: Update blockchain block data to break hash

## UI Components (app/page.js)

### Layout
```
┌──────────────────────────────────────┐
│   Blockchain IoT Auth Dashboard      │
├──────────────────────────────────────┤
│  [Register] [Verify Chain]           │
│                                      │
│  Devices (trust score, status)       │
│  [Simulate Good] [Simulate Attack]   │
│  [Revoke]                            │
│                                      │
│  Blockchain Ledger (newest first)    │
│  [Tamper Block]                      │
└──────────────────────────────────────┘
```

### State Management
- devices: array of device objects
- blocks: array of blockchain blocks
- message: status/error messages
- Fetch data on mount and after actions

### Actions
- Register → POST /api/register → alert secret → refresh
- Simulate → POST /api/simulate → refresh
- Revoke → POST /api/revoke → refresh
- Verify Chain → GET /api/integrity → show result
- Tamper → POST /api/tamper → refresh

## Security Considerations

1. **Secret Storage**: Secrets hashed with SHA256 before storage
2. **Replay Prevention**: Nonce table ensures one-time use
3. **Timestamp Window**: 60-second freshness window prevents old requests
4. **HMAC Authentication**: Shared secret never transmitted
5. **Token Signing**: HMAC-signed tokens prevent tampering
6. **Revocation**: Immediate blocking of compromised devices
7. **Trust-Based Throttling**: Low trust = short token lifetime

## Data Flow Example

### Device Registration
```
Browser → POST /api/register
  ↓
Generate device_id, secret
  ↓
Hash secret → store in devices
  ↓
Add REGISTER block to blockchain
  ↓
Return {device_id, secret}
```

### Authentication Flow
```
Device → POST /api/auth {device_id, ts, nonce, hmac}
  ↓
Verify timestamp (<60s old)
  ↓
Check nonce not used
  ↓
Verify HMAC signature
  ↓
Update trust score (+5 or -15)
  ↓
Check burst (>5 auth/min → -10)
  ↓
Add AUTH_SUCCESS/FAIL block
  ↓
If success: Issue token with dynamic lifetime
  ↓
Return {success, trust_score, token}
```

### Token Verification
```
Client → POST /api/verify {token}
  ↓
Parse token (payload.signature)
  ↓
Verify HMAC signature
  ↓
Check expiry timestamp
  ↓
Check device not revoked
  ↓
Return {valid, device_id, trust}
```

## Deployment

### Environment Variables (.env.local)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
```

### Vercel Configuration
- Framework: Next.js
- Build command: `next build`
- Output directory: `.next`
- Install command: `npm install`
- Environment variables set in Vercel dashboard

### Supabase Setup
1. Create new project
2. Run supabase.sql in SQL editor
3. Copy URL and service role key
4. Add to .env.local and Vercel
