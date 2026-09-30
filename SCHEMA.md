# Schema Reference

## Database Schema

### Table: devices
```sql
CREATE TABLE devices (
  device_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,          -- SHA256(secret)
  trust_score INT DEFAULT 50,         -- 0-100
  status TEXT DEFAULT 'active',       -- 'active' | 'blocked' | 'revoked'
  last_auth_at BIGINT,                -- epoch milliseconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Points:**
- `secret_hash` stores SHA256(secret)
- Device signs with SHA256(secret), which equals server's secret_hash
- `status` replaces boolean is_revoked flag
- `last_auth_at` is epoch milliseconds for consistency

### Table: blockchain
```sql
CREATE TABLE blockchain (
  idx BIGINT PRIMARY KEY,             -- manually assigned, prevents forks
  ts BIGINT NOT NULL,                 -- epoch milliseconds
  event TEXT NOT NULL,                -- REGISTER, AUTH_SUCCESS, AUTH_FAIL, TOKEN_ISSUED, REVOKE
  device_id TEXT,
  data TEXT NOT NULL DEFAULT '{}',    -- JSON string, stored as-is
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL                  -- SHA256(idx + ts + event + device_id + data + prev_hash)
);
```

**Key Points:**
- `idx` is BIGINT, manually assigned (not SERIAL)
- `ts` is epoch milliseconds (not TIMESTAMPTZ)
- `data` is TEXT (not JSONB) to ensure hash stability
- Hash computed from string concatenation

### Table: nonces
```sql
CREATE TABLE nonces (
  device_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  used_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  PRIMARY KEY (device_id, nonce)
);
```

**Key Points:**
- `used_at` is epoch milliseconds
- Prevents replay attacks
- Index on used_at for cleanup

## Hash Computation

### Block Hash Formula
```
hash = SHA256(idx + ts + event + device_id + data + prev_hash)
```

**Rules:**
1. All values concatenated as strings (no separators)
2. `idx` and `ts` converted to string representation
3. `data` is the stored TEXT value as-is (JSON string)
4. Genesis block: prev_hash = '0'

**Example:**
```javascript
const hashInput = `${idx}${ts}${event}${device_id}${data}${prev_hash}`;
const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
```

**Genesis Block:**
```
idx = 0
ts = 0
event = 'GENESIS'
device_id = 'system'
data = '{}'
prev_hash = '0'
hash = SHA256('00GENESISsystem{}0')
```

## Device Authentication Flow

### 1. Device Registration
```javascript
// Server generates
const device_id = crypto.randomBytes(16).toString('hex');  // 32 char hex
const secret = crypto.randomBytes(32).toString('hex');      // 64 char hex

// Server computes and stores
const secret_hash = crypto.createHash('sha256').update(secret).digest('hex');

// Server stores in database
INSERT INTO devices (device_id, secret_hash, trust_score, status)
VALUES (device_id, secret_hash, 50, 'active');

// Server returns to device (secret shown only once)
{ device_id, secret }
```

### 2. Device Signs Request
```javascript
// Device computes key (same as server's secret_hash)
const key = crypto.createHash('sha256').update(secret).digest('hex');

// Device creates auth request
const timestamp = Date.now().toString();  // epoch ms as string
const nonce = crypto.randomBytes(16).toString('hex');

// Device computes HMAC
const message = device_id + timestamp + nonce;
const hmac = crypto.createHmac('sha256', key).update(message).digest('hex');

// Device sends
POST /api/auth {
  device_id,
  timestamp,  // epoch ms
  nonce,
  hmac
}
```

### 3. Server Validates
```javascript
// Fetch device from database
const device = await db.query('SELECT secret_hash, status FROM devices WHERE device_id = ?');

// Check status
if (device.status !== 'active') {
  return { success: false, message: 'Device not active' };
}

// Verify timestamp (within 60 seconds)
const now = Date.now();
const requestTime = parseInt(timestamp);
if (Math.abs(now - requestTime) > 60000) {
  return { success: false, message: 'Stale timestamp' };
}

