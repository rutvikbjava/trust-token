const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Add block with retry on idx conflict
async function addBlock(event, device_id, data) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: last } = await db.from('blocks').select('idx, hash').order('idx', { ascending: false }).limit(1).single();
    const idx = last ? last.idx + 1 : 0;
    const ts = Date.now();
    const prev_hash = last ? last.hash : '0';
    const dataStr = JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(`${idx}${ts}${event}${device_id}${dataStr}${prev_hash}`).digest('hex');
    
    const { error } = await db.from('blocks').insert({ idx, ts, event, device_id, data, prev_hash, hash });
    if (!error) return { idx, hash };
    if (!error?.message?.includes('duplicate')) throw error;
  }
  throw new Error('Block insert failed after 3 retries');
}

// Verify blockchain integrity
async function verifyChain() {
  const { data: blocks } = await db.from('blocks').select('*').order('idx', { ascending: true });
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const dataStr = JSON.stringify(b.data);
    const expected = crypto.createHash('sha256').update(`${b.idx}${b.ts}${b.event}${b.device_id}${dataStr}${b.prev_hash}`).digest('hex');
    if (b.hash !== expected) return { valid: false, brokenAt: b.idx };
    if (i > 0 && b.prev_hash !== blocks[i - 1].hash) return { valid: false, brokenAt: b.idx };
  }
  return { valid: true, brokenAt: null };
}

// Sign payload with HMAC
function sign(payload) {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', process.env.TOKEN_SECRET).update(b64).digest('hex');
  return `${b64}.${sig}`;
}

// Verify token signature
function verifyToken(token) {
  try {
    const [b64, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', process.env.TOKEN_SECRET).update(b64).digest('hex');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(b64, 'base64').toString());
  } catch {
    return null;
  }
}

// Update trust score with clamping and auto-block
async function updateTrust(device_id, delta) {
  const { data: dev } = await db.from('devices').select('trust, status').eq('device_id', device_id).single();
  if (!dev) return;
  const trust = Math.max(0, Math.min(100, dev.trust + delta));
  const status = trust < 20 ? 'blocked' : (dev.status === 'revoked' ? 'revoked' : 'active');
  await db.from('devices').update({ trust, status }).eq('device_id', device_id);
  return trust;
}

// Token TTL based on trust
function ttlFor(trust) {
  if (trust >= 70) return 1800; // 30 min
  if (trust >= 40) return 300;  // 5 min
  return 60; // 1 min
}

module.exports = { db, addBlock, verifyChain, sign, verifyToken, updateTrust, ttlFor };
