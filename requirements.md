# Requirements

## Overview
Lightweight blockchain-based authentication framework for IoT devices using dynamic trust tokens. Serverless architecture on Vercel + Supabase.

## Functional Requirements

### FR1: Device Registration
- Generate unique `device_id` and secret key
- Return secret once (never stored in plaintext)
- Compute secret_hash = SHA256(secret) and store in database
- Device will use SHA256(secret) as HMAC key (equals server's secret_hash)
- Log REGISTER event to blockchain with epoch ms timestamp

### FR2: Blockchain Ledger
- Immutable append-only log in Supabase
- Each block contains: idx (BIGINT), ts (epoch ms), event, device_id, data (TEXT JSON string), prev_hash, hash
- Hash = SHA256(idx + ts + event + device_id + data + prev_hash)
  - All values concatenated as strings
  - data is stored TEXT value as-is for hash stability
- Event types: REGISTER, AUTH_SUCCESS, AUTH_FAIL, TOKEN_ISSUED, REVOKE

### FR3: Device Authentication
- Device sends: device_id, timestamp (epoch ms), nonce, hmac
- Device computes: key = SHA256(secret), hmac = HMAC-SHA256(key, device_id + timestamp + nonce)
- Server validates:
  - Fetches secret_hash from database (equals device's key)
  - Computes expected_hmac = HMAC-SHA256(secret_hash, device_id + timestamp + nonce)
  - HMAC signature matches
  - Timestamp freshness (max 60 seconds old, epoch ms)
  - Nonce uniqueness (no replay attacks)
- Log AUTH_SUCCESS or AUTH_FAIL to blockchain with epoch ms

### FR4: Dynamic Trust Score
- Range: 0-100, initial value: 50
- Score adjustments:
  - Successful auth: +5
  - Failed auth: -15
  - Burst detection (>5 auths/minute): -10
  - Auto-block if score < 20
- Passive recovery: +1 per hour since last activity

### FR5: Dynamic Trust Tokens
- HMAC-signed token: {device_id, trust, exp, jti}
- Lifetime based on trust score:
  - High (≥70): 30 minutes
  - Medium (40-69): 5 minutes
  - Low (<40): 1 minute
- Log TOKEN_ISSUED to blockchain
- Store JTI for revocation check

### FR6: Token Verification
- Verify HMAC signature
- Check expiry timestamp
- Check revocation status
- Return device's current trust score

### FR7: Device Revocation
- Admin can revoke device access
- Sets status = 'revoked' in devices table
- Log REVOKE event to blockchain with epoch ms
- Invalidate all tokens for device

### FR8: Ledger Integrity Check
- Recompute all hashes and prev_hash links
- Report first broken block (if any)
- Validates entire blockchain integrity

### FR9: Dashboard UI
- Display all devices with trust scores and status ('active', 'blocked', 'revoked')
- Display blockchain ledger (newest first) with formatted timestamps
- Actions:
  - Register new device
  - Simulate good device (multiple successful auths)
  - Simulate attacker (failed auths, replays)
  - Verify chain integrity
  - Revoke device
  - Tamper block (demo integrity check)

## Non-Functional Requirements

### NFR1: Deployment
- Vercel-compatible (serverless functions)
- Supabase database (PostgreSQL)
- No server-side state (stateless functions)

### NFR2: Security
- Secrets never stored in plaintext (stored as SHA256 hash)
- Device signs with SHA256(secret), server validates with secret_hash
- HMAC-SHA256 for authentication
- Nonce prevents replay attacks (stored with epoch ms)
- Timestamp prevents stale requests (epoch ms, 60s window)

### NFR3: Technology Constraints
- Next.js App Router (JavaScript only)
- No TypeScript, no Tailwind config
- Only @supabase/supabase-js dependency
- Node.js built-in crypto module

### NFR4: File Structure
```
/supabase.sql          - Database schema
/lib/core.js           - Core logic (blockchain, crypto, trust)
/app/api/[action]/route.js - API endpoints
/app/page.js           - Dashboard UI
/app/layout.js         - Root layout
/package.json          - Dependencies
/.env.local            - Supabase credentials
```

## API Endpoints
- POST /api/register - Register device
- POST /api/auth - Authenticate device
- POST /api/verify - Verify token
- POST /api/revoke - Revoke device
- GET /api/devices - List devices
- GET /api/ledger - Get blockchain
- GET /api/integrity - Check chain integrity
- POST /api/simulate - Simulate good/bad behavior
- POST /api/tamper - Tamper with block (demo)
