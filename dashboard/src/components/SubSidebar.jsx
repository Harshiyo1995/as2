import React from 'react';

const SubSidebar = ({ activeMainTab, activeSubTab, setActiveSubTab }) => {
  
  if (activeMainTab === 'flows') {
    return (
      <aside className="sidebar-light">
        <div className="sidebar-light-header">
          Flows
        </div>
        <div style={{ padding: '16px' }}>
          <select className="form-select" style={{ marginBottom: '16px' }}>
            <option>Default Workspace</option>
          </select>
          
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Connectors
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="nav-icon" style={{ flexDirection: 'row', padding: '8px', color: 'var(--text-main)', background: '#f8fafc', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
              AS2 Gateway
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return null; // For Certificates, maybe no sub-sidebar
};

export default SubSidebar;
