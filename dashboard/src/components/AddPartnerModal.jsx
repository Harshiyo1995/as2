import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileCheck, AlertCircle } from 'lucide-react';

const AddPartnerModal = ({ onClose, onPartnerAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    as2_id: '',
    url: '',
    certificate_pem: ''
  });
  const [certFile, setCertFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
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
    setError(null);

    try {
      const response = await fetch('http://localhost:8080/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to add partner');
      onPartnerAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Overlay */
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      {/* Dialog — matches light theme */}
      <div style={{
        width: '100%', maxWidth: '560px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Add Trading Partner
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Configure AS2 identity and optional S/MIME certificate
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '12px', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: '4px', color: '#b91c1c'
              }}>
                <AlertCircle size={16} style={{ marginTop: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px' }}>{error}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Partner Name *</label>
                <input
                  required
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Veeva Safety"
                  style={{ background: 'white' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">AS2 ID *</label>
                <input
                  required
                  className="form-input"
                  value={formData.as2_id}
                  onChange={e => setFormData({ ...formData, as2_id: e.target.value })}
                  placeholder="e.g. VEEVA_ESG"
                  style={{ background: 'white' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Endpoint URL *</label>
              <input
                required
                type="url"
                className="form-input"
                value={formData.url}
                onChange={e => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://as2.veeva.com/receive"
                style={{ background: 'white' }}
              />
            </div>

            {/* Certificate File Upload */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">
                Public Certificate <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — .pem, .cer, .crt)</span>
              </label>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current.click()}
                style={{
                  border: `2px dashed ${certFile ? 'var(--accent-green)' : 'var(--border-dark)'}`,
                  borderRadius: '6px',
                  padding: '28px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: certFile ? '#f0fdf4' : '#fafbfc',
                  transition: 'all 0.2s'
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pem,.cer,.crt,.der,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />

                {certFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <FileCheck size={22} color="var(--accent-green)" />
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontWeight: 600, color: 'var(--accent-green)', fontSize: '14px' }}>Certificate loaded</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{certFile}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCertFile(null); setFormData(f => ({ ...f, certificate_pem: '' })); }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <UploadCloud size={28} color="#94a3b8" style={{ marginBottom: '8px' }} />
                    <p style={{ fontWeight: 500, color: 'var(--text-main)', marginBottom: '4px', fontSize: '14px' }}>
                      Click to upload or drag & drop
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Supports .pem, .cer, .crt, .der files from Veeva or FDA
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            background: '#f8fafc'
          }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '120px', justifyContent: 'center' }}>
              {loading ? 'Saving...' : 'Save Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPartnerModal;
