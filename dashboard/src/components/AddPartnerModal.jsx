import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileCheck, Shield, Settings, Activity } from 'lucide-react';
import * as forge from 'node-forge/dist/forge.min.js';

const AddPartnerModal = ({ onClose, onPartnerAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    as2_id: '',
    url: '',
    sign_outbound: true,
    encrypt_outbound: true,
    encryption_algorithm: '3DES',
    signature_algorithm: 'SHA-256',
    request_mdn: true,
    mdn_delivery_mode: 'SYNC',
    mdn_url: 'http://localhost:8080/as2/mdn',
    connection_timeout: 60,
    certificate_pem: ''
  });
  
  const [certFile, setCertFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCertFile(file.name);
      setFormData(f => ({ ...f, certificate_pem: evt.target.result }));
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.certificate_pem) throw new Error("A Public Certificate is required to create a trading partner.");

      const certObj = forge.pki.certificateFromPem(formData.certificate_pem);
      const formatDn = (attrs) => attrs.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');

      const payload = {
        ...formData,
        certificate: {
          alias: `${formData.as2_id}_public_cert`,
          serial_number: certObj.serialNumber,
          subject_dn: formatDn(certObj.subject.attributes),
          issuer_dn: formatDn(certObj.issuer.attributes),
          valid_from: certObj.validity.notBefore,
          valid_to: certObj.validity.notAfter,
          thumbprint: forge.md.sha1.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes()).digest().toHex().toUpperCase(),
          pem_data: formData.certificate_pem
        }
      };

      const res = await fetch('http://localhost:8080/api/partners/upload-cert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) onPartnerAdded();
      else alert(`Error saving connector: ${await res.text()}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: '720px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Configure Trading Partner Connector</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Define routing profiles and strict S/MIME encryption rules for this partner.</p>
          </div>
          <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', cursor: 'pointer', color: '#475569', padding: '6px', borderRadius: '50%' }}><X size={16} /></button>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <form id="partner-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Identity Block */}
            <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#2563eb' }}><Activity size={18} /><h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>AS2 Identifier Details</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div><label style={styles.label}>Partner Name (Alias)</label><input required className="form-input" style={styles.input} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Veeva Vault Connection" /></div>
                <div><label style={styles.label}>AS2 ID</label><input required className="form-input" style={styles.input} value={formData.as2_id} onChange={e => setFormData({...formData, as2_id: e.target.value})} placeholder="e.g. connectionvault1021" /></div>
              </div>
              <div><label style={styles.label}>Target Receiving URL</label><input required type="url" className="form-input" style={styles.input} value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} placeholder="https://connectionvault1021.gateway.dev.veevavaultsafety.com:4080/api/v1/inbound/transmission" /></div>
            </div>

            {/* Security Block (Mirrors CData Arc Settings) */}
            <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#2563eb' }}><Shield size={18} /><h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>Connection Info & Security</h3></div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <label style={styles.checkbox}><input type="checkbox" checked={formData.sign_outbound} onChange={e => setFormData({...formData, sign_outbound: e.target.checked})} /> Sign Outbound Data</label>
                <label style={styles.checkbox}><input type="checkbox" checked={formData.encrypt_outbound} onChange={e => setFormData({...formData, encrypt_outbound: e.target.checked})} /> Encrypt Outbound Data</label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={styles.label}>Encryption Algorithm</label>
                  <select className="form-select" style={styles.input} value={formData.encryption_algorithm} onChange={e => setFormData({...formData, encryption_algorithm: e.target.value})}>
                    <option value="3DES">Triple DES (3DES)</option>
                    <option value="AES128">AES-128</option>
                    <option value="AES256">AES-256</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Signature Digest</label>
                  <select className="form-select" style={styles.input} value={formData.signature_algorithm} onChange={e => setFormData({...formData, signature_algorithm: e.target.value})}>
                    <option value="SHA-256">SHA-256</option>
                    <option value="SHA-1">SHA-1</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Timeout (sec)</label>
                  <input type="number" className="form-input" style={styles.input} value={formData.connection_timeout} onChange={e => setFormData({...formData, connection_timeout: e.target.value})} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <label style={{...styles.checkbox, marginBottom: '12px'}}><input type="checkbox" checked={formData.request_mdn} onChange={e => setFormData({...formData, request_mdn: e.target.checked})} /> Request MDN Receipt</label>
                {formData.request_mdn && (
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: formData.mdn_delivery_mode === 'ASYNC' ? '12px' : '0' }}>
                      <label style={styles.radio}><input type="radio" checked={formData.mdn_delivery_mode === 'SYNC'} onChange={() => setFormData({...formData, mdn_delivery_mode: 'SYNC'})} /> Synchronous</label>
                      <label style={styles.radio}><input type="radio" checked={formData.mdn_delivery_mode === 'ASYNC'} onChange={() => setFormData({...formData, mdn_delivery_mode: 'ASYNC'})} /> Asynchronous</label>
                    </div>
                    {formData.mdn_delivery_mode === 'ASYNC' && (
                      <div><label style={styles.label}>Async MDN Callback URL</label><input type="url" className="form-input" style={styles.input} value={formData.mdn_url} onChange={e => setFormData({...formData, mdn_url: e.target.value})} /></div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Certificate Upload Block */}
            <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#2563eb' }}><Settings size={18} /><h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>Trading Partner Certificate</h3></div>
              <input ref={fileInputRef} type="file" accept=".pem,.cer,.crt,.der,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />
              
              <div onClick={() => fileInputRef.current.click()} style={{ border: `2px dashed ${certFile ? '#10b981' : '#cbd5e1'}`, borderRadius: '6px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: certFile ? '#f0fdf4' : '#f8fafc', transition: 'all 0.2s' }}>
                {certFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <FileCheck size={22} color="#10b981" />
                    <div style={{ textAlign: 'left' }}><p style={{ fontWeight: 600, color: '#10b981', fontSize: '13px', margin: 0 }}>Certificate loaded</p><p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{certFile}</p></div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setCertFile(null); setFormData(f => ({ ...f, certificate_pem: '' })); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                  </div>
                ) : (
                  <div>
                    <UploadCloud size={28} color="#94a3b8" style={{ marginBottom: '8px' }} />
                    <p style={{ fontWeight: 600, color: '#334155', marginBottom: '4px', fontSize: '13px' }}>Click to upload Partner's Public Certificate</p>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Requires .cer or .pem format (This will be used to encrypt payloads sent to them)</p>
                  </div>
                )}
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancel</button>
          <button type="submit" form="partner-form" disabled={loading} style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'white', minWidth: '130px' }}>
            {loading ? 'Validating...' : 'Save Connector'}
          </button>
        </div>

      </div>
    </div>
  );
};

const styles = {
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' },
  input: { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a' },
  checkbox: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' },
  radio: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: '#475569', cursor: 'pointer' }
};

export default AddPartnerModal;