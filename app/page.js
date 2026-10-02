'use client';
import { useState, useEffect } from 'react';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function signAuth(device_id, secret) {
  const keyHex = hex(await crypto.subtle.digest('SHA-256', enc.encode(secret)));
  const key = await crypto.subtle.importKey('raw', enc.encode(keyHex),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ts = Date.now();
  const nonce = crypto.randomUUID();
  const msg = `${device_id}${ts}${nonce}`;
  const sig = hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  return { device_id, ts, nonce, sig };
}

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [integrity, setIntegrity] = useState({ valid: true });
  const [token, setToken] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [secrets, setSecrets] = useState({});

  // Load secrets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('device_secrets');
    if (saved) {
      try {
        setSecrets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load secrets:', e);
      }
    }
  }, []);

  // Save secrets to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(secrets).length > 0) {
      localStorage.setItem('device_secrets', JSON.stringify(secrets));
    }
  }, [secrets]);
  const [stats, setStats] = useState({ totalDevices: 0, totalBlocks: 0, activeDevices: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [d, c] = await Promise.all([
          fetch('/api/devices').then(r => r.json()),
          fetch('/api/chain').then(r => r.json())
        ]);
        if (d.error) console.error('Devices error:', d.error);
        if (c.error) console.error('Chain error:', c.error);
        const devs = d.devices || [];
        const blks = c.blocks || [];
        setDevices(devs);
        setBlocks(blks);
        setIntegrity(c.integrity || { valid: true, brokenAt: null });
        setStats({
          totalDevices: devs.length,
          totalBlocks: blks.length,
          activeDevices: devs.filter(d => d.status === 'active').length
        });
      } catch (err) {
        console.error('Load error:', err);
      }
    };
    load();
    const int = setInterval(load, 3000);
    return () => clearInterval(int);
  }, []);

  const register = async () => {
    try {
      const r = await fetch('/api/register', { method: 'POST' }).then(r => r.json());
      if (r.error) return alert(`Error: ${r.error}`);
      alert(`Device: ${r.device_id}\nSecret: ${r.secret}\n\nSave the secret!`);
      setSecrets({ ...secrets, [r.device_id]: r.secret });
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const simulate = async (mode, badSig = false) => {
    let id = prompt('Device ID:');
    if (!id) return;
    
    // If secret is missing, ask for it
    if (!secrets[id]) {
      const secret = prompt(`Secret for device ${id}:\n(Find it in the alert when you registered)`);
      if (!secret) return alert('Secret is required');
      setSecrets({ ...secrets, [id]: secret });
      return alert('Secret saved! Click the button again to authenticate.');
    }
    
    try {
      for (let i = 0; i < (mode === 'good' ? 3 : 5); i++) {
        let authData;
        if (badSig) {
          const ts = Date.now();
          const nonce = crypto.randomUUID();
          authData = { device_id: id, ts, nonce, sig: 'invalid_signature_' + i };
        } else {
          authData = await signAuth(id, secrets[id]);
        }
        const r = await fetch('/api/auth', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(authData) 
        }).then(r => r.json());
        if (r.error && i === 0) alert(`Error: ${r.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const getToken = async (id) => {
    if (!secrets[id]) return alert('Secret not found');
    try {
      const authData = await signAuth(id, secrets[id]);
      const r = await fetch('/api/auth', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(authData) 
      }).then(r => r.json());
      if (r.error) return alert(`Error: ${r.error}`);
      if (r.token) setToken(r.token);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const verifyTok = async () => {
    const r = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then(r => r.json());
    setVerifyResult(r);
  };

  const revoke = async (id) => {
    await fetch('/api/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_id: id }) });
  };

  const verifyChain = async () => {
    try {
      const r = await fetch('/api/chain').then(r => r.json());
      if (r.error) return alert(`Error: ${r.error}`);
      const valid = r.integrity?.valid;
      const broken = r.integrity?.brokenAt;
      alert(valid ? '✅ Chain valid' : `❌ Broken at block ${broken}`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const tamper = async () => {
    await fetch('/api/tamper', { method: 'POST' });
  };

  const reset = async () => {
    if (confirm('Delete all data?')) {
      await fetch('/api/reset', { method: 'POST' });
      setSecrets({});
      localStorage.removeItem('device_secrets');
    }
  };

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={{...styles.heroContent, gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr'}}>
          <div style={styles.heroLeft}>
            <div style={styles.label}>BLOCKCHAIN-POWERED IOT</div>
            <h1 style={styles.title}>
              Secure your IoT<br />
              devices with trust
            </h1>
            <p style={styles.description}>
              Decentralized authentication using blockchain technology. 
              Every device interaction is recorded on an immutable ledger, 
              with dynamic trust scoring and automatic threat detection.
            </p>
            <div style={styles.heroButtons}>
              <button onClick={register} style={styles.primaryBtn}>Register Device</button>
              <button onClick={verifyChain} style={styles.secondaryBtn}>Verify Chain</button>
            </div>
          </div>

          <div style={styles.heroRight}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{stats.totalDevices}</div>
              <div style={styles.statLabel}>Total Devices</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{stats.activeDevices}</div>
              <div style={styles.statLabel}>Active Devices</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{stats.totalBlocks}</div>
              <div style={styles.statLabel}>Blockchain Entries</div>
            </div>
          </div>
        </div>
      </section>

      {/* Chain Status Alert */}
      {!integrity?.valid && integrity?.brokenAt !== null && (
        <div style={styles.alertError}>
          <span style={styles.alertIcon}>⚠</span>
          Chain integrity compromised at block {integrity.brokenAt}
        </div>
      )}
      {integrity?.valid && blocks.length > 0 && (
        <div style={styles.alertSuccess}>
          <span style={styles.alertIcon}>✓</span>
          Blockchain integrity verified
        </div>
      )}

      {/* Action Buttons */}
      <section style={styles.actionsSection}>
        <h2 style={styles.sectionTitle}>Testing & Management</h2>
        <div style={styles.actionGrid}>
          <button onClick={() => simulate('good')} style={styles.actionBtn}>
            <span style={styles.actionIcon}>✓</span>
            <span style={styles.actionText}>Simulate Good Auth</span>
          </button>
          <button onClick={() => simulate('bad', true)} style={styles.actionBtn}>
            <span style={styles.actionIcon}>✗</span>
            <span style={styles.actionText}>Simulate Attacker</span>
          </button>
          <button onClick={tamper} style={styles.actionBtn}>
            <span style={styles.actionIcon}>⚡</span>
            <span style={styles.actionText}>Tamper Block</span>
          </button>
          <button onClick={reset} style={styles.actionBtn}>
            <span style={styles.actionIcon}>↻</span>
            <span style={styles.actionText}>Reset System</span>
          </button>
        </div>
      </section>

      {/* Devices Table */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Registered Devices</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Device ID</th>
                <th style={styles.th}>Trust Score</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.device_id} style={styles.tr}>
                  <td style={styles.td}>
                    <code style={styles.code}>{d.device_id}</code>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.trustBar}>
                      <div style={{
                        ...styles.trustFill,
                        width: d.trust_score + '%',
                        background: d.trust_score >= 70 ? '#10b981' : d.trust_score >= 40 ? '#f59e0b' : '#ef4444'
                      }}></div>
                    </div>
                    <span style={styles.trustText}>{d.trust_score}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      background: d.status === 'active' ? '#10b98120' : '#ef444420',
                      color: d.status === 'active' ? '#10b981' : '#ef4444'
                    }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button onClick={() => getToken(d.device_id)} style={styles.tableBtn}>Get Token</button>
                    <button onClick={() => revoke(d.device_id)} style={styles.tableBtnDanger}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Token Section */}
      {token && (
        <section style={styles.tokenSection}>
          <h3 style={styles.tokenTitle}>Generated Token</h3>
          <div style={styles.tokenBox}>
            <code style={styles.tokenCode}>{token}</code>
          </div>
          <button onClick={verifyTok} style={styles.primaryBtn}>Verify Token</button>
          {verifyResult && (
            <div style={verifyResult.valid ? styles.alertSuccess : styles.alertError}>
              {verifyResult.valid ? `✓ Valid (trust: ${verifyResult.trust})` : '✗ Invalid or expired'}
            </div>
          )}
        </section>
      )}

      {/* Blockchain Ledger */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Blockchain Ledger</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Block</th>
                <th style={styles.th}>Event</th>
                <th style={styles.th}>Device</th>
                <th style={styles.th}>Hash</th>
                <th style={styles.th}>Previous</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map(b => (
                <tr key={b.idx} style={styles.tr}>
                  <td style={styles.td}><strong>#{b.idx}</strong></td>
                  <td style={styles.td}>
                    <span style={styles.badge}>{b.event}</span>
                  </td>
                  <td style={styles.td}>
                    <code style={styles.code}>{b.device_id?.slice(0, 12)}</code>
                  </td>
                  <td style={styles.td}>
                    <code style={styles.code}>{b.hash?.slice(0, 16)}...</code>
                  </td>
                  <td style={styles.td}>
                    <code style={styles.code}>{b.prev_hash?.slice(0, 16)}...</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#000000',
    color: '#F7F7F7',
    padding: '0',
  },
  hero: {
    padding: '80px 20px 120px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  heroContent: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '64px',
    className: 'hero-content',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    color: '#B8A4FF',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 'clamp(40px, 8vw, 72px)',
    fontWeight: '800',
    lineHeight: '1',
    letterSpacing: '-0.04em',
    color: '#F7F7F7',
    margin: '0',
  },
  description: {
    fontSize: 'clamp(16px, 2.5vw, 21px)',
    lineHeight: '1.6',
    color: '#A7A7A7',
    maxWidth: '760px',
    margin: '0',
  },
  heroButtons: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginTop: '16px',
  },
  primaryBtn: {
    background: '#6F2BF2',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '9999px',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  secondaryBtn: {
    background: 'transparent',
    color: '#FFFFFF',
    border: '1px solid #444',
    borderRadius: '9999px',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  heroRight: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  statCard: {
    background: '#0A0A0A',
    border: '1px solid #252525',
    borderRadius: '12px',
    padding: '32px 24px',
    textAlign: 'center',
  },
  statNumber: {
    fontSize: 'clamp(36px, 5vw, 48px)',
    fontWeight: '700',
    color: '#8A5CF6',
    marginBottom: '8px',
  },
  statLabel: {
    fontSize: '15px',
    color: '#A7A7A7',
  },
  alertError: {
    maxWidth: '1400px',
    margin: '0 auto 32px',
    padding: '16px 24px',
    background: '#3D1F1F',
    border: '1px solid #7F1D1D',
    borderRadius: '8px',
    color: '#FCA5A5',
    fontSize: '16px',
    marginLeft: '20px',
    marginRight: '20px',
  },
  alertSuccess: {
    maxWidth: '1400px',
    margin: '0 auto 32px',
    padding: '16px 24px',
    background: '#1F3D1F',
    border: '1px solid #1D7F1D',
    borderRadius: '8px',
    color: '#86EFAC',
    fontSize: '16px',
    marginLeft: '20px',
    marginRight: '20px',
  },
  alertIcon: {
    marginRight: '12px',
    fontSize: '20px',
  },
  actionsSection: {
    maxWidth: '1400px',
    margin: '0 auto 80px',
    padding: '0 20px',
  },
  sectionTitle: {
    fontSize: 'clamp(28px, 4vw, 36px)',
    fontWeight: '700',
    marginBottom: '32px',
    letterSpacing: '-0.02em',
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  actionBtn: {
    background: '#0A0A0A',
    border: '1px solid #252525',
    borderRadius: '12px',
    padding: '24px',
    color: '#F7F7F7',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    fontSize: '16px',
    fontWeight: '600',
  },
  actionIcon: {
    fontSize: '32px',
    color: '#8A5CF6',
  },
  actionText: {
    fontSize: '16px',
  },
  section: {
    maxWidth: '1400px',
    margin: '0 auto 80px',
    padding: '0 20px',
  },
  tableContainer: {
    overflowX: 'auto',
    background: '#0A0A0A',
    border: '1px solid #252525',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '600px',
  },
  th: {
    textAlign: 'left',
    padding: '16px 24px',
    borderBottom: '1px solid #252525',
    fontSize: '14px',
    fontWeight: '700',
    color: '#A7A7A7',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tr: {
    borderBottom: '1px solid #1A1A1A',
  },
  td: {
    padding: '20px 24px',
    fontSize: '15px',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#B8A4FF',
    background: '#1A1A1A',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  trustBar: {
    width: '120px',
    height: '8px',
    background: '#1A1A1A',
    borderRadius: '4px',
    overflow: 'hidden',
    display: 'inline-block',
    marginRight: '12px',
    verticalAlign: 'middle',
  },
  trustFill: {
    height: '100%',
    transition: 'width 0.3s',
  },
  trustText: {
    fontSize: '14px',
    fontWeight: '600',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    background: '#252525',
    color: '#A7A7A7',
  },
  tableBtn: {
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '6px',
    padding: '6px 14px',
    color: '#F7F7F7',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginRight: '8px',
  },
  tableBtnDanger: {
    background: 'transparent',
    border: '1px solid #7F1D1D',
    borderRadius: '6px',
    padding: '6px 14px',
    color: '#FCA5A5',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tokenSection: {
    maxWidth: '1400px',
    margin: '0 auto 80px',
    padding: '32px 20px',
    background: '#0A0A0A',
    border: '1px solid #252525',
    borderRadius: '12px',
    marginLeft: '20px',
    marginRight: '20px',
  },
  tokenTitle: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '16px',
  },
  tokenBox: {
    background: '#000000',
    border: '1px solid #252525',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    overflowX: 'auto',
  },
  tokenCode: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#B8A4FF',
    wordBreak: 'break-all',
  },
};
