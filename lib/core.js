const crypto = require('crypto');

// ============================================================================
// CRYPTO UTILITIES
// ============================================================================

function hashSHA256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSHA256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function generateDeviceId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateJTI() {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================================================
// BLOCKCHAIN FUNCTIONS
// ============================================================================

async function addBlock(supabase, event, device_id, data) {
  // Get the last block
  const { data: lastBlock } = await supabase
    .from('blockchain')
    .select('idx, hash')
    .order('idx', { ascending: false })
    .limit(1)
    .single();

  const prevHash = lastBlock ? lastBlock.hash : '0';
  const newIdx = lastBlock ? lastBlock.idx + 1 : 0;
  const timestamp = new Date().toISOString();
  const dataStr = JSON.stringify(data);

  // Compute hash: SHA256(idx + timestamp + event + device_id + data + prev_hash)
  const hashInput = `${newIdx}${timestamp}${event}${device_id}${dataStr}${prevHash}`;
  const hash = hashSHA256(hashInput);

  // Insert block
  const { error } = await supabase
    .from('blockchain')
    .insert({
      idx: newIdx,
      timestamp,
      event,
      device_id,
      data: dataStr,
      prev_hash: prevHash,
      hash
    });

  if (error) throw error;
  return { idx: newIdx, hash };
}

async function verifyChain(supabase) {
  const { data: blocks, error } = await supabase
    .from('blockchain')
    .select('*')
    .order('idx', { ascending: true });

  if (error) throw error;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const { idx, timestamp, event, device_id, data, prev_hash, hash } = block;

    // Recompute hash
    const hashInput = `${idx}${timestamp}${event}${device_id}${data}${prev_hash}`;
    const expectedHash = hashSHA256(hashInput);

    if (hash !== expectedHash) {
      return { valid: false, brokenBlock: idx, reason: 'Hash mismatch' };
    }

    // Check prev_hash link
    if (i > 0) {
      const prevBlock = blocks[i - 1];
      if (prev_hash !== prevBlock.hash) {
        return { valid: false, brokenBlock: idx, reason: 'Prev_hash mismatch' };
      }
    } else if (prev_hash !== '0') {
      return { valid: false, brokenBlock: idx, reason: 'Genesis prev_hash should be 0' };
    }
  }

  return { valid: true, brokenBlock: null };
}

// ============================================================================
// TRUST SCORE FUNCTIONS
// ============================================================================

function calculateTrustScore(currentScore, event, lastAuthTime, recentAuthCount) {
  let newScore = currentScore;

  // Event-based adjustments
  if (event === 'AUTH_SUCCESS') {
    newScore += 5;
  } else if (event === 'AUTH_FAIL') {
    newScore -= 15;
  }

  // Burst detection (>5 auths in last 60 seconds)
  if (recentAuthCount > 5) {
    newScore -= 10;
  }

  // Passive recovery: +1 per hour since last auth
  if (lastAuthTime) {
    const hoursSinceLastAuth = (Date.now() - new Date(lastAuthTime).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastAuth >= 1) {
      newScore += Math.floor(hoursSinceLastAuth);
    }
  }

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, newScore));
}

function getTokenLifetime(trustScore) {
  if (trustScore >= 70) return 1800; // 30 minutes
  if (trustScore >= 40) return 300;  // 5 minutes
  return 60; // 1 minute
}

// ============================================================================
// TOKEN FUNCTIONS
// ============================================================================

async function issueToken(supabase, device_id, trust_score, secret) {
  const lifetime = getTokenLifetime(trust_score);
  const exp = Math.floor(Date.now() / 1000) + lifetime;
  const jti = generateJTI();

  const payload = JSON.stringify({ device_id, trust: trust_score, exp, jti });
  const signature = hmacSHA256(secret, payload);
  const token = `${payload}.${signature}`;

  // Log TOKEN_ISSUED to blockchain
  await addBlock(supabase, 'TOKEN_ISSUED', device_id, { jti, exp, trust: trust_score });

  return token;
}

async function verifyToken(supabase, token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, message: 'Invalid token format' };
    }

    const [payloadStr, signature] = parts;
    const expectedSignature = hmacSHA256(secret, payloadStr);

    if (signature !== expectedSignature) {
      return { valid: false, message: 'Invalid signature' };
    }

    const payload = JSON.parse(payloadStr);
    const { device_id, trust, exp, jti } = payload;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, message: 'Token expired' };
    }

    // Check device not revoked
    const { data: device } = await supabase
      .from('devices')
      .select('is_revoked')
      .eq('device_id', device_id)
      .single();

    if (!device) {
      return { valid: false, message: 'Device not found' };
    }

    if (device.is_revoked) {
      return { valid: false, message: 'Device revoked' };
    }

    return { valid: true, device_id, trust };
  } catch (err) {
    return { valid: false, message: err.message };
  }
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

