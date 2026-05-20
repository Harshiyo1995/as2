import React, { useState, useEffect } from 'react';
import { ShieldAlert, FileKey2, Clock, X, Copy, Check } from 'lucide-react';

const NrrCertificateModal = ({ messageId, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetch(`http://localhost:8080/as2/transactions/nrr?messageId=${encodeURIComponent(messageId)}`)
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to query NRR database record", err);
                setLoading(false);
            });
    }, [messageId]);

    const copyToClipboard = () => {
        if (!data?.rawMdn) return;
        navigator.clipboard.writeText(data.rawMdn);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!messageId) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999
        }}>
            <div style={{
                background: '#ffffff', width: '720px', borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                display: 'flex', flexDirection: 'column', maxHeight: '85vh', animation: 'scaleUp 0.15s ease-out'
            }}>

                {/* Header Ribbon */}
                <div style={{
                    padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileKey2 size={20} color="var(--accent-green)" />
                        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                            Non-Repudiation of Receipt (NRR) Evidence Vault
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
                </div>

                {/* Content Panel */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {loading ? (
                        <p style={{ color: '#64748b', fontSize: '13px' }}>Unlocking database cryptographic proofs...</p>
                    ) : !data || data.mic === 'Pending compilation / Not Required' ? (
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <ShieldAlert size={36} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
                            <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>NRR Record Unresolved</p>
                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>This transmission didn't require an MDN payload exchange, or it represents a plain bypass run.</p>
                        </div>
                    ) : (
                        <>
                            {/* Top Meta Details Summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Tracking Context Key</span>
                                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#334155', wordBreak: 'break-all' }}>{data.messageId}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Cryptographic Verification Timestamp</span>
                                    <span style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}><Clock size={12} /> {data.timestamp}</span>
                                </div>
                                <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '4px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Message Integrity Check (MIC Checksum)</span>
                                    <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-green)', wordBreak: 'break-all' }}>{data.mic}</span>
                                </div>
                            </div>

                            {/* Raw Signed Text Blob block */}
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '240px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Immutable Multipart MDN Response Receipt Body Stream</span>
                                    <button onClick={copyToClipboard} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                                        {copied ? <Check size={12} /> : <Copy size={12} />}
                                        {copied ? 'Copied Receipt!' : 'Copy Stream'}
                                    </button>
                                </div>
                                <pre style={{
                                    flex: 1, background: '#0f172a', color: '#94a3b8', padding: '14px', borderRadius: '6px',
                                    fontSize: '11px', fontFamily: 'monospace', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap'
                                }}>{data.rawMdn}</pre>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NrrCertificateModal;