import React, { useState, useEffect } from 'react';
import { Send, CheckCircle, XCircle, Clock, RefreshCw, Shield } from 'lucide-react';
import * as forge from 'node-forge/dist/forge.min.js';

const VeevaTestPanel = () => {
  const [partners, setPartners] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(true);
  const [selectedCertId, setSelectedCertId] = useState('');

  const [form, setForm] = useState({
    as2From: 'connectionvault1021',
    as2To: 'TestAS2',
    messageId: '',
    subject: 'FDA Submission Test',
    payload: 'This is a dummy AS2 payload for Veeva Gateway testing.',
    requestMdn: true,
    asyncMdn: false,
    mdnUrl: 'http://localhost:8080/as2/mdn',
    simulateEncryption: false,
  });

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  // Fetch certificate profiles dynamically from the relational partner entity repository
  useEffect(() => {
    fetch('http://localhost:8080/api/partners')
      .then(res => res.json())
      .then(data => {
        // Filter out profiles lacking cryptographic structures
        const filtered = data.filter(p => p.certificate);
        setPartners(filtered);
        if (filtered.length > 0) {
          setSelectedCertId(filtered[0].id);
        }
        setLoadingCerts(false);
      })
      .catch(err => {
        console.error("Failed to sync system partner certificates", err);
        setLoadingCerts(false);
      });
  }, []);

  const regenerateTrackingId = () => {
    setForm(prev => ({
      ...prev,
      messageId: `<test-msg-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}@veeva>`
    }));
  };

  useEffect(() => {
    regenerateTrackingId();
  }, []);

  const sendTest = async () => {
    const msgId = form.messageId || `<test-msg-${Date.now()}@veeva>`;
    setResult({ status: 'loading' });

    const headers = {
      'AS2-From': form.as2From,
      'AS2-To': form.as2To,
      'Message-ID': msgId,
      'Subject': form.subject,
    };

    if (form.requestMdn) {
      if (form.asyncMdn) {
        headers['Disposition-Notification-To'] = form.mdnUrl;
        headers['Receipt-Delivery-Option'] = form.mdnUrl;
      } else {
        headers['Disposition-Notification-To'] = form.as2From;
      }
    }

    let finalPayloadBlob;

    if (form.simulateEncryption === true) {
      try {
        const targetPartnerRow = partners.find(p => p.id === selectedCertId);
        const certObject = targetPartnerRow?.certificate;

        // FIXED: Added pem_data at the top of the lookup chain to match your exact database schema
        const pemText = certObject?.pem_data ||
          certObject?.public_pem ||
          certObject?.pem ||
          certObject?.content ||
          certObject?.certificate ||
          certObject?.certificate_body;

        // DIAGNOSTIC GUARD: If no PEM text field matches, print out the actual DB keys to the UI
        if (!pemText) {
          const discoveredKeys = certObject
            ? Object.keys(certObject).join(', ')
            : 'Certificate sub-object is missing or null';

          throw new Error(
            `Missing text layout string. Discovered keys inside your 'certificate' table row: [${discoveredKeys}]. ` +
            `Please update the frontend variable to target your exact database column.`
          );
        }

        // Load the discovered string into the cryptographic forge engine
        const cert = forge.pki.certificateFromPem(pemText);
        const p7 = forge.pkcs7.createEnvelopedData();
        p7.addRecipient(cert);

        p7.content = forge.util.createBuffer(form.payload, 'utf8');
        p7.encrypt();

        const derBytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
        const binaryBuffer = new Uint8Array(derBytes.length);
        for (let i = 0; i < derBytes.length; i++) {
          binaryBuffer[i] = derBytes.charCodeAt(i) & 0xff;
        }

        headers['Content-Type'] = 'application/pkcs7-mime; smime-type=enveloped-data';
        finalPayloadBlob = new Blob([binaryBuffer], { type: 'application/pkcs7-mime' });

        console.log(`[AS2 Tester] Crypt-envelope compiled using certificate linked to profile: ${targetPartnerRow.name}`);
      } catch (cryptoErr) {
        console.error("Encryption runtime crash:", cryptoErr);
        setResult({
          status: 'error',
          code: 0,
          body: `Cryptographic Core Panic: ${cryptoErr.message}`,
          time: 0,
          messageId: msgId,
          ts: new Date().toLocaleTimeString()
        });
        return;
      }
    } else {
      headers['Content-Type'] = 'text/plain';
      finalPayloadBlob = new Blob([form.payload], { type: 'text/plain' });
    }

    const start = Date.now();
    try {
      const res = await fetch('http://localhost:8080/as2/receive', { method: 'POST', headers, body: finalPayloadBlob });
      const elapsed = Date.now() - start;
      const body = await res.text();

      const r = { status: res.ok ? 'success' : 'error', code: res.status, body: body || '(empty processing ack payload returned)', time: elapsed, messageId: msgId, ts: new Date().toLocaleTimeString() };
      setResult(r);
      setHistory(h => [r, ...h].slice(0, 10));
      regenerateTrackingId();
    } catch (err) {
      const r = { status: 'error', code: 0, body: err.message, time: Date.now() - start, messageId: msgId, ts: new Date().toLocaleTimeString() };
      setResult(r);
      setHistory(h => [r, ...h].slice(0, 10));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-toolbar">
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Veeva AS2 Gateway Tester</h2>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Simulate live secure trading payloads over dynamic cryptographic configurations</span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Input Configuration Column panel */}
        <div style={{ width: '420px', borderRight: '1px solid var(--border-color)', padding: '24px', overflowY: 'auto', background: 'var(--bg-panel)' }}>

          <div style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(37, 99, 235, 0.15)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: form.simulateEncryption ? '12px' : '0' }}>
              <input type="checkbox" id="simulateEncryption" checked={form.simulateEncryption} onChange={e => setForm({ ...form, simulateEncryption: e.target.checked })} />
              <label htmlFor="simulateEncryption" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--accent-blue)' }}>
                Enable AS2 Payload Encryption (PKCS7 DER)
              </label>
            </div>

            {form.simulateEncryption && (
              <div className="form-group animate-fade-in" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                  <Shield size={12} /> Targeting Encryption Key Certificate:
                </label>
                <select
                  className="form-select"
                  value={selectedCertId}
                  onChange={e => setSelectedCertId(e.target.value)}
                  style={{ fontSize: '12px', background: '#ffffff', fontFamily: 'monospace' }}
                >
                  {loadingCerts ? (
                    <option>Polling database validation metrics...</option>
                  ) : (
                    partners.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}_cert.cer (SN: {p.certificate.serial_number})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '14px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>AS2 Core Transport Headers</h3>

          <div className="form-group"><label className="form-label">AS2-From</label><input className="form-input" value={form.as2From} onChange={e => setForm({ ...form, as2From: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">AS2-To</label><input className="form-input" value={form.as2To} onChange={e => setForm({ ...form, as2To: e.target.value })} /></div>

          <div className="form-group">
            <label className="form-label">Message-ID</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="form-input" value={form.messageId} onChange={e => setForm({ ...form, messageId: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
              <button onClick={regenerateTrackingId} className="btn btn-secondary" style={{ padding: '0 10px', minWidth: '38px' }} type="button"><RefreshCw size={14} /></button>
            </div>
          </div>

          <div className="form-group"><label className="form-label">Subject</label><input className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '20px 0' }} />
          <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '14px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Receipt Options</h3>

          <div className="checkbox-group" style={{ marginBottom: '12px' }}>
            <input type="checkbox" id="requestMdn" checked={form.requestMdn} onChange={e => setForm({ ...form, requestMdn: e.target.checked })} />
            <label htmlFor="requestMdn" style={{ fontSize: '13px', cursor: 'pointer' }}>Request MDN Transmit Confirmation</label>
          </div>

          {form.requestMdn && (
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', background: '#ffffff', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}><input type="radio" name="mdntype" checked={!form.asyncMdn} onChange={() => setForm({ ...form, asyncMdn: false })} /> Synchronous</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}><input type="radio" name="mdntype" checked={form.asyncMdn} onChange={() => setForm({ ...form, asyncMdn: true })} /> Asynchronous</label>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">XML Data Payload</label>
            <textarea className="form-input" rows={5} value={form.payload} onChange={e => setForm({ ...form, payload: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }} />
          </div>

          <button onClick={sendTest} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px', fontWeight: 600 }}>
            <Send size={14} style={{ marginRight: '4px' }} /> Dispatch AS2 Payload Track
          </button>
        </div>

        {/* Right Output Logging Stream Columns */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Server Return Pipeline</h3>
            {!result && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Awaiting pipeline execution sequence click...</p>}
            {result?.status === 'loading' && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-blue)', fontSize: '13px' }}><Clock size={16} /> Parsing streams over active network socket parameters...</div>}
            {result && result.status !== 'loading' && (
              <div style={{ animation: 'fadeIn 0.15s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  {result.status === 'success' ? <CheckCircle size={18} color="var(--accent-green)" /> : <XCircle size={18} color="var(--accent-red)" />}
                  <span style={{ fontWeight: 600, fontSize: '13px', color: result.status === 'success' ? 'var(--accent-green)' : 'var(--accent-red)' }}>HTTP {result.code} — Handshake Processed in {result.time}ms</span>
                </div>
                <pre style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '12px', fontSize: '11px', fontFamily: 'monospace', overflowY: 'auto', maxHeight: '140px', whiteSpace: 'pre-wrap' }}>{result.body}</pre>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Panel Execution History</h3>
            {history.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Zero local executions logged on this session window.</p>}
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', marginBottom: '8px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', borderLeft: `3px solid ${h.status === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
                <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{h.messageId}</p></div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HTTP {h.code} · {h.time}ms · {h.ts}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default VeevaTestPanel;