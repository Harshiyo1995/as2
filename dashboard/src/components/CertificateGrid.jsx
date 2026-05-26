import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Upload, Trash2, Shield, Search, KeyRound, Server, X, Download } from 'lucide-react';
import * as forge from 'node-forge/dist/forge.min.js';
import CertificateDetailsModal from './CertificateDetailsModal';

const CertificateGrid = () => {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState(null);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const fetchCerts = () => {
    fetch('http://localhost:8080/api/partners/certs')
      .then(res => res.json())
      .then(data => {
        setCerts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch certificates", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCerts();
  }, []);

  const handleDeleteCertificate = (certId) => {
    fetch(`http://localhost:8080/api/partners/certs/${certId}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(result => {
        if (result.success) fetchCerts();
        else alert(`Failed to delete certificate: ${result.message}`);
      });
  };

  const handleUploadPublicCertClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const partnerName = prompt("Enter the Trading Partner Name (AS2 ID) to associate with this PUBLIC certificate:");
    if (!partnerName) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const pemText = event.target.result;
        const cert = forge.pki.certificateFromPem(pemText);
        const formatDn = (attrs) => attrs.map(a => `${a.name || a.type}=${a.value}`).join(', ');

        const payload = {
          name: partnerName,
          as2_id: partnerName,
          url: 'http://localhost:8080/as2/mdn',
          certificate: {
            alias: `${partnerName.toLowerCase()}_public_cert`,
            serial_number: cert.serialNumber,
            subject_dn: formatDn(cert.subject.attributes),
            issuer_dn: formatDn(cert.issuer.attributes),
            valid_from: cert.validity.notBefore,
            valid_to: cert.validity.notAfter,
            thumbprint: forge.md.sha1.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()).digest().toHex().toUpperCase(),
            pem_data: pemText,
            is_private: false
          }
        };

        const res = await fetch('http://localhost:8080/api/partners/upload-cert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) fetchCerts();
        else alert(`Database save error: ${await res.text()}`);
      } catch (err) {
        alert(`Cryptographic Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={styles.container}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".cer,.pem,.crt" />

      <div style={styles.header}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <h2 style={styles.headerTitle}>Certificate Store</h2>
        </div>
        <div style={styles.actionBar}>
          <button className="btn btn-secondary" onClick={handleUploadPublicCertClick} style={styles.btnSecondary}>
            <Upload size={14} /> Upload Public Partner Cert
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsStationModalOpen(true)} 
            style={styles.btnPrimary}
          >
            <KeyRound size={14} /> Add Local Station (Private Key)
          </button>
          
          <div style={styles.searchInputWrapper}>
            <Search size={14} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
            <input type="text" placeholder="Search certificates..." className="form-input" style={styles.searchInput} />
          </div>
        </div>
      </div>

      <div style={styles.gridContainer}>
        {loading ? (
          <p style={{ color: '#64748b', fontWeight: '500' }}>Loading secure certificate store...</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table} className="animate-fade-in">
              <thead>
                <tr>
                  <th style={styles.th}>Name / Alias</th>
                  <th style={styles.th}>Subject DN context</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Expiration Date</th>
                  <th style={styles.th}>Thumbprint Reference</th>
                  <th style={{ ...styles.th, width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {certs.map(cert => (
                  <tr key={cert.id} style={{ background: '#ffffff', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>
                      <div style={styles.certBadge} onClick={() => setSelectedCert(cert)}>
                        {cert.is_private ? <KeyRound size={14} color="#10b981" /> : <Shield size={14} />}
                        {cert.alias}
                      </div>
                    </td>
                    <td style={{ ...styles.td, maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px', fontFamily: 'monospace', color: '#475569' }} title={cert.subject_dn}>
                      {cert.subject_dn}
                    </td>
                    <td style={styles.td}>
                      <span style={cert.is_private ? styles.badgePrivate : styles.badgePublic}>
                        {cert.is_private ? 'Local Gateway (Private)' : 'Trading Partner (Public)'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontSize: '12px', color: '#475569' }}>{format(new Date(cert.valid_to), 'MM/dd/yyyy HH:mm:ss')}</td>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>{cert.thumbprint.substring(0, 16)}...</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          title="Export Public .cer"
                          onClick={(e) => {
                            e.stopPropagation();
                            const blob = new Blob([cert.pem_data], { type: 'text/plain' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${cert.alias}_public.cer`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          }}
                          style={{ ...styles.deleteBtn, color: '#2563eb' }}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          title="Delete Certificate"
                          onClick={(e) => {
                            e.stopPropagation();
                            if(window.confirm(`Delete certificate "${cert.alias}"?`)) handleDeleteCertificate(cert.id);
                          }}
                          style={styles.deleteBtn}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCert && <CertificateDetailsModal cert={selectedCert} onClose={() => setSelectedCert(null)} />}
      
      {isStationModalOpen && (
        <AddStationModal 
          onClose={() => setIsStationModalOpen(false)} 
          onSuccess={() => { setIsStationModalOpen(false); fetchCerts(); }} 
        />
      )}
    </div>
  );
};

// ─── NEW INLINE COMPONENT: LOCAL STATION PRIVATE KEY IMPORTER ────────
const AddStationModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ as2_id: '', certificate_pem: '', private_key_pem: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/partners/upload-private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) onSuccess();
      else alert(`Failed to register station: ${await res.text()}`);
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={styles.backdrop}>
      <div style={{...styles.modal, width: '560px', padding: 0}}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.headerTitle}>Register Local Station Identity</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Configure your gateway's AS2 ID and decryption keys.</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={styles.formLabel}>Your Local AS2-To ID (e.g. YOUR_COMPANY_US)</label>
            <input required type="text" className="form-input" style={styles.formInput} value={formData.as2_id} onChange={e => setFormData({...formData, as2_id: e.target.value})} placeholder="Strict case-sensitive identifier" />
          </div>
          <div>
            <label style={styles.formLabel}>Public Certificate (.cer or .pem text)</label>
            <textarea required rows={4} className="form-input" style={styles.textArea} value={formData.certificate_pem} onChange={e => setFormData({...formData, certificate_pem: e.target.value})} placeholder="-----BEGIN CERTIFICATE-----..." />
          </div>
          <div>
            <label style={styles.formLabel}>Private Decryption Key (.key or .pem text)</label>
            <textarea required rows={4} className="form-input" style={styles.textArea} value={formData.private_key_pem} onChange={e => setFormData({...formData, private_key_pem: e.target.value})} placeholder="-----BEGIN RSA PRIVATE KEY-----..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={styles.btnSecondary}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={styles.btnPrimary} disabled={loading}>{loading ? 'Saving...' : 'Register Station'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8fafc' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' },
  headerTitle: { fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 },
  actionBar: { display: 'flex', gap: '12px', alignItems: 'center' },
  btnPrimary: { display: 'flex', gap: '6px', alignItems: 'center', backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  btnSecondary: { display: 'flex', gap: '6px', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#334155', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  searchInputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { width: '250px', padding: '8px 12px 8px 36px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' },
  gridContainer: { padding: '24px', flex: 1, overflowY: 'auto' },
  tableWrapper: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { backgroundColor: '#f8fafc', color: '#475569', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', padding: '14px 16px', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '14px 16px', color: '#334155', fontSize: '13px', verticalAlign: 'middle' },
  certBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: '#2563eb' },
  badgePublic: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  badgePrivate: { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px', borderRadius: '6px' },
  backdrop: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 },
  modal: { background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' },
  formLabel: { display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' },
  textArea: { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', resize: 'vertical' }
};

export default CertificateGrid;