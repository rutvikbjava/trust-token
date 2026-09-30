import { createClient } from '@supabase/supabase-js';
import {
  hashSHA256,
  hmacSHA256,
  generateSecret,
  generateDeviceId,
  addBlock,
  verifyChain,
  authenticateDevice,
  verifyToken
} from '../../../lib/core';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================================
// REGISTER: Create new device
// ============================================================================
async function handleRegister() {
  try {
    const device_id = generateDeviceId();
    const secret = generateSecret();
    // Note: For demo purposes, we store the secret directly (not hashed)
    // In production, you'd want asymmetric crypto or secure key derivation
    const secret_hash = secret; // Store actual secret for HMAC verification

    const { error } = await supabase
      .from('devices')
      .insert({
        device_id,
        secret_hash,
        trust_score: 50
      });

    if (error) throw error;

    await addBlock(supabase, 'REGISTER', device_id, { initial_trust: 50 });

    return { device_id, secret };
  } catch (err) {
    throw new Error(`Registration failed: ${err.message}`);
  }
}

// ============================================================================
// AUTH: Authenticate device
// ============================================================================
async function handleAuth(body) {
  const { device_id, timestamp, nonce, hmac } = body;

  if (!device_id || !timestamp || !nonce || !hmac) {
    return { success: false, message: 'Missing required fields' };
  }

  return await authenticateDevice(supabase, device_id, timestamp, nonce, hmac);
}

// ============================================================================
// VERIFY: Verify token
// ============================================================================
async function handleVerify(body) {
  const { token } = body;

  if (!token) {
    return { valid: false, message: 'Token required' };
  }

  try {
    // Extract device_id from token payload
    const payloadStr = token.split('.')[0];
    const payload = JSON.parse(payloadStr);
    const { device_id } = payload;

    // Get device secret
    const { data: device } = await supabase
      .from('devices')
      .select('secret_hash')
      .eq('device_id', device_id)
      .single();

    if (!device) {
      return { valid: false, message: 'Device not found' };
    }

    return await verifyToken(supabase, token, device.secret_hash);
  } catch (err) {
    return { valid: false, message: err.message };
  }
}

