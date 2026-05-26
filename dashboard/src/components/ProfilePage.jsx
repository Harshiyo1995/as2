import React, { useState, useEffect, useRef } from 'react';
import { Shield, KeyRound, Globe, Copy, CheckCircle2, UploadCloud, X, FileCheck, Lock, Edit2, Save } from 'lucide-react';

const ProfilePage = () => {
  const [localStation, setLocalStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Editable URL State (Defaults to localhost, saves to browser storage)
  const [isEditingUrls, setIsEditingUrls] = useState(false);
  const [rxUrl, setRxUrl] = useState(localStorage.getItem('gatewayRxUrl') || 'http://localhost:8080/as2/receive');
  const [mdnUrl, setMdnUrl] = useState(localStorage.getItem('gatewayMdnUrl') || 'http://localhost:8080/as2/mdn');

  const fetchProfile = () => {
    fetch('http://localhost:8080/api/partners/certs')
      .then(res => res.json())
      .then(data => {
        const station = data.find(c => c.is_private === true);
        setLocalStation(station || null);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch profile", err);
        setLoading(false);
      });
  };

  useEffect(() => { fetchProfile(); }, []);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(''), 2000);
  };

  const handleSaveUrls = () => {
    localStorage.setItem('gatewayRxUrl', rxUrl);
    localStorage.setItem('gatewayMdnUrl', mdnUrl);
    setIsEditingUrls(false);
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading AS2 Profile Configuration...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>AS2 Gateway Profile</h2>
        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>Configure your organization's local AS2 identity and public-facing webhook URLs.</p>
      </div>

      <div style={styles.grid}>
        {/* Left Column: Identity & Certs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={styles.card}>
            <div style={styles.cardHeader}><Globe size={18} color="#2563eb" /><h3 style={styles.cardTitle}>Personal ID</h3></div>
            <div style={styles.cardBody}>
              <label style={styles.label}>AS2 Identifier</label>
              <div style={styles.inputReadOnly}>{localStation ? localStation.alias.replace('_local_station', '') : 'Not Configured'}</div>
              <p style={styles.helpText}>This is your official AS2 routing ID. You must provide this to all external trading partners.</p>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}><KeyRound size={18} color="#10b981" /><h3 style={styles.cardTitle}>Private Decryption Certificate</h3></div>
            <div style={styles.cardBody}>
              {localStation ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={styles.label}>Subject DN</label>
                    <div style={{ ...styles.inputReadOnly, fontSize: '11px', fontFamily: 'monospace' }}>{localStation.subject_dn}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={styles.label}>Expiration</label>
                      <div style={styles.inputReadOnly}>{new Date(localStation.valid_to).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <label style={styles.label}>Serial Number</label>
                      <div style={styles.inputReadOnly}>{localStation.serial_number}</div>
                    </div>
                  </div>
                  <p style={styles.helpText}>This private key is used to sign outbound messages and decrypt inbound messages. Never share this with partners.</p>
                </>
              ) : (
                <div style={styles.emptyState}>
                  <UploadCloud size={24} color="#94a3b8" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No Identity Configured</p>
                  <p style={{ margin: '4px 0 16px 0', fontSize: '12px', color: '#64748b' }}>Import a .pfx or .p12 secure vault to establish your gateway.</p>
                  <button onClick={() => setIsModalOpen(true)} style={styles.btnPrimary}>Configure Local Identity</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: URLs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <Globe size={18} color="#8b5cf6" />
              <h3 style={styles.cardTitle}>Application URLs</h3>
              {isEditingUrls ? (
                <button onClick={handleSaveUrls} style={{...styles.iconBtn, color: '#10b981', marginLeft: 'auto'}} title="Save URLs">
                  <Save size={16} />
                </button>
              ) : (
                <button onClick={() => setIsEditingUrls(true)} style={{...styles.iconBtn, marginLeft: 'auto'}} title="Edit URLs">
                  <Edit2 size={16} />
                </button>
              )}
            </div>
            <div style={styles.cardBody}>
              <p style={{...styles.helpText, marginBottom: '16px', color: '#475569'}}>
                Provide these exact endpoints to Veeva Vault or your trading partners so they can route traffic to your gateway.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.label}>Receiving URL (Inbound Payloads)</label>
                {isEditingUrls ? (
                  <input type="text" style={styles.formInput} value={rxUrl} onChange={e => setRxUrl(e.target.value)} />
                ) : (
                  <div style={styles.copyBox}>
                    <span style={styles.urlText}>{rxUrl}</span>
                    <button onClick={() => copyToClipboard(rxUrl, 'rx')} style={styles.copyBtn}>
                      {copiedLink === 'rx' ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
                <p style={styles.helpText}>The URL at which this gateway listens for incoming AS2 messages.</p>
              </div>

              <div>
                <label style={styles.label}>Asynchronous MDN URL (Receipts)</label>
                {isEditingUrls ? (
                  <input type="text" style={styles.formInput} value={mdnUrl} onChange={e => setMdnUrl(e.target.value)} />
                ) : (
                  <div style={styles.copyBox}>
                    <span style={styles.urlText}>{mdnUrl}</span>
                    <button onClick={() => copyToClipboard(mdnUrl, 'mdn')} style={styles.copyBtn}>
                      {copiedLink === 'mdn' ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
                <p style={styles.helpText}>The URL at which this gateway listens for out-of-band asynchronous delivery receipts.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <AddStationModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => { setIsModalOpen(false); fetchProfile(); }} 
        />
      )}
    </div>
  );
};

// ─── LOCAL STATION PFX IMPORTER MODAL ────────
const AddStationModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ as2_id: '', password: '', pfx_base64: '' });
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      // Strip the Data URL prefix to get raw base64
      const base64Data = evt.target.result.split(',')[1];
      setFormData(f => ({ ...f, pfx_base64: base64Data }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.pfx_base64) throw new Error("Please upload a .pfx or .p12 certificate file.");
      
      const res = await fetch('http://localhost:8080/api/partners/upload-private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) onSuccess();
      else alert(`Failed to register station: ${await res.text()}`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={styles.backdrop}>
      <div style={{...styles.modal, width: '560px', padding: 0}}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Register Local Station Identity</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Upload your secure PKCS#12 vault (.pfx / .p12) to configure the gateway.</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={styles.formLabel}>AS2 Identifier (Your AS2 ID)</label>
            <input required type="text" className="form-input" style={styles.formInput} value={formData.as2_id} onChange={e => setFormData({...formData, as2_id: e.target.value})} placeholder="e.g. COMPANY_US" />
          </div>

          <div>
            <label style={styles.formLabel}>Private Certificate (.pfx / .p12)</label>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pfx,.p12" style={{ display: 'none' }} />
            
            <div onClick={() => fileInputRef.current.click()} style={{ border: `2px dashed ${fileName ? '#10b981' : '#cbd5e1'}`, borderRadius: '6px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: fileName ? '#f0fdf4' : '#f8fafc', transition: 'all 0.2s' }}>
              {fileName ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <FileCheck size={20} color="#10b981" />
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontWeight: 600, color: '#10b981', fontSize: '13px', margin: 0 }}>Vault loaded successfully</p>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{fileName}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <UploadCloud size={24} color="#94a3b8" style={{ marginBottom: '8px' }} />
                  <p style={{ fontWeight: 600, color: '#334155', margin: '0 0 4px 0', fontSize: '13px' }}>Click to upload Keystore</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={styles.formLabel}>Private Certificate Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input required type="password" style={{...styles.formInput, paddingLeft: '36px'}} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Enter keystore password" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={styles.btnSecondary}>Cancel</button>
            <button type="submit" style={styles.btnPrimary} disabled={loading || !formData.pfx_base64}>
              {loading ? 'Decrypting Vault...' : 'Register Station'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '24px', backgroundColor: '#f8fafc', minHeight: '100%' },
  header: { marginBottom: '24px' },
  headerTitle: { fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' },
  card: { backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fdfdfd' },
  cardTitle: { fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 },
  cardBody: { padding: '20px' },
  label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' },
  inputReadOnly: { width: '100%', padding: '10px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', color: '#334155', fontWeight: '500' },
  helpText: { margin: '6px 0 0 0', fontSize: '11px', color: '#64748b', lineHeight: '1.4' },
  emptyState: { padding: '30px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  copyBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px 12px' },
  urlText: { fontSize: '12px', color: '#1d4ed8', fontFamily: 'monospace', fontWeight: '500' },
  copyBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px' },
  btnPrimary: { display: 'inline-flex', gap: '6px', alignItems: 'center', backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  btnSecondary: { display: 'inline-flex', gap: '6px', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#334155', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  backdrop: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 },
  modal: { background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' },
  modalTitle: { fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' },
  formLabel: { display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' },
  textArea: { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', resize: 'vertical' }
};

export default ProfilePage;