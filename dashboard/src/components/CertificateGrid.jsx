import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Upload, Plus, Trash2, Shield, Search, CheckCircle } from 'lucide-react';
import * as forge from 'node-forge/dist/forge.min.js';
import CertificateDetailsModal from './CertificateDetailsModal';

const CertificateGrid = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState(null);
  const fileInputRef = useRef(null); // Reference to trigger hidden file selector

  const fetchPartners = () => {
    fetch('http://localhost:8080/api/partners')
      .then(res => res.json())
      .then(data => {
        setPartners(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch partners", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleDeleteCertificate = (certId) => {
    fetch(`http://localhost:8080/api/partners/certs/${certId}`, {
      method: 'DELETE',
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          fetchPartners();
        } else {
          alert(`Failed to delete certificate: ${result.message}`);
        }
      })
      .catch(err => {
        console.error("Failed to delete certificate", err);
        alert("An error occurred while deleting the certificate.");
      });
  };

  // ─── DYNAMIC FILE UPLOAD AND CRYPTO PARSING ENGINE ─────────────────
  const handleUploadClick = () => {
    fileInputRef.current.click(); // Open system file dialog
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Prompt user for the Partner Association Identifier
    const partnerName = prompt("Enter the Trading Partner Name to associate with this certificate (e.g., YOUR_COMPANY3, VEEVA_ESG):");
    if (!partnerName) {
      alert("Upload cancelled: Partner name is mandatory.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const pemText = event.target.result;

        // 2. Parse the public certificate string using node-forge
        const cert = forge.pki.certificateFromPem(pemText);

        // Helper to format DN attributes into standard strings
        const formatDn = (attrs) => attrs.map(a => `${a.name || a.type}=${a.value}`).join(', ');

        // 3. Compile a structured payload matching your database entity columns
        const payload = {
          name: partnerName,
          as2_id: partnerName, // Seeding defaults
          url: 'http://localhost:8080/as2/mdn',
          certificate: {
            alias: `${partnerName.toLowerCase()}_signing_key`,
            serial_number: cert.serialNumber,
            subject_dn: formatDn(cert.subject.attributes),
            issuer_dn: formatDn(cert.issuer.attributes),
            valid_from: cert.validity.notBefore,
            valid_to: cert.validity.notAfter,
            thumbprint: forge.md.sha1.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()).digest().toHex().toUpperCase(),
            pem_data: pemText, // Your target backend string path
            is_private: false
          }
        };

        // 4. Send payload to your backend API
        const res = await fetch('http://localhost:8080/api/partners/upload-cert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          alert(`Certificate for '${partnerName}' successfully parsed and committed to database!`);
          fetchPartners(); // Reload data grid view
        } else {
          const errMsg = await res.text();
          alert(`Database save error: ${errMsg}`);
        }

      } catch (err) {
        console.error("Crypto parsing failure", err);
        alert(`Cryptographic Error: Failed to parse file. Ensure it is a valid X.509 PEM/CER text format.\nDetails: ${err.message}`);
      }
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset file input buffer
  };

  return (
    <div style={styles.container}>
      {/* Hidden Native File Input Anchor */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept=".cer,.pem,.crt"
      />

      {/* Top Toolbar */}
      <div style={styles.header}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Certificate Store
          </h2>
        </div>
        <div style={styles.actionBar}>
          <button 
            className="btn btn-secondary" 
            onClick={handleUploadClick} 
            style={styles.btnSecondary}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <Upload size={14} />
            Upload Certificate
          </button>
          <button 
            className="btn btn-secondary" 
            style={styles.btnSecondary}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <Plus size={14} /> Add Partner
          </button>
          
          <div style={styles.searchInputWrapper}>
            <Search size={14} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
            <input 
              type="text" 
              placeholder="Search certificates..." 
              className="form-input" 
              style={styles.searchInput} 
            />
          </div>
        </div>
      </div>

      {/* Grid Content Container */}
      <div style={styles.gridContainer}>
        {loading ? (
          <p style={{ color: '#64748b', fontWeight: '500' }}>Loading secure certificate store...</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table} className="animate-fade-in">
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '40px' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></th>
                  <th style={styles.th}>Name / Alias</th>
                  <th style={styles.th}>Subject DN context</th>
                  <th style={styles.th}>Serial Number</th>
                  <th style={styles.th}>Expiration Date</th>
                  <th style={styles.th}>Thumbprint Reference</th>
                  <th style={styles.th}>Associated Resource</th>
                  <th style={{ ...styles.th, width: '80px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map(partner => {
                  const cert = partner.certificate;
                  if (!cert) return null;

                  return (
                    <tr 
                      key={partner.id}
                      style={{ 
                        background: '#ffffff', 
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                    >
                      <td style={styles.td} onClick={(e) => e.stopPropagation()}><input type="checkbox" style={{ cursor: 'pointer' }} /></td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>
                        <div 
                          style={styles.certBadge}
                          onClick={() => setSelectedCert(cert)}
                          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          <Shield size={14} /> {partner.name}_cert.cer
                        </div>
                      </td>
                      <td style={{ ...styles.td, maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px', fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace', color: '#475569' }} title={cert.subject_dn}>
                        {cert.subject_dn}
                      </td>
                      <td style={{ ...styles.td, fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace', fontSize: '12px' }}>{cert.serial_number}</td>
                      <td style={{ ...styles.td, fontSize: '12px', color: '#475569' }}>{format(new Date(cert.valid_to), 'MM/dd/yyyy HH:mm:ss')}</td>
                      <td style={{ ...styles.td, fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace', fontSize: '11px', color: '#64748b' }}>
                        {cert.thumbprint.substring(0, 16)}...
                      </td>
                      <td style={styles.td}>
                        <span style={styles.resourceBadge}>
                          {partner.name}
                        </span>
                      </td>
                      <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete certificate for "${partner.name}"?`)) {
                                handleDeleteCertificate(cert.id);
                              }
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '6px',
                              borderRadius: '6px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedCert && (
        <CertificateDetailsModal
          cert={selectedCert}
          onClose={() => setSelectedCert(null)}
        />
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#f8fafc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  actionBar: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  btnSecondary: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    color: '#334155',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  searchInputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    width: '250px',
    padding: '8px 12px 8px 36px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  gridContainer: {
    padding: '24px',
    flex: 1,
    overflowY: 'auto',
  },
  tableWrapper: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '14px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    fontSize: '13px',
    verticalAlign: 'middle',
  },
  certBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: '600',
    color: '#2563eb',
  },
  resourceBadge: {
    display: 'inline-flex',
    background: '#eff6ff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  }
};

export default CertificateGrid;