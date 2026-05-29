import React, { useState } from 'react';
import { X, Shield, Calendar, ShieldCheck, ShieldAlert, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';

const CertificateDetailsModal = ({ cert, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!cert) return null;

  const isValid = new Date(cert.valid_to) > new Date();

  const handleCopyPem = () => {
    if (!cert.pem_data) return;
    navigator.clipboard.writeText(cert.pem_data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Improved parser for better UI display
  const parseDn = (dnString) => {
    if (!dnString) return [];
    return dnString.split(',').map(part => {
      const equalsIdx = part.indexOf('=');
      if (equalsIdx === -1) return { key: 'CN', value: part.trim() };
      return {
        key: part.substring(0, equalsIdx).trim(),
        value: part.substring(equalsIdx + 1).trim()
      };
    });
  };

  const subjectFields = parseDn(cert.subject_dn);
  const issuerFields = parseDn(cert.issuer_dn);

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              backgroundColor: isValid ? '#ecfdf5' : '#fef2f2',
              padding: '10px',
              borderRadius: '10px',
              border: `1px solid ${isValid ? '#a7f3d0' : '#fecaca'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Shield size={24} color={isValid ? '#10b981' : '#ef4444'} />
            </div>
            <div>
              <h3 style={styles.title}>Certificate Properties</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>Alias: <strong style={{color: '#334155'}}>{cert.alias}</strong></p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={styles.content}>
          
          {/* Validity Callout */}
          <div style={{
            ...styles.callout,
            backgroundColor: isValid ? '#f0fdf4' : '#fef2f2',
            borderColor: isValid ? '#bbf7d0' : '#fee2e2',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isValid ? (
                <>
                  <ShieldCheck size={18} color="#15803d" />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#15803d' }}>
                    This certificate is active and cryptographically valid.
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert size={18} color="#b91c1c" />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#b91c1c' }}>
                    This certificate has expired. S/MIME operations will fail.
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Timeline Grid */}
          <div style={styles.infoGrid}>
            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>Valid From</div>
              <div style={styles.infoValue}>
                <Calendar size={14} style={{ marginRight: '8px', color: '#64748b' }} />
                {format(new Date(cert.valid_from), 'MMM dd, yyyy HH:mm:ss')}
              </div>
            </div>
            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>Valid Until (Expiration)</div>
              <div style={{ ...styles.infoValue, color: isValid ? '#0f172a' : '#ef4444' }}>
                <Calendar size={14} style={{ marginRight: '8px', color: isValid ? '#64748b' : '#ef4444' }} />
                {format(new Date(cert.valid_to), 'MMM dd, yyyy HH:mm:ss')}
              </div>
            </div>
          </div>

          {/* Identifiers */}
          <div style={styles.detailsList}>
            <div style={styles.detailRow}>
              <div style={styles.detailLabel}>Serial Number</div>
              <div style={styles.detailValueMonospace}>{cert.serial_number}</div>
            </div>
            <div style={styles.detailRow}>
              <div style={styles.detailLabel}>SHA-1 Thumbprint</div>
              <div style={styles.detailValueMonospace}>{cert.thumbprint}</div>
            </div>
          </div>

          {/* Distinguished Names (Full Width Property Grids) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Subject */}
            <div>
              <div style={styles.sectionTitle}>Issued To (Subject)</div>
              <div style={styles.dnCard}>
                {subjectFields.length > 0 ? (
                  <table style={styles.dnTable}>
                    <tbody>
                      {subjectFields.map((field, idx) => (
                        <tr key={idx} style={styles.dnTableRow}>
                          <td style={styles.dnKey}>{field.key}</td>
                          <td style={styles.dnVal}>{field.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span style={{ fontSize: '13px', color: '#94a3b8', padding: '12px' }}>No subject properties provided.</span>
                )}
              </div>
            </div>

            {/* Issuer */}
            <div>
              <div style={styles.sectionTitle}>Issued By (Issuer)</div>
              <div style={styles.dnCard}>
                {issuerFields.length > 0 ? (
                  <table style={styles.dnTable}>
                    <tbody>
                      {issuerFields.map((field, idx) => (
                        <tr key={idx} style={styles.dnTableRow}>
                          <td style={styles.dnKey}>{field.key}</td>
                          <td style={styles.dnVal}>{field.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span style={{ fontSize: '13px', color: '#94a3b8', padding: '12px' }}>No issuer properties provided.</span>
                )}
              </div>
            </div>

          </div>

          {/* PEM Data block */}
          {cert.pem_data && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={styles.sectionTitle}>PEM Encoded Certificate</div>
                <button onClick={handleCopyPem} style={styles.copyBtn}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy PEM'}
                </button>
              </div>
              <pre style={styles.pemBlock}>{cert.pem_data.trim()}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  modal: {
    background: '#ffffff',
    width: '720px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    animation: 'scaleUp 0.2s ease-out',
    overflow: 'hidden',
  },
  header: {
    padding: '24px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
  },
  closeBtn: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    color: '#64748b',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    backgroundColor: '#f8fafc', // Slight off-white background for the body
  },
  callout: {
    padding: '16px',
    borderRadius: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  infoBox: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
  },
  infoLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '8px',
  },
  infoValue: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
  },
  dnCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
  },
  dnTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  dnTableRow: {
    borderBottom: '1px solid #f1f5f9',
  },
  dnKey: {
    width: '30%',
    padding: '12px 16px',
    fontWeight: '700',
    color: '#64748b',
    fontSize: '12px',
    backgroundColor: '#f8fafc',
    borderRight: '1px solid #f1f5f9',
  },
  dnVal: {
    padding: '12px 16px',
    fontWeight: '500',
    color: '#334155',
    fontSize: '13px',
    wordBreak: 'break-word',
  },
  detailsList: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #f1f5f9',
  },
  detailLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
  },
  detailValueMonospace: {
    fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
    fontSize: '12px',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    padding: '4px 12px',
    borderRadius: '6px',
    fontWeight: '500',
    letterSpacing: '0.5px'
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '6px',
    transition: 'all 0.15s ease',
  },
  pemBlock: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    padding: '16px',
    borderRadius: '10px',
    fontSize: '12px',
    fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
    overflowX: 'auto',
    margin: 0,
    maxHeight: '200px',
    overflowY: 'auto',
    lineHeight: '1.6',
    border: '1px solid #1e293b',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
  }
};

export default CertificateDetailsModal;