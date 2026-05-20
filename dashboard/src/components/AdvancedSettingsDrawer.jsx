import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, AlertCircle, Cpu, LogIn, LogOut, Code, Download, FileText, CheckCircle2, ArrowUpRight, Search, ShieldCheck } from 'lucide-react';

const AdvancedSettingsDrawer = ({ partner, onClose }) => {
  const [activeTab, setActiveTab] = useState('settings');
  const [searchTerm, setSearchTerm] = useState('');
  const [dbPartners, setDbPartners] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  // Fetch live partner certificate profiles to seed the dropdown selector dynamically
  useEffect(() => {
    fetch('http://localhost:8080/api/partners')
      .then(res => res.json())
      .then(data => {
        setDbPartners(data);
        setLoadingCerts(false);
      })
      .catch(err => {
        console.error("Failed to query certificate store", err);
        setLoadingCerts(false);
      });
  }, []);

  if (!partner) return null;

  // Mock data definitions for tracking grids
  const mockOutputFiles = [
    { name: 'Success_E2B_ACK5(3new).txt', size: '5.37 KB', time: 'May 17, 2026 12:25:34', status: 'Success', duration: '931ms', msgId: 'GAAS_Async-20260515-162534034-A6pp' },
    { name: 'TR-000303_EMA_E2BR3_20260515122229.xml', size: '12.4 KB', time: 'May 15, 2026 12:22:46', status: 'Success', duration: '1s 83ms', msgId: 'GAAS_Async-20260515-122246112-F9bb' }
  ];

  const mockInputFiles = [
    { name: 'ICSR_SUBMISSION_BATCH_001.xml', size: '18.2 KB', date: 'May 17, 2026 13:45:12', queueStatus: 'Pending Send' }
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: '580px', height: '100vh',
      background: '#ffffff', borderLeft: '1px solid #e2e8f0', boxShadow: '-4px 0 24px rgba(15, 23, 42, 0.08)',
      display: 'flex', zIndex: 9999, animation: 'slideIn 0.2s ease-out'
    }}>

      {/* LEFT NAVIGATION COLUMN SIDEBAR */}
      <div style={{
        width: '180px', background: '#f8fafc', borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', padding: '16px 0'
      }}>
        <div style={{ padding: '0 16px 16px 16px', borderBottom: '1px solid #e2e8f0', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Connector Actions
          </span>
        </div>
        <Tab id="settings" icon={<Settings size={16} />} label="Settings" active={activeTab} set={setActiveTab} />
        <Tab id="automation" icon={<RefreshCw size={16} />} label="Automation" active={activeTab} set={setActiveTab} />
        <Tab id="alerts" icon={<AlertCircle size={16} />} label="Alerts" active={activeTab} set={setActiveTab} />
        <Tab id="advanced" icon={<Cpu size={16} />} label="Advanced Logs" active={activeTab} set={setActiveTab} />
        <Tab id="input" icon={<LogIn size={16} />} label="Input (Send)" active={activeTab} set={setActiveTab} />
        <Tab id="output" icon={<LogOut size={16} />} label="Output (Receive)" active={activeTab} set={setActiveTab} />
        <Tab id="events" icon={<Code size={16} />} label="Events" active={activeTab} set={setActiveTab} />
      </div>

      {/* RIGHT VIEWPORT CONTENT PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Sticky Header Layer */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff'
        }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{partner.name}</h2>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>AS2 Profile Configuration Core</p>
          </div>
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '6px 16px', fontSize: '13px' }}>
            Save Changes
          </button>
        </div>

        {/* Dynamic Display Receptacle */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#ffffff' }}>

          {/* TAB 1: INTERACTIVE SETTINGS MANAGEMENT ENGINE */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: '0 0 14px 0' }}>Trading Partner Info</h4>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Connector Id:</label>
                  <input type="text" className="form-input" value={partner.as2_id} readOnly style={{ background: '#e2e8f0', color: '#475569', fontSize: '12px' }} />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Partner URL Callback Endpoint:</label>
                  <input type="text" className="form-input" defaultValue={partner.url} style={{ fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: '0 0 14px 0' }}>Security Profiling Matrix</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}><input type="checkbox" defaultChecked /> Sign outbound data</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}><input type="checkbox" defaultChecked /> Encrypt outbound data</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}><input type="checkbox" defaultChecked /> Require signatures</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}><input type="checkbox" defaultChecked /> Require crypt-envelope</label>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Encryption Algorithm Threshold:</label>
                  <select className="form-select" style={{ fontSize: '12px' }}>
                    <option selected>AES256</option>
                    <option>AES128</option>
                    <option>3DES</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', marginBottom: '12px' }}>
                  <input type="checkbox" defaultChecked /> Request MDN Acknowledgment Receipts
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#64748b' }}>Security Signature</span>
                    <label style={{ fontSize: '12px', marginRight: '10px' }}><input type="radio" name="sec" defaultChecked /> Signed</label>
                    <label style={{ fontSize: '12px' }}><input type="radio" name="sec" /> Unsigned</label>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#64748b' }}>Delivery Option</span>
                    <label style={{ fontSize: '12px', marginRight: '10px' }}><input type="radio" name="del" defaultChecked /> Sync</label>
                    <label style={{ fontSize: '12px' }}><input type="radio" name="del" /> Async</label>
                  </div>
                </div>
              </div>

              {/* DYNAMIC CERTIFICATE SELECTOR ACCORDION MODULE */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <ShieldCheck size={16} color="var(--accent-blue)" />
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: 0 }}>Trading Partner Certificates</h4>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px', color: '#64748b' }}>Active Public Verification Key:</label>
                  <select className="form-select" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                    {loadingCerts ? (
                      <option>Loading secure datastore records...</option>
                    ) : (
                      dbPartners.map(p => p.certificate && (
                        <option key={p.id} selected={p.name === partner.name} value={p.id}>
                          {p.name}_cert.cer (SN: {p.certificate.serial_number})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INPUT VIEWPORT GRID */}
          {activeTab === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Outbound Payload Transmission Buffer</h4>
                <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }}>+ Staging File</button>
              </div>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ paddingBottom: '8px' }}>File Asset Name</th>
                    <th>Size</th>
                    <th>Staged Time</th>
                  </tr>
                </thead>
                <tbody>
                  {mockInputFiles.map((f, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#2563eb', fontWeight: 500 }}>{f.name}</td>
                      <td>{f.size}</td>
                      <td style={{ color: '#64748b' }}>{f.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: OUTPUT VIEWPORT GRID */}
          {activeTab === 'output' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Received Message Receptacle Document Store</h4>
                <input type="text" placeholder="Search filename..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: '4px' }} />
              </div>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ paddingBottom: '8px' }}>Asset Filename</th>
                    <th>Size</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockOutputFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).map((f, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', fontWeight: 500 }}>{f.name}</td>
                      <td>{f.size}</td>
                      <td><span style={{ background: '#f0fdf4', color: 'var(--accent-green)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>{f.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: ADVANCED HANDSHAKE TELEMETRY LOGGER */}
          {activeTab === 'advanced' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 10px 0' }}>Protocol Interconnected Handshake Stream</h4>
              <pre style={{
                background: '#0f172a', color: '#f8fafc', padding: '12px', borderRadius: '4px',
                fontSize: '11px', fontFamily: 'monospace', overflow: 'auto', maxHeight: '440px', whiteSpace: 'pre-wrap'
              }}>
                {`[2026-05-18T10:04:11.206Z] [Info] Handshake runtime tracking initialized.\n[2026-05-18T10:04:11.231Z] [SSLStatus] Negotiated security layer parameters: Protocol TLSv1.2\n[2026-05-18T10:04:11.241Z] [Info] Cipher suite alignment verified successfully: AES-GCM-SHA256\n[2026-05-18T10:04:11.955Z] [Info] Connection pipe closed. Handshake sequence status code: [0] Successful Validation`}
              </pre>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

const Tab = ({ id, icon, label, active, set }) => (
  <div
    onClick={() => set(id)}
    style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px',
      fontSize: '12px', fontWeight: active === id ? 600 : 500, cursor: 'pointer',
      color: active === id ? 'var(--accent-blue)' : '#475569',
      background: active === id ? '#eff6ff' : 'transparent',
      borderLeft: `3px solid ${active === id ? 'var(--accent-blue)' : 'transparent'}`,
      transition: 'all 0.15s ease'
    }}
  >
    {icon}
    <span>{label}</span>
  </div>
);

export default AdvancedSettingsDrawer;