// ============================================================================
// REVOKE: Revoke device
// ============================================================================
async function handleRevoke(body) {
  const { device_id } = body;

  if (!device_id) {
    return { success: false, message: 'device_id required' };
  }

  try {
    const { error } = await supabase
      .from('devices')
      .update({ is_revoked: true })
      .eq('device_id', device_id);

    if (error) throw error;

    await addBlock(supabase, 'REVOKE', device_id, { reason: 'Manual revocation' });

    return { success: true, message: 'Device revoked' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ============================================================================
// DEVICES: List all devices
// ============================================================================
async function handleDevices() {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('device_id, trust_score, is_revoked, last_auth_at, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { devices: data };
  } catch (err) {
    throw new Error(`Failed to fetch devices: ${err.message}`);
  }
}

// ============================================================================
// LEDGER: Get blockchain
// ============================================================================
async function handleLedger() {
  try {
    const { data, error } = await supabase
      .from('blockchain')
      .select('idx, timestamp, event, device_id, data, hash, prev_hash')
      .order('idx', { ascending: false })
      .limit(100);

    if (error) throw error;

    return { blocks: data };
  } catch (err) {
    throw new Error(`Failed to fetch ledger: ${err.message}`);
  }
}

// ============================================================================
// INTEGRITY: Check chain integrity
// ============================================================================
async function handleIntegrity() {
  try {
    const result = await verifyChain(supabase);
    
    if (result.valid) {
      return { valid: true, message: 'Blockchain integrity verified' };
    } else {
      return {
        valid: false,
        brokenBlock: result.brokenBlock,
        message: `Integrity check failed at block ${result.brokenBlock}: ${result.reason}`
      };
    }
  } catch (err) {
    throw new Error(`Integrity check failed: ${err.message}`);
  }
}

// ============================================================================
// TAMPER: Tamper with a block (demo)
// ============================================================================
async function handleTamper(body) {
  const { idx } = body;

  if (idx === undefined) {
    return { success: false, message: 'Block idx required' };
  }

  try {
    // Modify the block's data to break the hash
    const { error } = await supabase
      .from('blockchain')
      .update({ data: JSON.stringify({ tampered: true }) })
      .eq('idx', idx);

    if (error) throw error;

    return { success: true, message: `Block ${idx} tampered (hash now invalid)` };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ============================================================================
// SIMULATE: Simulate device behavior
// ============================================================================
async function handleSimulate(body) {
  const { device_id, mode } = body;

  if (!device_id || !mode) {
    return { success: false, message: 'device_id and mode required' };
  }

  try {
    const results = [];

    if (mode === 'good') {
      // Simulate 10 successful authentications
      for (let i = 0; i < 10; i++) {
        const timestamp = Date.now().toString();
        const nonce = generateDeviceId();
        
        // Get device secret
        const { data: device } = await supabase
          .from('devices')
          .select('secret_hash')
          .eq('device_id', device_id)
          .single();

        if (!device) {
          return { success: false, message: 'Device not found' };
        }

        const hmac = hmacSHA256(device.secret_hash, `${device_id}${timestamp}${nonce}`);
        const result = await authenticateDevice(supabase, device_id, timestamp, nonce, hmac);
        results.push({ attempt: i + 1, ...result });

        // Small delay to avoid burst penalty on all attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return { success: true, mode: 'good', results };

    } else if (mode === 'attacker') {
      // Simulate 6 burst authentications (trigger -10 penalty)
      for (let i = 0; i < 6; i++) {
        const timestamp = Date.now().toString();
        const nonce = generateDeviceId();
        
        const { data: device } = await supabase
          .from('devices')
          .select('secret_hash')
          .eq('device_id', device_id)
          .single();

        if (!device) {
          return { success: false, message: 'Device not found' };
        }

        const hmac = hmacSHA256(device.secret_hash, `${device_id}${timestamp}${nonce}`);
        const result = await authenticateDevice(supabase, device_id, timestamp, nonce, hmac);
        results.push({ attempt: i + 1, type: 'burst', ...result });
      }

      // Wait a bit, then send 2 failed authentications
      await new Promise(resolve => setTimeout(resolve, 200));

      for (let i = 0; i < 2; i++) {
        const timestamp = Date.now().toString();
        const nonce = generateDeviceId();
        const wrongHmac = 'invalid_hmac_signature';
        
        const result = await authenticateDevice(supabase, device_id, timestamp, nonce, wrongHmac);
        results.push({ attempt: i + 7, type: 'failed', ...result });
      }

      return { success: true, mode: 'attacker', results };
    }

    return { success: false, message: 'Invalid mode (use "good" or "attacker")' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
export async function GET(request, { params }) {
  const action = params.action;

  try {
    if (action === 'devices') {
      const result = await handleDevices();
      return Response.json(result);
    }

    if (action === 'ledger') {
      const result = await handleLedger();
      return Response.json(result);
    }

    if (action === 'integrity') {
      const result = await handleIntegrity();
      return Response.json(result);
    }

    return Response.json({ error: 'Unknown action' }, { status: 404 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const action = params.action;

  try {
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // Empty body is OK for some actions
    }

    if (action === 'register') {
      const result = await handleRegister();
      return Response.json(result);
    }

    if (action === 'auth') {
      const result = await handleAuth(body);
      return Response.json(result);
    }

    if (action === 'verify') {
      const result = await handleVerify(body);
      return Response.json(result);
    }

    if (action === 'revoke') {
      const result = await handleRevoke(body);
      return Response.json(result);
    }

    if (action === 'simulate') {
      const result = await handleSimulate(body);
      return Response.json(result);
    }

    if (action === 'tamper') {
      const result = await handleTamper(body);
      return Response.json(result);
    }

    return Response.json({ error: 'Unknown action' }, { status: 404 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