// Check nonce not used
const nonceExists = await db.query('SELECT 1 FROM nonces WHERE device_id = ? AND nonce = ?');
if (nonceExists) {
  return { success: false, message: 'Replay attack detected' };
}

// Compute expected HMAC using stored secret_hash
const message = device_id + timestamp + nonce;
const expectedHmac = crypto.createHmac('sha256', device.secret_hash).update(message).digest('hex');

// Compare
if (hmac !== expectedHmac) {
  return { success: false, message: 'Invalid HMAC' };
}

// Success - insert nonce
await db.query('INSERT INTO nonces (device_id, nonce, used_at) VALUES (?, ?, ?)',
  [device_id, nonce, Date.now()]);

return { success: true, trust_score: device.trust_score };
```

## Status States

| Status | Description | Can Auth? | Trust Check |
|--------|-------------|-----------|-------------|
| `active` | Normal operation | ✅ Yes | Updates normally |
| `blocked` | Auto-blocked (trust < 20) | ❌ No | Cannot recover |
| `revoked` | Manually revoked | ❌ No | Permanent |

**Transitions:**
- `active` → `blocked`: Automatic when trust < 20
- `active` → `revoked`: Manual admin action
- `blocked` → `revoked`: Manual admin action
- No transitions back to `active` (one-way only)

## Trust Score Adjustments

| Event | Delta | Condition |
|-------|-------|-----------|
| AUTH_SUCCESS | +5 | Normal auth |
| AUTH_FAIL | -15 | Wrong HMAC |
| Burst detected | -10 | >5 auths in 60s |
| Passive recovery | +1 | Per hour since last auth |
| Auto-block | status='blocked' | When trust < 20 |

**Range:** 0-100 (clamped)

## Token Lifetime

Based on trust score:

| Trust Score | Lifetime | Use Case |
|-------------|----------|----------|
| 70-100 | 30 minutes | High trust devices |
| 40-69 | 5 minutes | Medium trust |
| 0-39 | 1 minute | Low trust |

## Data Types Summary

| Field | Type | Format | Example |
|-------|------|--------|---------|
| device_id | TEXT | 32-char hex | `a1b2c3d4e5f6...` |
| secret | TEXT | 64-char hex | `1234567890ab...` |
| secret_hash | TEXT | 64-char hex | SHA256(secret) |
| trust_score | INTEGER | 0-100 | `75` |
| status | TEXT | enum | `'active'` |
| idx | BIGINT | integer | `42` |
| ts | BIGINT | epoch ms | `1704067200000` |
| timestamp | epoch ms | string for HMAC | `"1704067200000"` |
| nonce | TEXT | 32-char hex | `f1e2d3c4b5a6...` |
| hash | TEXT | 64-char hex | SHA256(...) |
| data | TEXT | JSON string | `'{"trust":50}'` |

## Implementation Checklist

### Registration
- [x] Generate 16-byte device_id
- [x] Generate 32-byte secret
- [x] Compute secret_hash = SHA256(secret)
- [x] Store secret_hash (not secret)
- [x] Return secret to device once
- [x] Create REGISTER block with epoch ms

### Authentication
- [x] Device computes key = SHA256(secret)
- [x] Device computes HMAC with key
- [x] Server fetches secret_hash
- [x] Server validates HMAC with secret_hash
- [x] Check timestamp within 60s (epoch ms)
- [x] Check nonce not in table
- [x] Update trust score
- [x] Insert nonce with epoch ms
- [x] Create AUTH block with epoch ms
- [x] Auto-block if trust < 20

### Blockchain
- [x] Manual idx assignment (BIGINT)
- [x] Timestamp as epoch ms (BIGINT)
- [x] Data stored as TEXT (JSON string)
- [x] Hash = SHA256(idx + ts + event + device_id + data + prev_hash)
- [x] Genesis block at idx=0

### Status Management
- [x] Use status enum ('active', 'blocked', 'revoked')
- [x] Check status on every auth
- [x] Auto-block when trust < 20
- [x] Manual revoke via API
- [x] Display status in dashboard
