const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
// One hash formula used everywhere. data is the raw stored string.
const blockHash = (b) => sha(`${b.idx}${b.ts}${b.event}${b.device_id}${b.data}${b.prev_hash}`);

// Append a block (retries if two writers collide on idx)
async function addBlock(event, device_id, data = {}) {
  for (let i = 0; i < 3; i++) {
    const { data: last, error: e1 } = await db.from('blockchain')
      .select('idx, hash').order('idx', { ascending: false }).limit(1);
    if (e1) throw new Error(e1.message);
    if (!last || !last.length) throw new Error('Genesis block missing. Run supabase.sql');
    const b = {
      idx: Number(last[0].idx) + 1, ts: Date.now(), event,
      device_id: device_id || 'system', data: JSON.stringify(data),
      prev_hash: last[0].hash,
    };
    b.hash = blockHash(b);
    const { error } = await db.from('blockchain').insert(b);
    if (!error) return b;
    if (error.code !== '23505') throw new Error(error.message); // only retry on idx conflict
  }
  throw new Error('Could not append block');
}

// Recompute every hash and link
async function verifyChain() {
  const { data, error } = await db.from('blockchain').select('*').order('idx', { ascending: true });
  if (error) throw new Error(error.message);
  const blocks = data || [];
  if (!blocks.length) return { valid: false, brokenAt: 0 };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (blockHash(b) !== b.hash) return { valid: false, brokenAt: b.idx };
    if (i > 0 && b.prev_hash !== blocks[i - 1].hash) return { valid: false, brokenAt: b.idx };
  }
  return { valid: true, brokenAt: null };
}

// Signed token: base64(payload).hmac
function sign(payload) {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', process.env.TOKEN_SECRET).update(b64).digest('hex');
  return `${b64}.${sig}`;
}

function verifyToken(token) {
  try {
    const [b64, sig] = String(token).split('.');
    const expected = crypto.createHmac('sha256', process.env.TOKEN_SECRET).update(b64).digest('hex');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(b64, 'base64').toString());
  } catch { return null; }
}

// Trust score with clamping and auto-block below 20
async function updateTrust(device_id, delta) {
  const { data: dev } = await db.from('devices').select('trust_score, status').eq('device_id', device_id).single();
  if (!dev) return null;
  const trust = Math.max(0, Math.min(100, dev.trust_score + delta));
  const status = trust < 20 ? 'blocked' : (dev.status === 'revoked' ? 'revoked' : dev.status);
  await db.from('devices').update({ trust_score: trust, status }).eq('device_id', device_id);
  return trust;
}

// Token lifetime by trust
function ttlFor(trust) {
  if (trust >= 70) return 1800;
  if (trust >= 40) return 300;
  return 60;
}

module.exports = { db, addBlock, verifyChain, sign, verifyToken, updateTrust, ttlFor };
