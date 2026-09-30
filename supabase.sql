-- Blockchain-Based IoT Authentication Database Schema

-- Devices table: stores device credentials and trust scores
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
  is_revoked BOOLEAN DEFAULT false,
  last_auth_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_revoked ON devices(is_revoked);
CREATE INDEX idx_devices_trust ON devices(trust_score);

-- Blockchain table: immutable ledger of all events
CREATE TABLE IF NOT EXISTS blockchain (
  idx SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  event TEXT NOT NULL,
  device_id TEXT,
  data JSONB,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);

CREATE INDEX idx_blockchain_device ON blockchain(device_id);
CREATE INDEX idx_blockchain_event ON blockchain(event);
CREATE INDEX idx_blockchain_timestamp ON blockchain(timestamp);

-- Nonces table: prevents replay attacks
CREATE TABLE IF NOT EXISTS nonces (
  device_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, nonce)
);

CREATE INDEX idx_nonces_used_at ON nonces(used_at);

-- Insert genesis block
INSERT INTO blockchain (idx, timestamp, event, device_id, data, prev_hash, hash)
VALUES (0, NOW(), 'GENESIS', 'system', '{}', '0', 
        encode(sha256('0' || NOW()::TEXT || 'GENESIS' || 'system' || '{}' || '0'), 'hex'))
ON CONFLICT (idx) DO NOTHING;

-- Function to clean old nonces (optional, for maintenance)
CREATE OR REPLACE FUNCTION clean_old_nonces() RETURNS void AS $$
BEGIN
  DELETE FROM nonces WHERE used_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