async function authenticateDevice(supabase, device_id, timestamp, nonce, hmac) {
  try {
    // Fetch device
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', device_id)
      .single();

    if (deviceError || !device) {
      await addBlock(supabase, 'AUTH_FAIL', device_id, { reason: 'Device not found' });
      return { success: false, message: 'Device not found' };
    }

    if (device.is_revoked) {
      await addBlock(supabase, 'AUTH_FAIL', device_id, { reason: 'Device revoked' });
      return { success: false, message: 'Device revoked' };
    }

    // Check timestamp freshness (max 60 seconds old)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (Math.abs(now - requestTime) > 60000) {
      await addBlock(supabase, 'AUTH_FAIL', device_id, { reason: 'Stale timestamp' });
      
      // Update trust score for failed auth
      const newTrust = calculateTrustScore(device.trust_score, 'AUTH_FAIL', device.last_auth_at, 0);
      await supabase
        .from('devices')
        .update({ trust_score: newTrust, last_auth_at: new Date().toISOString() })
        .eq('device_id', device_id);
      
      return { success: false, message: 'Stale timestamp' };
    }

    // Check nonce not used (replay attack prevention)
    const { data: existingNonce } = await supabase
      .from('nonces')
      .select('nonce')
      .eq('device_id', device_id)
      .eq('nonce', nonce)
      .single();

    if (existingNonce) {
      await addBlock(supabase, 'AUTH_FAIL', device_id, { reason: 'Nonce reused (replay attack)' });
      
      // Penalize replay attempts
      const newTrust = calculateTrustScore(device.trust_score, 'AUTH_FAIL', device.last_auth_at, 0);
      await supabase
        .from('devices')
        .update({ trust_score: newTrust, last_auth_at: new Date().toISOString() })
        .eq('device_id', device_id);
      
      return { success: false, message: 'Replay attack detected' };
    }

    // Retrieve secret from hash (we need to get the original secret - but we can't!)
    // Actually, we need to store the secret separately for HMAC verification
    // Let's reconsider: we hash the secret for storage, but for HMAC we need the original
    // Solution: In this implementation, secret_hash will store the actual secret (not ideal but works for demo)
    const secret = device.secret_hash;

    // Verify HMAC: HMAC(secret, device_id + timestamp + nonce)
    const expectedHmac = hmacSHA256(secret, `${device_id}${timestamp}${nonce}`);
    if (hmac !== expectedHmac) {
      await addBlock(supabase, 'AUTH_FAIL', device_id, { reason: 'Invalid HMAC' });
      
      // Update trust score for failed auth
      const newTrust = calculateTrustScore(device.trust_score, 'AUTH_FAIL', device.last_auth_at, 0);
      await supabase
        .from('devices')
        .update({ trust_score: newTrust, last_auth_at: new Date().toISOString() })
        .eq('device_id', device_id);
      
      return { success: false, message: 'Invalid HMAC' };
    }

    // Check for burst (count recent auths in last 60 seconds)
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentAuths, error: authError } = await supabase
      .from('blockchain')
      .select('idx')
      .eq('device_id', device_id)
      .in('event', ['AUTH_SUCCESS', 'AUTH_FAIL'])
      .gte('timestamp', oneMinuteAgo);

    const recentAuthCount = recentAuths ? recentAuths.length : 0;

    // Calculate new trust score
    const newTrust = calculateTrustScore(device.trust_score, 'AUTH_SUCCESS', device.last_auth_at, recentAuthCount);

    // Check if blocked (trust < 20)
    if (newTrust < 20) {
      await supabase
        .from('devices')
        .update({ is_revoked: true, trust_score: newTrust, last_auth_at: new Date().toISOString() })
        .eq('device_id', device_id);
      
      await addBlock(supabase, 'REVOKE', device_id, { reason: 'Trust score below 20 (auto-blocked)' });
      return { success: false, message: 'Device auto-blocked due to low trust' };
    }

    // Update device
    await supabase
      .from('devices')
      .update({ trust_score: newTrust, last_auth_at: new Date().toISOString() })
      .eq('device_id', device_id);

    // Insert nonce
    await supabase
      .from('nonces')
      .insert({ device_id, nonce });

    // Log success
    await addBlock(supabase, 'AUTH_SUCCESS', device_id, { trust: newTrust, burst: recentAuthCount > 5 });

    // Issue token
    const token = await issueToken(supabase, device_id, newTrust, secret);

    return { success: true, trust_score: newTrust, token };
  } catch (err) {
    console.error('Auth error:', err);
    return { success: false, message: err.message };
  }
}

module.exports = {
  hashSHA256,
  hmacSHA256,
  generateSecret,
  generateDeviceId,
  generateJTI,
  addBlock,
  verifyChain,
  calculateTrustScore,
  getTokenLifetime,
  issueToken,
  verifyToken,
  authenticateDevice
};
