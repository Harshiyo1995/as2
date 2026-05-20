import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Shield, ShieldAlert, Plus, RefreshCw, Trash2 } from 'lucide-react';
import AddPartnerModal from './AddPartnerModal';
import CertificateDetailsModal from './CertificateDetailsModal';

const PartnerDirectory = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);

  const fetchPartners = () => {
    setLoading(true);
    fetch('http://localhost:8080/api/partners')
      .then(res => res.json())
      .then(data => {
        setPartners(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handlePartnerAdded = () => {
    setIsModalOpen(false);
    fetchPartners();
  };

  const handleDeletePartner = (id) => {
    fetch(`http://localhost:8080/api/partners/${id}`, {
      method: 'DELETE',
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          fetchPartners();
        } else {
          alert(`Failed to delete partner: ${result.message}`);
        }
      })
      .catch(err => {
        console.error("Failed to delete partner", err);
        alert("An error occurred while deleting the partner.");
      });
  };

  const getStatusBadgeStyle = (isValid, hasCert) => {
    if (!hasCert) {
      return {
        backgroundColor: '#fffbeb',
        color: '#d97706',
        border: '1px solid #fde68a',
      };
    }
    return isValid ? {
      backgroundColor: '#ecfdf5',
      color: '#059669',
      border: '1px solid #a7f3d0',
    } : {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fecaca',
    };
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.header}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <h2 style={styles.headerTitle}>
            Trading Partners
          </h2>
          <span style={styles.badgeCount}>
            {partners.length} registered
          </span>
        </div>
        <div style={styles.actionBar}>
          <button 
            className="btn btn-secondary" 
            onClick={fetchPartners}
            style={styles.btnSecondary}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsModalOpen(true)}
            style={styles.btnPrimary}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
          >
            <Plus size={16} /> Add Partner
          </button>
        </div>
      </div>

      {/* Grid of partner cards */}
      <div style={styles.gridContainer}>
        {loading ? (
          <p style={{ color: '#64748b', fontWeight: '500' }}>Loading partners...</p>
        ) : partners.length === 0 ? (
          <div style={{
            padding: '64px', textAlign: 'center', color: '#64748b',
            background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <Shield size={40} color="#94a3b8" style={{ marginBottom: '16px' }} />
            <p style={{ fontWeight: 700, marginBottom: '8px', color: '#0f172a', fontSize: '16px' }}>No trading partners yet</p>
            <p style={{ fontSize: '13px', marginBottom: '24px', maxWidth: '380px', margin: '0 auto 24px auto', lineHeight: '1.5' }}>
              Add your Veeva or FDA partner to enable S/MIME encryption and certificate-based routing.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => setIsModalOpen(true)}
              style={{ ...styles.btnPrimary, margin: '0 auto' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
            >
              <Plus size={16} /> Add Your First Partner
            </button>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table} className="animate-fade-in">
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '36px' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></th>
                  <th style={styles.th}>Partner Name</th>
                  <th style={styles.th}>AS2 ID</th>
                  <th style={styles.th}>Endpoint URL</th>
                  <th style={styles.th}>Certificate</th>
                  <th style={styles.th}>Expires</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, width: '80px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map(partner => {
                  const cert = partner.certificate;
                  const isValid = cert ? new Date(cert.valid_to) > new Date() : false;

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
                      <td style={{ ...styles.td, fontWeight: 700, color: '#2563eb' }}>{partner.name}</td>
                      <td style={{ ...styles.td, fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace', fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>{partner.as2_id}</td>
                      <td style={{ ...styles.td, fontSize: '12px', color: '#475569', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={partner.url}>
                        {partner.url || '—'}
                      </td>
                      <td style={{ ...styles.td, fontSize: '12px' }}>
                        {cert ? (
                          <span 
                            onClick={(e) => { e.stopPropagation(); setSelectedCert(cert); }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              fontWeight: '600', 
                              color: '#2563eb',
                              cursor: 'pointer' 
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                          >
                            {isValid ? <Shield size={14} color="#10b981" /> : <ShieldAlert size={14} color="#ef4444" />}
                            {cert.alias}
                          </span>
                        ) : (
                          <span style={{ color: '#d97706', fontWeight: '600' }}>No certificate</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, fontSize: '12px', fontWeight: '500', color: cert && !isValid ? '#ef4444' : '#64748b' }}>
                        {cert ? format(new Date(cert.valid_to), 'MMM dd, yyyy') : '—'}
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.statusBadge, ...getStatusBadgeStyle(isValid, !!cert) }}>
                          <span style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: !cert ? '#f59e0b' : isValid ? '#10b981' : '#ef4444'
                          }}></span>
                          {cert ? (isValid ? 'Active' : 'Expired') : 'Unconfigured'}
                        </span>
                      </td>
                      <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete partner "${partner.name}"?`)) {
                                handleDeletePartner(partner.id);
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

      {isModalOpen && (
        <AddPartnerModal
          onClose={() => setIsModalOpen(false)}
          onPartnerAdded={handlePartnerAdded}
        />
      )}

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
  badgeCount: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    padding: '4px 10px',
    borderRadius: '20px',
    marginLeft: '10px',
  },
  actionBar: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  btnPrimary: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    border: '1px solid transparent',
    color: '#ffffff',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
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
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
  }
};

export default PartnerDirectory;
