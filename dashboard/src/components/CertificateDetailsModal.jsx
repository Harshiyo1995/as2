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

  // Helper to parse subject/issuer string into structured rows
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: isValid ? '#ecfdf5' : '#fef2f2',
              padding: '8px',
              borderRadius: '8px',
              border: `1px solid ${isValid ? '#a7f3d0' : '#fecaca'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Shield size={20} color={isValid ? '#10b981' : '#ef4444'} />
            </div>
            <div>
              <h3 style={styles.title}>Certificate Details</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Alias: {cert.alias}</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Validity Callout */}
          <div style={{
            ...styles.callout,
            backgroundColor: isValid ? '#f0fdf4' : '#fef2f2',
            borderColor: isValid ? '#bbf7d0' : '#fee2e2',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isValid ? (
                <>
                  <ShieldCheck size={16} color="#15803d" />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#15803d' }}>
                    This certificate is active and cryptographically valid.
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} color="#b91c1c" />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#b91c1c' }}>
                    This certificate has expired. S/MIME operations will fail.
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={styles.sectionTitle}>Validity Timeline</div>
          <div style={styles.infoGrid}>
            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>Valid From</div>
              <div style={styles.infoValue}>
                <Calendar size={12} style={{ marginRight: '6px', color: '#64748b' }} />
                {format(new Date(cert.valid_from), 'MMM dd, yyyy HH:mm:ss')}
              </div>
            </div>
            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>Valid Until (Expiration)</div>
              <div style={{ ...styles.infoValue, color: isValid ? '#0f172a' : '#ef4444', fontWeight: isValid ? '500' : '600' }}>
                <Calendar size={12} style={{ marginRight: '6px', color: isValid ? '#64748b' : '#ef4444' }} />
                {format(new Date(cert.valid_to), 'MMM dd, yyyy HH:mm:ss')}
              </div>
            </div>
          </div>

          {/* Subject & Issuer Metadata */}
          <div style={styles.infoGrid}>
            <div>
              <div style={styles.sectionTitle}>Subject DN</div>
              <div style={styles.dnCard}>
                {subjectFields.length > 0 ? (
                  subjectFields.map((field, idx) => (
                    <div key={idx} style={styles.dnRow}>
                      <span style={styles.dnKey}>{field.key}</span>
                      <span style={styles.dnVal}>{field.value}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>None provided</span>
                )}
              </div>
            </div>
            <div>
              <div style={styles.sectionTitle}>Issuer DN</div>
              <div style={styles.dnCard}>
                {issuerFields.length > 0 ? (
                  issuerFields.map((field, idx) => (
                    <div key={idx} style={styles.dnRow}>
                      <span style={styles.dnKey}>{field.key}</span>
                      <span style={styles.dnVal}>{field.value}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>None provided</span>
                )}
              </div>
            </div>
          </div>

          {/* Cryptographic Thumbprints */}
          <div style={styles.sectionTitle}>Identifiers</div>
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

          {/* PEM Data block */}
          {cert.pem_data && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={styles.sectionTitle}>PEM Public Certificate String</div>
                <button onClick={handleCopyPem} style={styles.copyBtn}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copy PEM' : 'Copy PEM'}
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
    background: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  modal: {
    background: '#ffffff',
    width: '680px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    animation: 'scaleUp 0.15s ease-out',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  callout: {
    padding: '12px 16px',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '12px 16px',
  },
  infoLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '6px',
  },
  infoValue: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '600',
    color: '#334155',
  },
  dnCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '12px 16px',
    marginTop: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '140px',
    overflowY: 'auto',
  },
  dnRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '4px',
  },
  dnKey: {
    fontWeight: '700',
    color: '#64748b',
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  dnVal: {
    fontWeight: '500',
    color: '#334155',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  detailsList: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px',
  },
  detailLabel: {
    fontWeight: '600',
    color: '#64748b',
  },
  detailValueMonospace: {
    fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
    fontSize: '11px',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: '500',
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#2563eb',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
  },
  pemBlock: {
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    padding: '14px',
    borderRadius: '8px',
    fontSize: '11px',
    fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
    overflow: 'auto',
    margin: 0,
    whiteSpace: 'pre-wrap',
    maxHeight: '160px',
    lineHeight: '1.5',
    border: '1px solid #1e293b',
  }
};

export default CertificateDetailsModal;
