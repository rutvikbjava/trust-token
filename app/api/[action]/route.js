const crypto = require('crypto');
const { db, addBlock, verifyChain, sign, verifyToken, updateTrust, ttlFor } = require('../../../lib/core');

export async function POST(req, { params }) {
  const { action } = params;
  const body = await req.json().catch(() => ({}));

  try {
    // REGISTER
    if (action === 'register') {
      const device_id = crypto.randomBytes(8).toString('hex');
      const secret = crypto.randomBytes(16).toString('hex');
      const secret_hash = crypto.createHash('sha256').update(secret).digest('hex');
      // NOTE: Storing raw secret for HMAC demo. Production should use hardware-backed keys.
      await db.from('devices').insert({ device_id, secret, trust: 50 });
      await addBlock('REGISTER', device_id, { trust: 50 });
      return Response.json({ device_id, secret });
    }

    // AUTH
    if (action === 'auth') {
      const { device_id, ts, nonce, sig } = body;
      const { data: dev } = await db.from('devices').select('*').eq('device_id', device_id).single();
      if (!dev || dev.status !== 'active') return Response.json({ error: 'Device inactive' }, { status: 403 });
      if (Math.abs(Date.now() - ts) > 60000) return Response.json({ error: 'Stale timestamp' }, { status: 400 });
      
      const { data: used } = await db.from('nonces').select('nonce').eq('nonce', nonce).single();
      if (used) return Response.json({ error: 'Replay detected' }, { status: 400 });
      
      const expected = crypto.createHmac('sha256', dev.secret).update(`${device_id}${ts}${nonce}`).digest('hex');
      if (sig !== expected) {
        await updateTrust(device_id, -15);
        await addBlock('AUTH_FAIL', device_id, { reason: 'Invalid signature' });
        return Response.json({ error: 'Invalid signature' }, { status: 401 });
      }

      await db.from('nonces').insert({ nonce, ts });
      
      // Check burst: count AUTH blocks in last 60s
      const { data: recent } = await db.from('blocks').select('idx').eq('device_id', device_id)
        .in('event', ['AUTH_SUCCESS', 'AUTH_FAIL']).gte('ts', Date.now() - 60000);
      const burst = recent && recent.length > 5;
      
      const trust = await updateTrust(device_id, burst ? -5 : 5); // +5 base, -10 if burst
      await addBlock('AUTH_SUCCESS', device_id, { trust, burst });
      
      const ttl = ttlFor(trust);
      const payload = { device_id, trust, exp: Math.floor(Date.now() / 1000) + ttl };
      const token = sign(payload);
      await addBlock('TOKEN_ISSUED', device_id, { exp: payload.exp });
      
      return Response.json({ token, trust, expires_in: ttl });
    }

    // VERIFY
    if (action === 'verify') {
      const payload = verifyToken(body.token);
      if (!payload) return Response.json({ valid: false }, { status: 401 });
      if (payload.exp < Date.now() / 1000) return Response.json({ valid: false, error: 'Expired' }, { status: 401 });
      
      const { data: dev } = await db.from('devices').select('status, trust').eq('device_id', payload.device_id).single();
      if (!dev || dev.status !== 'active') return Response.json({ valid: false, error: 'Device inactive' }, { status: 403 });
      
      return Response.json({ valid: true, trust: dev.trust, exp: payload.exp });
    }

    // REVOKE
    if (action === 'revoke') {
      await db.from('devices').update({ status: 'revoked' }).eq('device_id', body.device_id);
      await addBlock('REVOKE', body.device_id, {});
      return Response.json({ success: true });
    }

    // TAMPER
    if (action === 'tamper') {
      const { data: blocks } = await db.from('blocks').select('idx').order('idx').limit(100);
      if (blocks.length > 2) {
        const mid = blocks[Math.floor(blocks.length / 2)].idx;
        await db.from('blocks').update({ data: { tampered: true } }).eq('idx', mid);
        return Response.json({ tampered: mid });
      }
      return Response.json({ error: 'Not enough blocks' }, { status: 400 });
    }

    // RESET
    if (action === 'reset') {
      await db.from('nonces').delete().neq('nonce', '');
      await db.from('blocks').delete().neq('idx', -1);
      await db.from('devices').delete().neq('device_id', '');
      const genesis = crypto.createHash('sha256').update('00GENESISsystem{}0').digest('hex');
      await db.from('blocks').insert({ idx: 0, ts: 0, event: 'GENESIS', device_id: 'system', data: {}, prev_hash: '0', hash: genesis });
      return Response.json({ reset: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 404 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req, { params }) {
  const { action } = params;

  try {
    // CHAIN
    if (action === 'chain') {
      const { data: blocks } = await db.from('blocks').select('*').order('idx', { ascending: false }).limit(50);
      const integrity = await verifyChain();
      return Response.json({ blocks, integrity });
    }

    // DEVICES
    if (action === 'devices') {
      const { data: devices } = await db.from('devices').select('device_id, trust, status, created_at').order('created_at', { ascending: false });
      return Response.json({ devices });
    }

    return Response.json({ error: 'Unknown action' }, { status: 404 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
