import React, { useState, useEffect } from 'react';
import { Save, Server, FolderSync, ShieldCheck, BellRing, Database, HardDrive, Cpu, Globe, Copy, CheckCircle2 } from 'lucide-react';

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
    
    // --- IP Utility State ---
    const [publicIp, setPublicIp] = useState('Fetching...');
    const [ipCopied, setIpCopied] = useState(false);

    // Fetch Public IP on load
    useEffect(() => {
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => setPublicIp(data.ip))
            .catch(() => setPublicIp('Unable to detect IP'));
    }, []);

    const handleCopyIp = (e) => {
        e.preventDefault();
        if (publicIp && publicIp !== 'Fetching...' && publicIp !== 'Unable to detect IP') {
            navigator.clipboard.writeText(publicIp);
            setIpCopied(true);
            setTimeout(() => setIpCopied(false), 2000);
        }
    };

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
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px', border: 'none', background: '#2563eb', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
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
                            <Server size={18} color="#2563eb" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Local Station Gateway Identity</h3>
                        </div>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', color: '#475569', display: 'block', marginBottom: '6px' }}>Default System AS2 Identifier (AS2-To / AS2-From)</label>
                            <input type="text" className="form-input" value={settings.as2Id} onChange={e => setSettings({ ...settings, as2Id: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px' }} />
                            <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>The strict case-sensitive name partners use when addressing messages to you.</small>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', color: '#475569', display: 'block', marginBottom: '6px' }}>Asynchronous MDN Callback URL Endpoint</label>
                            <input type="text" className="form-input" value={settings.mdnUrl} onChange={e => setSettings({ ...settings, mdnUrl: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px' }} />
                        </div>
                    </div>

                    {/* COMPONENT SECTION 2: DISK AND ARCHIVE BUFFER FILE STORAGE */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <FolderSync size={18} color="#2563eb" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Data Repository Storage Paths</h3>
                        </div>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', color: '#475569', display: 'block', marginBottom: '6px' }}>Root Storage Base Path Target Directory</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <HardDrive size={16} style={{ color: '#94a3b8' }} />
                                <input type="text" className="form-input" value={settings.storagePath} onChange={e => setSettings({ ...settings, storagePath: e.target.value })} style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '20px' }}>
                            <div className="form-group" style={{ margin: 0, width: '120px' }}>
                                <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', display: 'block', marginBottom: '6px' }}>Retention Days</label>
                                <input type="number" className="form-input" value={settings.retentionDays} onChange={e => setSettings({ ...settings, retentionDays: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}/>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '18px', color: '#334155' }}>
                                <input type="checkbox" checked={settings.autoPurge} onChange={e => setSettings({ ...settings, autoPurge: e.target.checked })} />
                                Automatically prune expired payload caches
                            </label>
                        </div>
                    </div>

                    {/* COMPONENT SECTION 3: DEFAULT ENCRYPTION PROTOCOLS */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <ShieldCheck size={18} color="#2563eb" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Cryptographic Engine Baselines</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', display: 'block', marginBottom: '6px' }}>Encryption Cipher</label>
                                <select className="form-select" value={settings.defaultCipher} onChange={e => setSettings({ ...settings, defaultCipher: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff' }}>
                                    <option value="AES256">AES256 (Highly Secure)</option>
                                    <option value="AES128">AES128</option>
                                    <option value="3DES">3DES (Legacy)</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', display: 'block', marginBottom: '6px' }}>Signature MIC Digest</label>
                                <select className="form-select" value={settings.defaultSignAlg} onChange={e => setSettings({ ...settings, defaultSignAlg: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff' }}>
                                    <option value="SHA256">SHA256 (Recommended)</option>
                                    <option value="SHA1">SHA1</option>
                                </select>
                            </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '14px', color: '#334155' }}>
                            <input type="checkbox" checked={settings.tlsEnforce} onChange={e => setSettings({ ...settings, tlsEnforce: e.target.checked })} />
                            Strictly enforce TLS v1.2 / v1.3 on inbound connections
                        </label>
                    </div>

                    {/* COMPONENT SECTION 4: WEBHOOK ALERTS AND NOTIFICATIONS */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <BellRing size={18} color="#2563eb" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Alert & Operational Notifications</h3>
                        </div>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', display: 'block', marginBottom: '6px' }}>System Operational Error Target Email</label>
                            <input type="email" className="form-input" value={settings.alertEmail} onChange={e => setSettings({ ...settings, alertEmail: e.target.value })} placeholder="ops@company.com" style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}/>
                            <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>Receives fatal system core panic notifications.</small>
                        </div>
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '14px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 500, color: '#334155' }}>
                                <input type="checkbox" checked={settings.enableSlackWebhook} onChange={e => setSettings({ ...settings, enableSlackWebhook: e.target.checked })} />
                                Broadcast transaction panics to Slack Webhook
                            </label>
                            {settings.enableSlackWebhook && (
                                <div className="form-group" style={{ marginTop: '10px' }}>
                                    <input type="text" className="form-input" value={settings.slackWebhookUrl} onChange={e => setSettings({ ...settings, slackWebhookUrl: e.target.value })} placeholder="https://hooks.slack.com/services/..." style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COMPONENT SECTION 5: NETWORK & IP DIAGNOSTICS */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <Globe size={18} color="#10b981" />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1e293b' }}>Network & Firewall Diagnostics</h3>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 500, fontSize: '12px', color: '#475569', display: 'block', marginBottom: '6px' }}>Current Public IP Address</label>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#0f172a', fontWeight: '600', flex: 1 }}>
                                    {publicIp}
                                </span>
                                <button 
                                    onClick={handleCopyIp}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}
                                    title="Copy IP Address"
                                >
                                    {ipCopied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
                                    {ipCopied ? <span style={{color: '#10b981'}}>Copied</span> : 'Copy'}
                                </button>
                            </div>

                            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                                Provide this exact IP address to your trading partners. They must whitelist this IP in their corporate firewalls to allow your outbound AS2 payloads and asynchronous MDNs to reach their servers successfully.
                            </p>
                        </div>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default SettingsPage;