import React, { useState, useEffect } from 'react';
import { Send, CheckCircle, XCircle, Clock, RefreshCw, Shield, KeyRound } from 'lucide-react';
import * as forge from 'node-forge/dist/forge.min.js';

const VeevaTestPanel = () => {
  const [localStations, setLocalStations] = useState([]);
  const [tradingPartners, setTradingPartners] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(true);
  
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [selectedReceiverId, setSelectedReceiverId] = useState('');

  const [form, setForm] = useState({
    as2From: '',
    as2To: '',
    messageId: '',
    subject: 'Primary Safety Report Test',
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<ichicsr lang="en">
  <ichicsrmessageheader>
    <messagetype>ichicsr</messagetype>
    <messageformatversion>2.1</messageformatversion>
    <messageformatrelease>2.0</messageformatrelease>
    <messagenumb>E2B-R2-TEST-12345</messagenumb>
    <messagesenderidentifier>YOUR_COMPANY1</messagesenderidentifier>
    <messagereceiveridentifier>FDA_ESG</messagereceiveridentifier>
    <messagedateformat>204</messagedateformat>
    <messagedate>20260520130000</messagedate>
  </ichicsrmessageheader>
  <safetyreport>
    <safetyreportversion>1</safetyreportversion>
    <safetyreportid>US-YOURCOMPANY-0001</safetyreportid>
    <primarysourcecountry>US</primarysourcecountry>
    <occurcountry>US</occurcountry>
    <transmissiondateformat>102</transmissiondateformat>
    <transmissiondate>20260520</transmissiondate>
    <reporttype>1</reporttype>
    <serious>1</serious>
    <seriousnessdeath>1</seriousnessdeath>
    <patient>
      <patientinitials>JD</patientinitials>
      <patientsex>1</patientsex>
      <patientweight>75</patientweight>
      <reaction>
        <primarysourcereaction>Severe Headache</primarysourcereaction>
        <reactionmeddrapt>Headache</reactionmeddrapt>
        <reactionoutcome>1</reactionoutcome>
      </reaction>
    </patient>
  </safetyreport>
</ichicsr>`,
    requestMdn: true,
    asyncMdn: false,
    mdnUrl: 'http://localhost:8080/as2/mdn',
    simulateEncryption: true
  });

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  // Fetch all certificates and intelligently categorize them
  useEffect(() => {
    fetch('http://localhost:8080/api/partners/certs')
      .then(res => res.json())
      .then(data => {
        const locals = data.filter(c => c.is_private === true);
        const remotes = data.filter(c => c.is_private === false);
        
        setLocalStations(locals);
        setTradingPartners(remotes);
        
        // Auto-select the first available profiles and populate the headers
        if (locals.length > 0) {
          setSelectedSenderId(locals[0].id);
          setForm(f => ({ ...f, as2From: locals[0].alias }));
        }
        if (remotes.length > 0) {
          setSelectedReceiverId(remotes[0].id);
          setForm(f => ({ ...f, as2To: remotes[0].alias }));
        }
        setLoadingCerts(false);
      })
      .catch(err => {
        console.error("Failed to sync system partner certificates", err);
        setLoadingCerts(false);
      });
  }, []);

  const regenerateTrackingId = () => {
    setForm(prev => ({ ...prev, messageId: `<test-msg-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}@veeva>` }));
  };

  useEffect(() => { regenerateTrackingId(); }, []);

  // Update headers dynamically when dropdowns change
  const handleSenderChange = (e) => {
    const id = e.target.value;
    setSelectedSenderId(id);
    const station = localStations.find(s => s.id === id);
    if (station) setForm(f => ({ ...f, as2From: station.alias }));
  };

  const handleReceiverChange = (e) => {
    const id = e.target.value;
    setSelectedReceiverId(id);
    const partner = tradingPartners.find(p => p.id === id);
    if (partner) setForm(f => ({ ...f, as2To: partner.alias }));
  };

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

    if (form.simulateEncryption) {
      try {
        const senderRow = localStations.find(c => c.id === selectedSenderId);
        const receiverRow = tradingPartners.find(c => c.id === selectedReceiverId);

        if (!senderRow || !senderRow.private_key_pem) throw new Error("Sender Local Station is missing a private key in the database.");
        if (!receiverRow || !receiverRow.pem_data) throw new Error("Receiver Trading Partner is missing a public certificate in the database.");

        // 1. SIGN THE PAYLOAD
        const privKey = forge.pki.privateKeyFromPem(senderRow.private_key_pem);
        const senderCert = forge.pki.certificateFromPem(senderRow.pem_data);
        
        const p7Sign = forge.pkcs7.createSignedData();
        p7Sign.content = forge.util.createBuffer(form.payload, 'utf8');
        p7Sign.addCertificate(senderCert);
        p7Sign.addSigner({
          key: privKey,
          certificate: senderCert,
          digestAlgorithm: forge.pki.oids.sha256,
          authenticatedAttributes: [
            { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
            { type: forge.pki.oids.messageDigest },
            { type: forge.pki.oids.signingTime, value: new Date() }
          ]
        });
        p7Sign.sign();
        
        const signedDerBytes = forge.asn1.toDer(p7Sign.toAsn1()).getBytes();

        // 2. ENCRYPT THE SIGNED DATA
        const receiverCert = forge.pki.certificateFromPem(receiverRow.pem_data);
        const p7Enc = forge.pkcs7.createEnvelopedData();
        p7Enc.addRecipient(receiverCert);
        p7Enc.content = forge.util.createBuffer(signedDerBytes, 'binary');
        p7Enc.encrypt();

        const encryptedDerBytes = forge.asn1.toDer(p7Enc.toAsn1()).getBytes();
        const binaryBuffer = new Uint8Array(encryptedDerBytes.length);
        for (let i = 0; i < encryptedDerBytes.length; i++) {
          binaryBuffer[i] = encryptedDerBytes.charCodeAt(i) & 0xff;
        }

        headers['Content-Type'] = 'application/pkcs7-mime; smime-type=enveloped-data';
        finalPayloadBlob = new Blob([binaryBuffer], { type: 'application/pkcs7-mime' });

      } catch (cryptoErr) {
        setResult({ status: 'error', code: 0, body: `Cryptographic Core Panic: ${cryptoErr.message}`, time: 0, messageId: msgId, ts: new Date().toLocaleTimeString() });
        return;
      }
    } else {
      headers['Content-Type'] = 'application/xml';
      finalPayloadBlob = new Blob([form.payload], { type: 'application/xml' });
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
        <div style={{ width: '420px', borderRight: '1px solid var(--border-color)', padding: '24px', overflowY: 'auto', background: 'var(--bg-panel)' }}>

          <div style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(37, 99, 235, 0.15)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: form.simulateEncryption ? '12px' : '0' }}>
              <input type="checkbox" id="simulateEncryption" checked={form.simulateEncryption} onChange={e => setForm({ ...form, simulateEncryption: e.target.checked })} />
              <label htmlFor="simulateEncryption" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--accent-blue)' }}>
                Enable Full S/MIME (Sign & Encrypt)
              </label>
            </div>

            {form.simulateEncryption && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                    <KeyRound size={12} color="#10b981" /> Sender Identity (Local Station):
                  </label>
                  <select className="form-select" value={selectedSenderId} onChange={handleSenderChange} style={{ fontSize: '12px', background: '#ffffff', fontFamily: 'monospace' }}>
                    {loadingCerts ? <option>Loading...</option> : localStations.map(s => <option key={s.id} value={s.id}>{s.alias}</option>)}
                  </select>
                </div>
                
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
                  <label className="form-label" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                    <Shield size={12} color="#2563eb" /> Target Receiver (Trading Partner):
                  </label>
                  <select className="form-select" value={selectedReceiverId} onChange={handleReceiverChange} style={{ fontSize: '12px', background: '#ffffff', fontFamily: 'monospace' }}>
                    {loadingCerts ? <option>Loading...</option> : tradingPartners.map(p => <option key={p.id} value={p.id}>{p.alias}</option>)}
                  </select>
                </div>
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

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Server Return Pipeline</h3>
            {!result && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Awaiting pipeline execution...</p>}
            {result?.status === 'loading' && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-blue)', fontSize: '13px' }}><Clock size={16} /> Parsing streams over active network socket parameters...</div>}
            {result && result.status !== 'loading' && (
              <div style={{ animation: 'fadeIn 0.15s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  {result.body.includes('error') ? <XCircle size={18} color="var(--accent-red)" /> : <CheckCircle size={18} color="var(--accent-green)" />}
                  <span style={{ fontWeight: 600, fontSize: '13px', color: result.body.includes('error') ? 'var(--accent-red)' : 'var(--accent-green)' }}>HTTP {result.code} — Handshake Processed in {result.time}ms</span>
                </div>
                <pre style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '12px', fontSize: '11px', fontFamily: 'monospace', overflowY: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap' }}>{result.body}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VeevaTestPanel;