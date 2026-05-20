import React, { useState } from 'react';
import { Save, Server, FolderSync, ShieldCheck, BellRing, Database, HardDrive, Cpu } from 'lucide-react';

const SettingsPage = () => {
    const [settings, setSettings] = useState({
        as2Id: 'YOUR_COMPANY1',
        mdnUrl: 'http://localhost:8080/as2/mdn',
        storagePath: 'C:\\Users\\Harsh\\Desktop\\As2\\data_storage\\',
        retentionDays: '90',
        autoPurge: true,
        defaultCipher: 'AES256',
        defaultSignAlg: 'SHA256',
        tlsEnforce: true,
        alertEmail: 'pv-ops@yourcompany.com',
        enableSlackWebhook: false,
        slackWebhookUrl: ''
    });

    const [saved, setSaved] = useState(false);

    const handleSave = (e) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        console.log("Committed updated gateway engine settings configuration package:", settings);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
            {/* Sticky Header Row */}
            <div className="top-toolbar" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Gateway Control Settings</h2>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Configure your global B2B engine baselines, directory path tracks, and alert parameters</span>
                </div>
                <button
                    onClick={handleSave}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
                >
                    <Save size={16} />
                    {saved ? 'Configurations Saved!' : 'Save Parameters'}
                </button>
            </div>

            {/* Main Settings Grid Form Container */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                <form style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

                    {/* COMPONENT SECTION 1: GLOBAL STATION AS2 ID IDENTITY */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <Server size={18} color="var(--accent-blue)" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Local Station Gateway Identity</h3>
                        </div>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', color: '#475569' }}>Default System AS2 Identifier (AS2-To / AS2-From)</label>
                            <input type="text" className="form-input" value={settings.as2Id} onChange={e => setSettings({ ...settings, as2Id: e.target.value })} style={{ fontFamily: 'monospace' }} />
                            <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>The strict case-sensitive name partners use when addressing messages to you.</small>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', color: '#475569' }}>Asynchronous MDN Callback URL Endpoint</label>
                            <input type="text" className="form-input" value={settings.mdnUrl} onChange={e => setSettings({ ...settings, mdnUrl: e.target.value })} style={{ fontFamily: 'monospace' }} />
                        </div>
                    </div>

                    {/* COMPONENT SECTION 2: DISK AND ARCHIVE BUFFER FILE STORAGE */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <FolderSync size={18} color="var(--accent-blue)" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Data Repository Storage Paths</h3>
                        </div>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', color: '#475569' }}>Root Storage Base Path Path Target Directory</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <HardDrive size={16} style={{ color: '#94a3b8' }} />
                                <input type="text" className="form-input" value={settings.storagePath} onChange={e => setSettings({ ...settings, storagePath: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '20px' }}>
                            <div className="form-group" style={{ margin: 0, width: '120px' }}>
                                <label className="form-label" style={{ fontWeight: 500, fontSize: '12px' }}>Retention Days</label>
                                <input type="number" className="form-input" value={settings.retentionDays} onChange={e => setSettings({ ...settings, retentionDays: e.target.value })} />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '18px' }}>
                                <input type="checkbox" checked={settings.autoPurge} onChange={e => setSettings({ ...settings, autoPurge: e.target.checked })} />
                                Automatically prune expired encrypted payload cache logs
                            </label>
                        </div>
                    </div>

                    {/* COMPONENT SECTION 3: DEFAULT ENCRYPTION PROTOCOLS */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <ShieldCheck size={18} color="var(--accent-blue)" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Cryptographic Engine Baselines</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 500, fontSize: '12px' }}>Encryption Cipher</label>
                                <select className="form-select" value={settings.defaultCipher} onChange={e => setSettings({ ...settings, defaultCipher: e.target.value })}>
                                    <option value="AES256">AES256 (Highly Secure)</option>
                                    <option value="AES128">AES128</option>
                                    <option value="3DES">3DES (Legacy / Deprecated)</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 500, fontSize: '12px' }}>Signature MIC Digest</label>
                                <select className="form-select" value={settings.defaultSignAlg} onChange={e => setSettings({ ...settings, defaultSignAlg: e.target.value })}>
                                    <option value="SHA256">SHA256 (Recommended)</option>
                                    <option value="SHA1">SHA1</option>
                                </select>
                            </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '14px' }}>
                            <input type="checkbox" checked={settings.tlsEnforce} onChange={e => setSettings({ ...settings, tlsEnforce: e.target.checked })} />
                            Strictly enforce TLS v1.2 / v1.3 on all inbound sockets connection handshakes
                        </label>
                    </div>

                    {/* COMPONENT SECTION 4: WEBHOOK ALERTS AND NOTIFICATIONS */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <BellRing size={18} color="var(--accent-blue)" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Alert & Operational Notifications</h3>
                        </div>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px' }}>System Operational Error Target Email</label>
                            <input type="email" className="form-input" value={settings.alertEmail} onChange={e => setSettings({ ...settings, alertEmail: e.target.value })} placeholder="ops@company.com" />
                            <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>Receives fatal system core panic notifications (such as decryption errors or MDN failure conditions).</small>
                        </div>
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '14px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                                <input type="checkbox" checked={settings.enableSlackWebhook} onChange={e => setSettings({ ...settings, enableSlackWebhook: e.target.checked })} />
                                Broadcast transaction validation panics directly to Slack Webhook
                            </label>
                            {settings.enableSlackWebhook && (
                                <div className="form-group" style={{ marginTop: '10px', animation: 'fadeIn 0.15s ease-out' }}>
                                    <input type="text" className="form-input" value={settings.slackWebhookUrl} onChange={e => setSettings({ ...settings, slackWebhookUrl: e.target.value })} placeholder="https://hooks.slack.com/services/..." style={{ fontSize: '12px' }} />
                                </div>
                            )}
                        </div>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default SettingsPage;