'use client';

import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [devicesRes, ledgerRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/ledger')
      ]);

      const devicesData = await devicesRes.json();
      const ledgerData = await ledgerRes.json();

      setDevices(devicesData.devices || []);
      setBlocks(ledgerData.blocks || []);
    } catch (err) {
      setMessage(`Error loading data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function registerDevice() {
    try {
      const res = await fetch('/api/register', { method: 'POST' });
      const data = await res.json();

      if (data.device_id) {
        alert(`Device registered!\n\nDevice ID: ${data.device_id}\n\nSecret: ${data.secret}\n\n⚠️ Save this secret! It won't be shown again.`);
        setMessage(`Device ${data.device_id} registered successfully`);
        loadData();
      } else {
        setMessage(`Error: ${data.error || 'Registration failed'}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  }

  async function simulateDevice(mode) {
    const device_id = prompt(`Enter device ID to simulate ${mode} behavior:`);
    if (!device_id) return;

    try {
      setMessage(`Simulating ${mode} device...`);
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id, mode })
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`Simulation complete: ${data.results.length} attempts`);
        loadData();
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  }

  async function revokeDevice() {
    const device_id = prompt('Enter device ID to revoke:');
    if (!device_id) return;

    try {
      const res = await fetch('/api/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id })
      });

      const data = await res.json();
      setMessage(data.message);
      loadData();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  }

  async function verifyChain() {
    try {
      setMessage('Verifying blockchain integrity...');
      const res = await fetch('/api/integrity');
      const data = await res.json();

      if (data.valid) {
        setMessage('✅ Blockchain integrity verified - all blocks valid!');
      } else {
        setMessage(`❌ Integrity check failed: ${data.message}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  }

  async function tamperBlock() {
    const idx = prompt('Enter block index to tamper with:');
    if (idx === null) return;

    try {
      const res = await fetch('/api/tamper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idx: parseInt(idx) })
      });

      const data = await res.json();
      setMessage(data.message);
      loadData();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  }

  function getTrustColor(trust) {
    if (trust >= 70) return '#22c55e';
    if (trust >= 40) return '#eab308';
    return '#ef4444';
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ color: '#1f2937', marginBottom: '10px' }}>
        🔐 Blockchain IoT Authentication Dashboard
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '30px' }}>
        Dynamic trust tokens for IoT device authentication
      </p>

      {/* Actions */}
      <div style={{ marginBottom: '30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={registerDevice} style={buttonStyle}>
          ➕ Register Device
        </button>
        <button onClick={() => simulateDevice('good')} style={{ ...buttonStyle, backgroundColor: '#22c55e' }}>
          ✅ Simulate Good Device
        </button>
        <button onClick={() => simulateDevice('attacker')} style={{ ...buttonStyle, backgroundColor: '#ef4444' }}>
          ⚠️ Simulate Attacker
        </button>
        <button onClick={revokeDevice} style={{ ...buttonStyle, backgroundColor: '#dc2626' }}>
          🚫 Revoke Device
        </button>
        <button onClick={verifyChain} style={{ ...buttonStyle, backgroundColor: '#3b82f6' }}>
          🔍 Verify Chain
        </button>
        <button onClick={tamperBlock} style={{ ...buttonStyle, backgroundColor: '#f59e0b' }}>
          🔨 Tamper Block (Demo)
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '15px',
          backgroundColor: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          marginBottom: '20px',
          color: '#1e40af'
        }}>
          {message}
        </div>
      )}

      {/* Devices Table */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#1f2937', marginBottom: '15px' }}>📱 Devices ({devices.length})</h2>
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Device ID</th>
                <th style={thStyle}>Trust Score</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Last Auth</th>
                <th style={thStyle}>Created</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>
                    No devices registered yet
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.device_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>
                      <code style={{ fontSize: '13px' }}>{device.device_id}</code>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontWeight: '600',
                        backgroundColor: getTrustColor(device.trust_score) + '20',
                        color: getTrustColor(device.trust_score)
                      }}>
                        {device.trust_score}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {device.is_revoked ? (
                        <span style={{ color: '#dc2626', fontWeight: '600' }}>🚫 Revoked</span>
                      ) : (
                        <span style={{ color: '#22c55e', fontWeight: '600' }}>✅ Active</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {device.last_auth_at ? new Date(device.last_auth_at).toLocaleString() : 'Never'}
                    </td>
                    <td style={tdStyle}>
                      {new Date(device.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blockchain Ledger */}
      <div>
        <h2 style={{ color: '#1f2937', marginBottom: '15px' }}>⛓️ Blockchain Ledger ({blocks.length} blocks)</h2>
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Index</th>
                <th style={thStyle}>Timestamp</th>
                <th style={thStyle}>Event</th>
                <th style={thStyle}>Device ID</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Hash</th>
              </tr>
            </thead>
            <tbody>
              {blocks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>
                    No blocks yet
                  </td>
                </tr>
              ) : (
                blocks.map((block) => (
                  <tr key={block.idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>
                      <strong>{block.idx}</strong>
                    </td>
                    <td style={tdStyle}>
                      {new Date(block.timestamp).toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      <span style={getEventBadgeStyle(block.event)}>
                        {block.event}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <code style={{ fontSize: '12px' }}>{block.device_id}</code>
                    </td>
                    <td style={tdStyle}>
                      <code style={{ fontSize: '11px', color: '#6b7280' }}>
                        {typeof block.data === 'string' ? block.data.substring(0, 50) : JSON.stringify(block.data).substring(0, 50)}
                      </code>
                    </td>
                    <td style={tdStyle}>
                      <code style={{ fontSize: '11px', color: '#6b7280' }}>
                        {block.hash.substring(0, 16)}...
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: '10px 20px',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
  transition: 'all 0.2s'
};

const thStyle = {
  padding: '12px',
  textAlign: 'left',
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151'
};

const tdStyle = {
  padding: '12px',
  fontSize: '14px',
  color: '#1f2937'
};

function getEventBadgeStyle(event) {
  const baseStyle = {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600'
  };

  const colors = {
    REGISTER: { bg: '#dbeafe', color: '#1e40af' },
    AUTH_SUCCESS: { bg: '#dcfce7', color: '#166534' },
    AUTH_FAIL: { bg: '#fee2e2', color: '#991b1b' },
    TOKEN_ISSUED: { bg: '#e0e7ff', color: '#3730a3' },
    REVOKE: { bg: '#fef3c7', color: '#92400e' },
    GENESIS: { bg: '#f3e8ff', color: '#6b21a8' }
  };

  const color = colors[event] || { bg: '#f3f4f6', color: '#374151' };

  return {
    ...baseStyle,
    backgroundColor: color.bg,
    color: color.color
  };
}
