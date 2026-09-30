# Implementation Tasks

## Task 1: Database Setup
**File**: `supabase.sql`

Create PostgreSQL schema with three tables:
- `devices` - device credentials and trust scores
- `blockchain` - immutable ledger of all events
- `nonces` - replay attack prevention

Enable Row Level Security and create indexes for performance.

**Acceptance Criteria**:
- All tables created with correct columns and types
- Indexes on frequently queried columns
- Genesis block (idx=0) inserted

---

## Task 2: Core Utility Functions
**File**: `lib/core.js`

Implement crypto and utility functions:
- `hashSHA256(data)` - SHA-256 hashing
- `hmacSHA256(key, data)` - HMAC-SHA256 signing
- `generateSecret()` - random secret generation
- `generateDeviceId()` - random device ID generation

**Acceptance Criteria**:
- All functions use Node.js built-in crypto module
- Outputs are hex-encoded strings
- Functions are exported for use in API routes

---

## Task 3: Blockchain Functions
**File**: `lib/core.js`

Implement blockchain operations:
- `addBlock(supabase, event, device_id, data)` - append new block
- `verifyChain(supabase)` - validate entire chain integrity

**Acceptance Criteria**:
- addBlock fetches prev_hash, computes new hash correctly
- Hash formula: SHA256(idx + timestamp + event + device_id + data + prev_hash)
- verifyChain detects tampered blocks
- Genesis block has prev_hash = '0'

---

## Task 4: Trust Score Management
**File**: `lib/core.js`

Implement trust score logic:
- `calculateTrustScore(currentScore, event, lastAuthTime, recentAuthCount)` - update trust
- `getTokenLifetime(trustScore)` - dynamic token expiry

**Acceptance Criteria**:
- AUTH_SUCCESS: +5 (cap at 100)
- AUTH_FAIL: -15 (floor at 0)
- Burst detection (>5 in 60s): -10
- Passive recovery: +1 per hour
- Token lifetime: high=1800s, medium=300s, low=60s

---

## Task 5: Authentication Logic
**File**: `lib/core.js`

Implement device authentication:
- `authenticateDevice(supabase, device_id, timestamp, nonce, hmac)` - full auth flow

**Acceptance Criteria**:
- Validates HMAC signature
- Checks timestamp freshness (<60s)
- Prevents nonce reuse
- Updates trust score
- Logs AUTH_SUCCESS or AUTH_FAIL to blockchain
- Returns success, trust_score, and optional token

---

## Task 6: Token Operations
**File**: `lib/core.js`

Implement token issuance and verification:
- `issueToken(supabase, device_id, trust_score, secret)` - create signed token
- `verifyToken(supabase, token, secret)` - validate token

**Acceptance Criteria**:
- Token format: `{device_id,trust,exp,jti}.HMAC_signature`
- Expiry based on trust score
- Logs TOKEN_ISSUED to blockchain
- verifyToken checks signature, expiry, revocation

---

## Task 7: API Routes - Registration & Auth
**File**: `app/api/[action]/route.js`

Implement dynamic route handler for:
- `register` - create new device
- `auth` - authenticate device

**Acceptance Criteria**:
- POST /api/register returns {device_id, secret}
- Secret never logged or stored plaintext
- POST /api/auth validates credentials and returns token
- Uses Supabase service key (server-side only)

---

## Task 8: API Routes - Token & Revocation
**File**: `app/api/[action]/route.js`

Implement endpoints:
- `verify` - validate token
- `revoke` - revoke device

**Acceptance Criteria**:
- POST /api/verify checks token validity
- POST /api/revoke sets is_revoked=true and logs REVOKE block
- Revoked devices cannot authenticate

---

## Task 9: API Routes - Data & Integrity
**File**: `app/api/[action]/route.js`

Implement endpoints:
- `devices` - list all devices
- `ledger` - get blockchain
- `integrity` - verify chain
- `tamper` - demo tampering

**Acceptance Criteria**:
- GET /api/devices returns all devices with trust scores
- GET /api/ledger returns blocks newest first
- GET /api/integrity runs verifyChain()
- POST /api/tamper modifies a block for demo

---

## Task 10: API Routes - Simulation
**File**: `app/api/[action]/route.js`

Implement simulation endpoint:
- `simulate` - automate good/attacker behavior

**Acceptance Criteria**:
- Mode 'good': 10 successful auths with proper HMAC
- Mode 'attacker': 6 burst auths + 2 failed auths
- Updates trust scores correctly
- Logs all events to blockchain

---

## Task 11: Dashboard UI - Layout & Data Fetching
**File**: `app/page.js`, `app/layout.js`

Create dashboard with data display:
- Devices table (device_id, trust, status)
- Blockchain ledger table (newest first)
- Fetch data on mount

**Acceptance Criteria**:
- layout.js sets page title and metadata
- page.js fetches /api/devices and /api/ledger on mount
- Tables display data clearly
- Shows loading states

---

## Task 12: Dashboard UI - Device Actions
**File**: `app/page.js`

Implement device management actions:
- Register button
- Simulate buttons (good/attacker)
- Revoke button

**Acceptance Criteria**:
- Register displays secret in alert (shown once)
- Simulate requires device_id input
- Simulate good: +50 trust, simulate attacker: -40+ trust
- Revoke marks device as revoked
- All actions refresh data

---

## Task 13: Dashboard UI - Chain Actions
**File**: `app/page.js`

Implement blockchain actions:
- Verify chain button
- Tamper block button (demo)

**Acceptance Criteria**:
- Verify chain shows integrity result
- Tamper block requires block idx input
- After tampering, verify chain detects broken block
- Clear visual feedback for all actions

---

## Task 14: Styling & Polish
**File**: `app/page.js` (inline styles or style tag)

Add minimal CSS for readability:
- Table styling
- Button styling
- Status indicators (trust score colors, revoked badge)
- Responsive layout

**Acceptance Criteria**:
- Trust scores color-coded (green ≥70, yellow 40-69, red <40)
- Revoked devices clearly marked
- Tables are readable
- Buttons are accessible

---

## Task 15: Package Configuration & Dependencies
**File**: `package.json`

Create package.json with:
- Next.js 14+ (App Router)
- @supabase/supabase-js
- No TypeScript, no Tailwind

**Acceptance Criteria**:
- `npm install` works
- `npm run dev` starts server
- `npm run build` succeeds
- No unnecessary dependencies

---

## Task 16: Environment Setup & Documentation
**File**: `.env.local.example`, `README.md`

Create setup documentation:
- Environment variable template
- Setup instructions
- API documentation
- Deployment guide

**Acceptance Criteria**:
- .env.local.example shows required variables
- README explains project setup
- Lists all API endpoints
- Includes Supabase setup steps

---

## Task 17: Testing & Verification

Manual testing checklist:
1. Register device → receive secret
2. Authenticate → trust increases
3. Burst auth → trust decreases
4. Failed auth → trust decreases significantly
5. Low trust → short token lifetime
6. Token verification works
7. Revoked device cannot auth
8. Chain integrity check passes
9. Tamper block → integrity check fails
10. Simulate good/attacker produces expected results

**Acceptance Criteria**:
- All features work end-to-end
- No console errors
- Trust scores update correctly
- Blockchain maintains integrity
- Replay attacks prevented

---

## Task 18: Deployment

Deploy to Vercel:
1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

**Acceptance Criteria**:
- Build succeeds
- Environment variables set
- API routes accessible
- Dashboard loads
- Supabase connection works
