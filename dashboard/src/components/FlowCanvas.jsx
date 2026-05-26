import React, { useState, useEffect } from 'react';
import AdvancedSettingsDrawer from './AdvancedSettingsDrawer';

const ConnectorHub = () => {
  const [connectors, setConnectors] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch existing partners on load
  useEffect(() => {
    fetch('http://localhost:8080/api/partners')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          setConnectors(data);
        } else {
          // Fallback mock data if DB is empty for UI testing
          setConnectors([
            {
              id: 'local-1',
              name: 'dev1021-async (Local)',
              as2_id: 'test',
              url: 'http://localhost:8080/as2/receive',
              direction: 'Inbound',
            },
            {
              id: 'connectionvault1021',
              name: 'Veeva Vault Safety',
              as2_id: 'connectionvault1021',
              url: 'https://connectionvault1021.gateway.dev.veevavaultsafety.com/api/v1/inbound/transmission',
              direction: 'Outbound',
            }
          ]);
        }
      })
      .catch((err) => console.error('Failed to fetch connectors', err));
  }, []);

  const handleAddConnector = () => {
    // Pass a blank template to the drawer to create a new partner
    setSelectedPartner({
      isNew: true,
      name: '',
      as2_id: '',
      url: '',
      sign_outbound: true,
      encrypt_outbound: true,
      encryption_algorithm: '3DES',
      request_mdn: true,
      mdn_delivery_mode: 'SYNC'
    });
  };

  const handleDelete = (id, e) => {
    e.stopPropagation(); // Prevent opening the drawer when clicking delete
    const confirmDelete = window.confirm('Are you sure you want to remove this AS2 connector?');
    if (confirmDelete) {
      // Optimistic UI update (You would also make a DELETE API call here)
      setConnectors(connectors.filter(c => c.id !== id));
    }
  };

  const filteredConnectors = connectors.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.as2_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}>
        
        {/* Header & Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>AS2 Connectors</h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Manage your inbound and outbound trading partners.</p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <input 
              type="text" 
              placeholder="Search ID or Name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '250px', padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} 
            />
            <button 
              onClick={handleAddConnector}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> New Connector
            </button>
          </div>
        </div>

        {/* Connector Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredConnectors.map((connector) => (
            <div 
              key={connector.id} 
              onClick={() => setSelectedPartner(connector)}
              style={{ 
                backgroundColor: 'white', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '20px', 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
            >
              {/* Delete Button (Top Right) */}
              <button 
                onClick={(e) => handleDelete(connector.id, e)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                title="Remove Connector"
              >
                ✕
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AS2 Protocol
                </span>
              </div>
              
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1e293b', paddingRight: '20px' }}>
                {connector.name || 'Unnamed Partner'}
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>
                ID: {connector.as2_id || 'Unknown'}
              </p>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>ENDPOINT URL</div>
                <div style={{ fontSize: '12px', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {connector.url || 'No URL configured'}
                </div>
              </div>
            </div>
          ))}

          {filteredConnectors.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>
              No connectors found. Click "+ New Connector" to add one.
            </div>
          )}
        </div>
      </div>
      
      {/* Settings Drawer Overlay */}
      {selectedPartner && (
        <AdvancedSettingsDrawer 
          partner={selectedPartner} 
          onClose={() => {
            setSelectedPartner(null);
            // Optional: trigger a re-fetch here to ensure the grid updates after closing the drawer
          }} 
        />
      )}
    </div>
  );
};

export default ConnectorHub;