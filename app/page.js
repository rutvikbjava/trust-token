'use client';
import { useState, useEffect } from 'react';

/*
DEMO SCRIPT:
1. Click "Register Device" - note device_id and secret (stored automatically)
2. Click "Simulate Good" - enter device_id, trust increases to ~65, token issued
3. Click "Simulate Attacker" - trust drops, device gets blocked (trust < 20)
4. Click "Tamper Block" - modifies middle block data
5. Click "Verify Chain" - shows "Chain broken at #N"
6. Click "Reset" - clears all data, starts fresh with genesis block
7. Use "Get Token" on any active device to issue a token manually
8. Use "Verify Token" to check token validity and expiration
*/

async function hmac(key, msg) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [integrity, setIntegrity] = useState({ valid: true });
  const [token, setToken] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [secrets, setSecrets] = useState({});

  useEffect(() => {
    const load = async () => {
      const [d, c] = await Promise.all([fetch('/api/devices').then(r => r.json()), fetch('/api/chain').then(r => r.json())]);
      setDevices(d.devices || []);
      setBlocks(c.blocks || []);
      setIntegrity(c.integrity || { valid: true });
    };
    load();
    const int = setInterval(load, 3000);
    return () => clearInterval(int);
  }, []);

  const register = async () => {
    const r = await fetch('/api/register', { method: 'POST' }).then(r => r.json());
    alert(`Device: ${r.device_id}\nSecret: ${r.secret}\n\nSave the secret!`);
    setSecrets({ ...secrets, [r.device_id]: r.secret });
  };

  const simulate = async (mode, badSig = false) => {
    const id = prompt('Device ID:');
    if (!id || !secrets[id]) return alert('Device not found or secret missing');
    for (let i = 0; i < (mode === 'good' ? 3 : 5); i++) {
      const ts = Date.now();
      const nonce = Math.random().toString(36);
      const sig = badSig ? 'badsig' : await hmac(secrets[id], `${id}${ts}${nonce}`);
      await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_id: id, ts, nonce, sig }) });
    }
  };

  const getToken = async (id) => {
    if (!secrets[id]) return alert('Secret not found');
    const ts = Date.now();
    const nonce = Math.random().toString(36);
    const sig = await hmac(secrets[id], `${id}${ts}${nonce}`);
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_id: id, ts, nonce, sig }) }).then(r => r.json());
    if (r.token) setToken(r.token);
  };

  const verifyTok = async () => {
    const r = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then(r => r.json());
    setVerifyResult(r);
  };

  const revoke = async (id) => {
    await fetch('/api/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_id: id }) });
  };

  const verifyChain = async () => {
    const r = await fetch('/api/chain').then(r => r.json());
    alert(r.integrity.valid ? '✅ Chain valid' : `❌ Broken at block ${r.integrity.brokenAt}`);
  };

  const tamper = async () => {
    await fetch('/api/tamper', { method: 'POST' });
  };

  const reset = async () => {
    if (confirm('Delete all data?')) {
      await fetch('/api/reset', { method: 'POST' });
      setSecrets({});
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <h1>IoT Blockchain Auth</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={register} style={btn}>Register Device</button>
        <button onClick={() => simulate('good')} style={btn}>Simulate Good</button>
        <button onClick={() => simulate('bad', true)} style={btn}>Simulate Attacker</button>
        <button onClick={verifyChain} style={btn}>Verify Chain</button>
        <button onClick={tamper} style={btn}>Tamper Block</button>
        <button onClick={reset} style={btn}>Reset</button>
      </div>

      {!integrity.valid && <div style={{ padding: 10, background: '#fee', color: '#c00', marginBottom: 20, borderRadius: 4 }}>❌ Chain broken at block {integrity.brokenAt}</div>}
      {integrity.valid && <div style={{ padding: 10, background: '#efe', color: '#060', marginBottom: 20, borderRadius: 4 }}>✅ Chain valid</div>}

      <h2>Devices</h2>
      <table style={table}>
        <thead><tr><th>ID</th><th>Trust</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {devices.map(d => (
            <tr key={d.device_id}>
              <td><code>{d.device_id}</code></td>
              <td>
                <div style={{ width: 100, height: 20, background: '#ddd', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: d.trust + '%', height: '100%', background: d.trust >= 70 ? '#4a4' : d.trust >= 40 ? '#da4' : '#d44' }}></div>
                </div>
                {d.trust}
              </td>
              <td style={{ color: d.status === 'active' ? '#4a4' : '#d44' }}>{d.status}</td>
              <td>
                <button onClick={() => getToken(d.device_id)} style={btnSm}>Get Token</button>
                <button onClick={() => revoke(d.device_id)} style={btnSm}>Revoke</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {token && (
        <div style={{ marginTop: 20, padding: 15, background: '#fff', borderRadius: 4 }}>
          <h3>Token</h3>
          <code style={{ display: 'block', wordBreak: 'break-all', fontSize: 12, marginBottom: 10 }}>{token}</code>
          <button onClick={verifyTok} style={btn}>Verify Token</button>
          {verifyResult && <div style={{ marginTop: 10 }}>{verifyResult.valid ? `✅ Valid (trust: ${verifyResult.trust})` : '❌ Invalid'}</div>}
        </div>
      )}

      <h2 style={{ marginTop: 30 }}>Ledger</h2>
      <table style={table}>
        <thead><tr><th>Idx</th><th>Event</th><th>Device</th><th>Hash</th><th>Prev</th></tr></thead>
        <tbody>
          {blocks.map(b => (
            <tr key={b.idx}>
              <td>{b.idx}</td>
              <td>{b.event}</td>
              <td><code>{b.device_id?.slice(0, 8)}</code></td>
              <td><code>{b.hash?.slice(0, 12)}</code></td>
              <td><code>{b.prev_hash?.slice(0, 12)}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const btn = { padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' };
const btnSm = { padding: '4px 8px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 5 };
const table = { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 4, overflow: 'hidden' };

