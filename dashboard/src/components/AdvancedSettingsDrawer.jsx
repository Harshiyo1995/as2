import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, RefreshCw, AlertCircle, Cpu, LogIn, LogOut, Code, 
  Download, FileText, Search, Save, Trash2, Send, ChevronDown, 
  ChevronRight, X, Upload
} from 'lucide-react';

const AdvancedSettingsDrawer = ({ partner, onClose }) => {
  const [activeTab, setActiveTab] = useState('settings');
  const [dbCerts, setDbCerts] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  // --- Input/Output Tab Functional State ---
  const [expandedRow, setExpandedRow] = useState(null);
  const [innerTab, setInnerTab] = useState('details'); 
  const [transactionLogs, setTransactionLogs] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]); 
  
  // Modal & Dropdown State
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [stagedFile, setStagedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const fileInputRef = useRef(null);

  // ─── ALIGNED FORM STATE ───
  const [formData, setFormData] = useState({
    as2_id: '',
    url: '',
    sign_outbound: true,
    encrypt_outbound: true,
    require_signature: true,
    require_encryption: true,
    compress_outbound: false,
    connection_timeout: 60,
    encryption_algorithm: '3DES',
    signature_algorithm: 'SHA-256',
    request_mdn: true,
    mdn_security: 'SIGNED',
    mdn_delivery_mode: 'SYNC',
    certificate_id: '', 
    as2_reliability: false,
    as2_reliability_interval: 30,
    alternate_local_as2_id: '',
    alternate_private_cert_id: '',
    alternate_private_cert_password: '',
    tls_use_profile_settings: true,
    tls_private_cert_id: '',
    tls_private_cert_password: '',
    http_auth_enabled: false,
    http_auth_type: 'BASIC',
    http_auth_user: '',
    http_auth_password: '',
    tls_protocols: { SSLv2: false, SSLv3: false, TLSv1_0: false, TLSv1_1: true, TLSv1_2: true, TLSv1_3: false },
    temp_receive_directory: '',
    custom_http_headers: '',
    use_global_proxy: true,
    proxy_type: 'None',
    proxy_host: '',
    proxy_port: '',
    proxy_user: '',
    proxy_password: ''
  });

  useEffect(() => {
    if (partner) {
      const savedTls = partner.tls_enabled_protocols || '';
      const parsedTls = {
        SSLv2: savedTls.includes('SSLv2'),
        SSLv3: savedTls.includes('SSLv3'),
        TLSv1_0: savedTls.includes('TLSv1_0') || savedTls.includes('TLSv1.0'),
        TLSv1_1: savedTls.includes('TLSv1_1') || savedTls.includes('TLSv1.1'),
        TLSv1_2: savedTls.includes('TLSv1_2') || savedTls.includes('TLSv1.2'),
        TLSv1_3: savedTls.includes('TLSv1_3') || savedTls.includes('TLSv1.3')
      };
      const finalTls = savedTls ? parsedTls : { SSLv2: false, SSLv3: false, TLSv1_0: false, TLSv1_1: true, TLSv1_2: true, TLSv1_3: false };

      setFormData(prev => ({
        ...prev,
        as2_id: partner.as2_id || '',
        url: partner.url || '',
        sign_outbound: partner.sign_outbound ?? true,
        encrypt_outbound: partner.encrypt_outbound ?? true,
        require_signature: partner.require_signature ?? true,
        require_encryption: partner.require_encryption ?? true,
        compress_outbound: partner.compress_outbound ?? false,
        connection_timeout: partner.connection_timeout || 60,
        encryption_algorithm: partner.encryption_algorithm || '3DES',
        signature_algorithm: partner.signature_algorithm || 'SHA-256',
        request_mdn: partner.request_mdn ?? true,
        mdn_security: partner.mdn_security || 'SIGNED',
        mdn_delivery_mode: partner.mdn_delivery_mode || 'SYNC',
        certificate_id: partner.certificate_id || '',
        as2_reliability: partner.as2_reliability ?? false,
        as2_reliability_interval: partner.as2_reliability_interval || 30,
        alternate_local_as2_id: partner.alternate_local_as2_id || '',
        alternate_private_cert_id: partner.alternate_private_cert_id || '',
        alternate_private_cert_password: partner.alternate_private_cert_password || '',
        tls_use_profile_settings: partner.tls_use_profile_settings ?? true,
        tls_private_cert_id: partner.tls_private_cert_id || '',
        tls_private_cert_password: partner.tls_private_cert_password || '',
        http_auth_enabled: partner.http_auth_enabled ?? false,
        http_auth_type: partner.http_auth_type || 'BASIC',
        http_auth_user: partner.http_auth_user || '',
        http_auth_password: partner.http_auth_password || '',
        tls_protocols: finalTls,
        temp_receive_directory: partner.temp_receive_directory || '',
        custom_http_headers: partner.custom_http_headers || '',
        use_global_proxy: partner.use_global_proxy ?? true,
        proxy_type: partner.proxy_type || 'None',
        proxy_host: partner.proxy_host || '',
        proxy_port: partner.proxy_port || '',
        proxy_user: partner.proxy_user || '',
        proxy_password: partner.proxy_password || ''
      }));
    }
  }, [partner]);

  useEffect(() => {
    fetch('http://localhost:8080/api/partners')
      .then(res => res.json())
      .then(data => {
        const certs = data.filter(p => p.certificate).map(p => p.certificate);
        setDbCerts(certs);
        setLoadingCerts(false);
      })
      .catch(err => {
        console.error("Failed to fetch certificates", err);
        setLoadingCerts(false);
      });
  }, []);

  const handleSaveChanges = async () => {
    try {
      const isNew = partner.isNew;
      const targetId = partner.id || partner.as2_id;
      
      const payload = {
          ...formData,
          name: formData.name || formData.as2_id || 'Unnamed Partner',
          tls_enabled_protocols: Object.keys(formData.tls_protocols || {}).filter(k => formData.tls_protocols[k]).join(','),
          certificate_id: formData.certificate_id || null,
          alternate_private_cert_id: formData.alternate_private_cert_id || null,
          tls_private_cert_id: formData.tls_private_cert_id || null,
          proxy_port: formData.proxy_port ? parseInt(formData.proxy_port, 10) : null,
          as2_reliability_interval: formData.as2_reliability_interval ? parseInt(formData.as2_reliability_interval, 10) : 30,
          connection_timeout: formData.connection_timeout ? parseInt(formData.connection_timeout, 10) : 60,
      };

      const method = isNew ? 'POST' : 'PUT';
      const endpoint = isNew 
        ? 'http://localhost:8080/as2/partners' 
        : `http://localhost:8080/as2/partners/${targetId}`;

      const response = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save configuration');
      }
      
      alert(`Settings Saved Successfully!`);
    } catch (error) {
      alert(`Error saving settings: ${error.message}`);
    }
  };

  const handleTlsChange = (protocol) => {
      setFormData(prev => ({
          ...prev,
          tls_protocols: { ...prev.tls_protocols, [protocol]: !prev.tls_protocols[protocol] }
      }));
  }

  // ─── TRANSACTION DB FETCHING LOGIC ───
  const fetchTransactions = async () => {
    if (!partner?.as2_id || partner.isNew) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`http://localhost:8080/as2/transactions/${partner.as2_id}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mappedLogs = json.data.map(tx => ({
          id: tx.id || tx.message_id,
          date: new Date(tx.created_at).toLocaleString(),
          status: tx.status === 'COMPLETED' ? 'Success' : tx.status === 'FAILED' ? 'Error' : tx.status,
          fileName: tx.raw_file_path || 'unknown.xml',
          fileSize: '-', 
          msgId: tx.message_id,
          processingTime: '-', 
          error: tx.error_details || null,
          direction: tx.direction // INBOUND or OUTBOUND
        }));
        
        // ─── THE FIX: Preserve Local "Unsent" files so they don't vanish on refresh ───
        setTransactionLogs(prevLogs => {
          const unsentLocalLogs = prevLogs.filter(log => log.status.includes('Unsent'));
          return [...unsentLocalLogs, ...mappedLogs];
        });
      }
    } catch (err) {
      console.error('Failed to load transaction history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch when either Input or Output tab is opened
  useEffect(() => {
    if (activeTab === 'input' || activeTab === 'output') {
      fetchTransactions();
    }
  }, [activeTab, partner]);

  // ─── DYNAMIC TAB FILTERING ───
  // Input Tab = OUTBOUND data. Output Tab = INBOUND data.
  const displayedLogs = transactionLogs.filter(log => 
    activeTab === 'input' ? log.direction === 'OUTBOUND' : log.direction === 'INBOUND'
  );

  // ─── UPLOAD AND SEND LOGIC ───
  const handleModalUploadSubmit = () => {
    if (!stagedFile) return;
    const newLog = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      status: 'Unsent (Attempts: 1)',
      fileName: stagedFile.name,
      fileSize: `${(stagedFile.size / 1024).toFixed(2)} KB`,
      rawFile: stagedFile, 
      msgId: '-',
      processingTime: '-',
      error: null,
      direction: 'OUTBOUND' // Uploads are always outbound
    };
    setTransactionLogs(prev => [newLog, ...prev]);
    setIsUploadModalOpen(false);
    setStagedFile(null);
  };

  const handleSendSelected = async () => {
    const filesToSend = displayedLogs.filter(log => selectedRows.includes(log.id) && log.rawFile);
    if (filesToSend.length === 0) return;

    setIsSending(true);

    for (const log of filesToSend) {
      const apiFormData = new FormData();
      apiFormData.append('file', log.rawFile);
      apiFormData.append('senderId', 'COMPANYUS'); 
      apiFormData.append('receiverId', formData.as2_id);

      try {
        const response = await fetch('http://localhost:8080/as2/send', {
          method: 'POST',
          body: apiFormData,
        });
        
        const result = await response.json();
        
        if (response.ok) {
          updateLog(log.id, { 
            status: 'Success', 
            msgId: result?.data?.messageId || 'Generated by Engine', 
            error: null 
          });
        } else {
          updateLog(log.id, { 
            status: 'Error', 
            error: `HTTP protocol error. ${result.message || '503 Service Temporarily Unavailable.'}`
          });
        }
      } catch (err) {
        updateLog(log.id, { 
          status: 'Error', 
          error: `HTTP protocol error. 503 Service Temporarily Unavailable.`
        });
      }
    }
    
    setIsSending(false);
    setSelectedRows([]); 
    setTimeout(fetchTransactions, 1000); 
  };

  // --- Utility Functions ---
  const toggleRowSelection = (id) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(displayedLogs.map(log => log.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleDeleteSelected = () => {
    setTransactionLogs(prev => prev.filter(log => !selectedRows.includes(log.id)));
    setSelectedRows([]);
  };

  const updateLog = (id, updates) => {
    setTransactionLogs(prev => prev.map(log => log.id === id ? { ...log, ...updates } : log));
  };

  if (!partner) return null;

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: '1100px', height: '100vh', background: '#f8fafc', borderLeft: '1px solid #e2e8f0', boxShadow: '-4px 0 24px rgba(15, 23, 42, 0.08)', display: 'flex', zIndex: 9999 }}>
      
      {/* Upload Modal Overlay */}
      {isUploadModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', width: '500px', borderRadius: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#334155' }}>Upload Files</h3>
              <X size={18} color="#64748b" style={{ cursor: 'pointer' }} onClick={() => setIsUploadModalOpen(false)} />
            </div>
            <div style={{ padding: '24px 20px' }}>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Select files to upload for sending.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#334155', fontWeight: 500, minWidth: '80px' }}>Upload Files</span>
                <div style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', background: '#fff', overflow: 'hidden' }}>
                  <button onClick={() => fileInputRef.current.click()} style={{ padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRight: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Choose Files
                  </button>
                  <span style={{ padding: '6px 12px', fontSize: '13px', color: stagedFile ? '#334155' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stagedFile ? stagedFile.name : 'No file chosen'}
                  </span>
                  <input type="file" ref={fileInputRef} onChange={(e) => setStagedFile(e.target.files[0])} style={{ display: 'none' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleModalUploadSubmit} disabled={!stagedFile} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: stagedFile ? 'pointer' : 'not-allowed', opacity: stagedFile ? 1 : 0.6 }}>
                <Upload size={14} /> Stage for Sending
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <div style={{ width: '200px', background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '16px 0', flexShrink: 0 }}>
        <Tab id="settings" icon={<Settings size={16} />} label="Settings" active={activeTab} set={setActiveTab} />
        <Tab id="automation" icon={<RefreshCw size={16} />} label="Automation" active={activeTab} set={setActiveTab} />
        <Tab id="alerts" icon={<AlertCircle size={16} />} label="Alerts" active={activeTab} set={setActiveTab} />
        <Tab id="advanced" icon={<Cpu size={16} />} label="Advanced" active={activeTab} set={setActiveTab} />
        <Tab id="input" icon={<LogIn size={16} />} label="Input" active={activeTab} set={setActiveTab} />
        <Tab id="output" icon={<LogOut size={16} />} label="Output" active={activeTab} set={setActiveTab} />
        <Tab id="events" icon={<Code size={16} />} label="Events" active={activeTab} set={setActiveTab} />
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ width: '32px', height: '32px', background: '#eff6ff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <FileText size={20} color="#2563eb" />
             </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{formData.as2_id || partner.name}</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>AS2 Profile</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '6px 12px', fontSize: '13px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
            <button onClick={handleSaveChanges} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '13px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
                <Save size={14} /> Save
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '24px', flex: 1 }}>
          
          {activeTab === 'settings' && (
             // ... [Settings JSX Remains Unchanged from previous code] ...
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
              <Section title="Settings">
                <FieldGroup>
                  <Label>AS2 Identifier:</Label>
                  <Input value={formData.as2_id} onChange={e => setFormData({...formData, as2_id: e.target.value})} />
                </FieldGroup>
                <FieldGroup>
                  <Label>Partner URL:</Label>
                  <Input value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
                </FieldGroup>
              </Section>
              <Section title="Connection Info">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div><Label>Send Message Security:</Label><Checkbox label="Sign send data" checked={formData.sign_outbound} onChange={e => setFormData({...formData, sign_outbound: e.target.checked})} /></div>
                  <div><Label>&nbsp;</Label><Checkbox label="Encrypt send data" checked={formData.encrypt_outbound} onChange={e => setFormData({...formData, encrypt_outbound: e.target.checked})} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div><Label>Receive Message Security:</Label><Checkbox label="Require signature" checked={formData.require_signature} onChange={e => setFormData({...formData, require_signature: e.target.checked})} /></div>
                  <div><Label>&nbsp;</Label><Checkbox label="Require encryption" checked={formData.require_encryption} onChange={e => setFormData({...formData, require_encryption: e.target.checked})} /></div>
                </div>
                <FieldGroup><Label>Compress send data:</Label><Checkbox label="Compress send data" checked={formData.compress_outbound} onChange={e => setFormData({...formData, compress_outbound: e.target.checked})} /></FieldGroup>
                <FieldGroup><Label>Connection Timeout (seconds):</Label><Input type="number" value={formData.connection_timeout} onChange={e => setFormData({...formData, connection_timeout: e.target.value})} /></FieldGroup>
                <FieldGroup><Label>Encryption Algorithm:</Label><Select value={formData.encryption_algorithm} onChange={e => setFormData({...formData, encryption_algorithm: e.target.value})}><option value="3DES">3DES</option><option value="AES128">AES128</option><option value="AES256">AES256</option></Select></FieldGroup>
                <FieldGroup><Label>Request MDN receipt:</Label><Checkbox label="Request MDN receipt" checked={formData.request_mdn} onChange={e => setFormData({...formData, request_mdn: e.target.checked})} /></FieldGroup>
                {formData.request_mdn && (
                  <div style={{ marginLeft: '24px' }}>
                    <FieldGroup><Label>Security:</Label><div style={{ display: 'flex', gap: '16px' }}><Radio label="Signed" name="mdn_sec" checked={formData.mdn_security === 'SIGNED'} onChange={() => setFormData({...formData, mdn_security: 'SIGNED'})} /><Radio label="Unsigned" name="mdn_sec" checked={formData.mdn_security === 'UNSIGNED'} onChange={() => setFormData({...formData, mdn_security: 'UNSIGNED'})} /></div></FieldGroup>
                    <FieldGroup><Label>Delivery:</Label><div style={{ display: 'flex', gap: '16px' }}><Radio label="Synchronous" name="mdn_del" checked={formData.mdn_delivery_mode === 'SYNC'} onChange={() => setFormData({...formData, mdn_delivery_mode: 'SYNC'})} /><Radio label="Asynchronous" name="mdn_del" checked={formData.mdn_delivery_mode === 'ASYNC'} onChange={() => setFormData({...formData, mdn_delivery_mode: 'ASYNC'})} /></div></FieldGroup>
                  </div>
                )}
              </Section>
              <Section title="Trading Partner Certificates">
                <FieldGroup><Label>Encryption Certificate:</Label><Select value={formData.certificate_id} onChange={e => setFormData({...formData, certificate_id: e.target.value})}><option value="">Select Certificate</option>{loadingCerts ? <option>Loading...</option> : dbCerts.map((c, i) => (<option key={i} value={c.id}>{c.alias || c.serial_number}</option>))}</Select></FieldGroup>
              </Section>
            </div>
          )}

          {activeTab === 'advanced' && (
             // ... [Advanced JSX Remains Unchanged from previous code] ...
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
                 <Section title="Advanced">
                     <FieldGroup><Label>AS2 Reliability:</Label><Checkbox label="Enable AS2 reliability" checked={formData.as2_reliability} onChange={e => setFormData({...formData, as2_reliability: e.target.checked})} /></FieldGroup>
                     <FieldGroup><Label>AS2 Reliability Interval (days):</Label><Input type="number" value={formData.as2_reliability_interval} onChange={e => setFormData({...formData, as2_reliability_interval: e.target.value})} disabled={!formData.as2_reliability}/></FieldGroup>
                 </Section>
                 <Section title="Alternate Local Profile">
                     <FieldGroup><Label>Local AS2 Identifier:</Label><Input value={formData.alternate_local_as2_id} onChange={e => setFormData({...formData, alternate_local_as2_id: e.target.value})} /></FieldGroup>
                     <FieldGroup><Label>Private Certificate:</Label><Select value={formData.alternate_private_cert_id} onChange={e => setFormData({...formData, alternate_private_cert_id: e.target.value})}><option value="">Select Certificate</option>{dbCerts.map((c, i) => ( <option key={i} value={c.id}>{c.alias || c.serial_number}</option> ))}</Select></FieldGroup>
                     <FieldGroup><Label>Private Certificate Password:</Label><Input type="password" value={formData.alternate_private_cert_password} onChange={e => setFormData({...formData, alternate_private_cert_password: e.target.value})} /></FieldGroup>
                 </Section>
                 <Section title="TLS Client Authentication">
                     <FieldGroup><Label>Use Profile Settings:</Label><Checkbox label="Use private certificate from the Profile tab" checked={formData.tls_use_profile_settings} onChange={e => setFormData({...formData, tls_use_profile_settings: e.target.checked})} /></FieldGroup>
                     {!formData.tls_use_profile_settings && (
                         <><FieldGroup><Label>Private Certificate:</Label><Select value={formData.tls_private_cert_id} onChange={e => setFormData({...formData, tls_private_cert_id: e.target.value})}><option value="">Select Certificate</option>{dbCerts.map((c, i) => ( <option key={i} value={c.id}>{c.alias || c.serial_number}</option> ))}</Select></FieldGroup><FieldGroup><Label>Private Certificate Password:</Label><Input type="password" value={formData.tls_private_cert_password} onChange={e => setFormData({...formData, tls_private_cert_password: e.target.value})} /></FieldGroup></>
                     )}
                 </Section>
                 <Section title="HTTP Authentication">
                    <FieldGroup><Label>HTTP Authentication:</Label><Checkbox label="Use HTTP authentication" checked={formData.http_auth_enabled} onChange={e => setFormData({...formData, http_auth_enabled: e.target.checked})} /></FieldGroup>
                     {formData.http_auth_enabled && (
                         <><FieldGroup><Label>HTTP Authentication Type:</Label><div style={{ display: 'flex', gap: '16px' }}><Radio label="Basic" name="http_auth" checked={formData.http_auth_type === 'BASIC'} onChange={() => setFormData({...formData, http_auth_type: 'BASIC'})} /><Radio label="Digest" name="http_auth" checked={formData.http_auth_type === 'DIGEST'} onChange={() => setFormData({...formData, http_auth_type: 'DIGEST'})} /></div></FieldGroup><FieldGroup><Label>User:</Label><Input value={formData.http_auth_user} onChange={e => setFormData({...formData, http_auth_user: e.target.value})} /></FieldGroup><FieldGroup><Label>Password:</Label><Input type="password" value={formData.http_auth_password} onChange={e => setFormData({...formData, http_auth_password: e.target.value})} /></FieldGroup></>
                     )}
                 </Section>
                 <Section title="Advanced Settings"> 
                    <FieldGroup><Label>Signature Algorithm:</Label><Select value={formData.signature_algorithm} onChange={e => setFormData({...formData, signature_algorithm: e.target.value})}><option value="SHA-256">SHA-256</option><option value="SHA-1">SHA-1</option></Select></FieldGroup>
                    <FieldGroup><Label>TLS Enabled Protocols:</Label><div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{Object.keys(formData.tls_protocols).map(proto => (<Checkbox key={proto} label={proto.replace('_', '.')} checked={formData.tls_protocols[proto]} onChange={() => handleTlsChange(proto)} />))}</div></FieldGroup>
                    <FieldGroup><Label>Temp Receive Directory:</Label><Input value={formData.temp_receive_directory} onChange={e => setFormData({...formData, temp_receive_directory: e.target.value})} /></FieldGroup>
                    <FieldGroup><Label>HTTP Headers:</Label><Input value={formData.custom_http_headers} onChange={e => setFormData({...formData, custom_http_headers: e.target.value})} /></FieldGroup>
                 </Section>
                 <Section title="Proxy Settings">
                     <FieldGroup><Label>Use Global:</Label><Checkbox label="Use global proxy settings from the Settings page" checked={formData.use_global_proxy} onChange={e => setFormData({...formData, use_global_proxy: e.target.checked})} /></FieldGroup>
                     {!formData.use_global_proxy && (
                         <><FieldGroup><Label>Proxy Type:</Label><Select value={formData.proxy_type} onChange={e => setFormData({...formData, proxy_type: e.target.value})}><option value="None">None</option><option value="HTTP">HTTP</option><option value="SOCKS5">SOCKS5</option></Select></FieldGroup><FieldGroup><Label>Proxy Host:</Label><Input value={formData.proxy_host} onChange={e => setFormData({...formData, proxy_host: e.target.value})} /></FieldGroup><FieldGroup><Label>Proxy Port:</Label><Input type="number" value={formData.proxy_port} onChange={e => setFormData({...formData, proxy_port: e.target.value})} /></FieldGroup><FieldGroup><Label>Proxy User:</Label><Input value={formData.proxy_user} onChange={e => setFormData({...formData, proxy_user: e.target.value})} /></FieldGroup><FieldGroup><Label>Proxy Password:</Label><Input type="password" value={formData.proxy_password} onChange={e => setFormData({...formData, proxy_password: e.target.value})} /></FieldGroup></>
                     )}
                 </Section>
             </div>
          )}

          {/* --- COMBINED INPUT / OUTPUT TAB --- */}
          {(activeTab === 'input' || activeTab === 'output') && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#334155' }}>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                    {activeTab === 'input' 
                      ? 'Place files and/or messages that need to be processed into the Send folder. (Outbound)' 
                      : 'Files and messages received from this trading partner will appear here. (Inbound)'}
                  </p>
                  
                  {/* Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'nowrap', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
                          <button onClick={fetchTransactions} disabled={isLoadingHistory} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLoadingHistory ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                              <RefreshCw size={14} color={isLoadingHistory ? "#cbd5e1" : "#64748b"} />
                          </button>
                          
                          <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                              <button onClick={handleDeleteSelected} disabled={selectedRows.length === 0} style={{ padding: '6px 12px', background: '#f8fafc', border: 'none', borderRight: activeTab === 'input' ? '1px solid #cbd5e1' : 'none', color: selectedRows.length > 0 ? '#ef4444' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: selectedRows.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                                  <Trash2 size={14} /> Delete
                              </button>
                              
                              {/* Only show "Send" on the Input tab */}
                              {activeTab === 'input' && (
                                <button onClick={handleSendSelected} disabled={selectedRows.length === 0 || isSending} style={{ padding: '6px 12px', background: '#f8fafc', color: selectedRows.length > 0 && !isSending ? '#334155' : '#94a3b8', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: selectedRows.length > 0 && !isSending ? 'pointer' : 'not-allowed', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                                    <Send size={14} /> {isSending ? 'Sending...' : 'Send'}
                                </button>
                              )}
                          </div>
                          
                          {/* More Dropdown */}
                          <div style={{ position: 'relative' }}>
                            <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} style={{ padding: '6px 12px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                More <ChevronDown size={14} />
                            </button>
                            {isMoreMenuOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, width: '150px', padding: '4px 0' }}>
                                <div style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', color: '#334155', whiteSpace: 'nowrap' }} onClick={() => setIsMoreMenuOpen(false)}>Create Test Files</div>
                                {/* Only show Upload on Input tab */}
                                {activeTab === 'input' && (
                                  <div style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', color: '#334155', whiteSpace: 'nowrap' }} onClick={() => { setIsMoreMenuOpen(false); setIsUploadModalOpen(true); }}>Upload File</div>
                                )}
                                <div style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', color: '#94a3b8', whiteSpace: 'nowrap' }}>Re-queue</div>
                              </div>
                            )}
                          </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end', minWidth: '200px' }}>
                          <div style={{ position: 'relative', width: '100%', maxWidth: '250px' }}>
                              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                              <input type="text" placeholder="Search for..." style={{ width: '100%', padding: '6px 10px 6px 32px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none' }} />
                          </div>
                      </div>
                  </div>

                  {/* Filters */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'nowrap' }}>
                      <select style={{ padding: '6px 32px 6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: '#fff', color: '#475569', outline: 'none', appearance: 'none', whiteSpace: 'nowrap' }}>
                          <option>All-time</option>
                      </select>
                      <select style={{ padding: '6px 32px 6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: '#fff', color: '#475569', outline: 'none', appearance: 'none', whiteSpace: 'nowrap' }}>
                          <option>All Status</option>
                      </select>
                  </div>

                  {/* Data Table */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', tableLayout: 'auto' }}>
                          <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                  <th style={{ padding: '12px 16px', width: '40px', whiteSpace: 'nowrap' }}>
                                      <input type="checkbox" onChange={handleSelectAll} checked={displayedLogs.length > 0 && selectedRows.length === displayedLogs.length} />
                                  </th>
                                  <th style={{ padding: '12px 0', fontWeight: 600, color: '#475569', width: '30px', whiteSpace: 'nowrap' }}></th>
                                  <th style={{ padding: '12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Date/Time</th>
                                  <th style={{ padding: '12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Status</th>
                                  <th style={{ padding: '12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>File Name</th>
                                  <th style={{ padding: '12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', textAlign: 'right' }}>File Size</th>
                              </tr>
                          </thead>
                          <tbody>
                              {displayedLogs.length === 0 ? (
                                <tr>
                                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                    {activeTab === 'input' 
                                      ? "No input messages found. Click 'More' to upload a file."
                                      : "No inbound messages received yet from this partner."}
                                  </td>
                                </tr>
                              ) : (
                                displayedLogs.map((log) => (
                                  <React.Fragment key={log.id}>
                                      <tr style={{ borderBottom: expandedRow !== log.id ? '1px solid #e2e8f0' : 'none', background: expandedRow === log.id ? '#f1f5f9' : 'transparent', transition: 'background 0.2s' }}>
                                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                            <input type="checkbox" checked={selectedRows.includes(log.id)} onChange={() => toggleRowSelection(log.id)} />
                                          </td>
                                          <td style={{ padding: '12px 0', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                                              {expandedRow === log.id ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
                                          </td>
                                          <td style={{ padding: '12px', color: '#475569', whiteSpace: 'nowrap' }}>{log.date}</td>
                                          <td style={{ padding: '12px', color: log.status === 'Success' ? '#10b981' : log.status === 'Error' ? '#ef4444' : '#64748b', whiteSpace: 'nowrap', fontWeight: 500 }}>{log.status}</td>
                                          <td style={{ padding: '12px', color: '#2563eb', cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.fileName}</td>
                                          <td style={{ padding: '12px', color: '#475569', whiteSpace: 'nowrap', textAlign: 'right' }}>{log.fileSize}</td>
                                      </tr>
                                      
                                      {/* Expanded Content (Detail Layout) */}
                                      {expandedRow === log.id && (
                                          <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                                              <td colSpan="6" style={{ padding: '0 48px 24px 48px' }}>
                                                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                      
                                                      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 16px', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                                                          <div style={{ display: 'flex', gap: '24px' }}>
                                                              <div onClick={() => setInnerTab('details')} style={{ padding: '12px 0', fontSize: '13px', cursor: 'pointer', color: innerTab === 'details' ? '#2563eb' : '#64748b', borderBottom: innerTab === 'details' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: innerTab === 'details' ? 600 : 400, whiteSpace: 'nowrap' }}>Additional Details</div>
                                                              <div onClick={() => setInnerTab('logs')} style={{ padding: '12px 0', fontSize: '13px', cursor: 'pointer', color: innerTab === 'logs' ? '#2563eb' : '#64748b', borderBottom: innerTab === 'logs' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: innerTab === 'logs' ? 600 : 400, whiteSpace: 'nowrap' }}>Logs</div>
                                                          </div>
                                                          {innerTab === 'logs' && (
                                                              <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                  <Download size={14} /> Download All Logs
                                                              </button>
                                                          )}
                                                      </div>
                                                      
                                                      {innerTab === 'details' && (
                                                          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', background: '#fff' }}>
                                                              <div>
                                                                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px', whiteSpace: 'nowrap' }}>Other Headers:</div>
                                                                  <div style={{ fontSize: '13px', wordBreak: 'break-all', marginBottom: '16px' }}>Processed: by Default:{formData.as2_id}; {log.status}; {log.date}</div>
                                                                  
                                                                  {log.error && (
                                                                      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '12px' }}>
                                                                          <div style={{ color: '#b91c1c', fontWeight: 600, fontSize: '12px', marginBottom: '4px', whiteSpace: 'nowrap' }}>Error:</div>
                                                                          <div style={{ color: '#b91c1c', fontSize: '13px' }}>{log.error}</div>
                                                                      </div>
                                                                  )}
                                                              </div>
                                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                                  <div>
                                                                      <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px', whiteSpace: 'nowrap' }}>Message Id:</div>
                                                                      <div style={{ fontSize: '13px', color: '#334155', wordBreak: 'break-all', fontFamily: 'monospace' }}>{log.msgId}</div>
                                                                  </div>
                                                                  <div>
                                                                      <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px', whiteSpace: 'nowrap' }}>Processing Time:</div>
                                                                      <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'nowrap' }}>{log.processingTime}</div>
                                                                  </div>
                                                                  <div>
                                                                      <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px', whiteSpace: 'nowrap' }}>File Size:</div>
                                                                      <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'nowrap' }}>{log.fileSize}</div>
                                                                  </div>
                                                              </div>
                                                          </div>
                                                      )}

                                                      {innerTab === 'logs' && (
                                                          <div style={{ padding: '0', background: '#fff', overflowX: 'auto' }}>
                                                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                                  <thead>
                                                                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                          <th style={{ padding: '10px 20px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Creation Time</th>
                                                                          <th style={{ padding: '10px 20px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Log Type</th>
                                                                          <th style={{ padding: '10px 20px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>File Name</th>
                                                                          <th style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}></th>
                                                                      </tr>
                                                                  </thead>
                                                                  <tbody>
                                                                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                          <td style={{ padding: '10px 20px', color: '#475569', whiteSpace: 'nowrap' }}>{log.date}</td>
                                                                          <td style={{ padding: '10px 20px', color: '#475569', whiteSpace: 'nowrap' }}>Log</td>
                                                                          <td style={{ padding: '10px 20px', color: '#2563eb', whiteSpace: 'nowrap' }}>{log.id}_transaction.log</td>
                                                                          <td style={{ padding: '10px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}><Download size={14} color="#64748b" style={{ cursor: 'pointer' }} /></td>
                                                                      </tr>
                                                                      {log.status !== 'Unsent (Attempts: 1)' && (
                                                                        <tr>
                                                                            <td style={{ padding: '10px 20px', color: '#475569', whiteSpace: 'nowrap' }}>{log.date}</td>
                                                                            <td style={{ padding: '10px 20px', color: '#475569', whiteSpace: 'nowrap' }}>MDN</td>
                                                                            <td style={{ padding: '10px 20px', color: '#2563eb', whiteSpace: 'nowrap' }}>{log.id}_receipt.mdn</td>
                                                                            <td style={{ padding: '10px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}><Download size={14} color="#64748b" style={{ cursor: 'pointer' }} /></td>
                                                                        </tr>
                                                                      )}
                                                                  </tbody>
                                                              </table>
                                                          </div>
                                                      )}
                                                  </div>
                                              </td>
                                          </tr>
                                      )}
                                  </React.Fragment>
                                ))
                              )}
                          </tbody>
                      </table>
                      
                      {/* Table Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          <div>Showing {displayedLogs.length > 0 ? 1 : 0} to {displayedLogs.length} of {displayedLogs.length} entries</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  Records per page: 
                                  <select style={{ padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}><option>50</option></select>
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                  <button style={{ padding: '4px 8px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>&lt;</button>
                                  <button style={{ padding: '4px 8px', border: '1px solid #2563eb', background: '#2563eb', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>1</button>
                                  <button style={{ padding: '4px 8px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>&gt;</button>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Reusable UI Components ---

const Tab = ({ id, icon, label, active, set }) => (
  <div onClick={() => set(id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: active === id ? '#2563eb' : '#475569', background: active === id ? '#eff6ff' : 'transparent', borderRight: `3px solid ${active === id ? '#2563eb' : 'transparent'}`, whiteSpace: 'nowrap' }}>
    {icon}
    <span>{label}</span>
  </div>
);

const Section = ({ title, children }) => (
    <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', whiteSpace: 'nowrap' }}>{title}</h3>
        {children}
    </div>
);

const FieldGroup = ({ children }) => (
    <div style={{ marginBottom: '16px' }}>{children}</div>
);

const Label = ({ children }) => (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '6px', whiteSpace: 'nowrap' }}>{children}</label>
);

const Input = (props) => (
    <input {...props} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', background: props.disabled ? '#f1f5f9' : '#fff' }} />
);

const Select = (props) => (
    <select {...props} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', background: '#fff' }}>
        {props.children}
    </select>
);

const Checkbox = ({ label, checked, onChange }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ cursor: 'pointer' }} />
        {label}
    </label>
);

const Radio = ({ label, name, checked, onChange }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <input type="radio" name={name} checked={checked} onChange={onChange} style={{ cursor: 'pointer' }} />
        {label}
    </label>
);

export default AdvancedSettingsDrawer;