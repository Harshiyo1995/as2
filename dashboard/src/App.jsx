import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import SubSidebar from './components/SubSidebar';
import FlowCanvas from './components/FlowCanvas';
import CertificateGrid from './components/CertificateGrid';
import TransactionLedger from './components/TransactionLedger';
import VeevaTestPanel from './components/VeevaTestPanel';
import PartnerDirectory from './components/PartnerDirectory';
import SettingsPage from './components/SettingsPage';
import 'reactflow/dist/style.css';

function App() {
  const [activeMainTab, setActiveMainTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('default');

  return (
    <div className="app-container">
      <Sidebar activeMainTab={activeMainTab} setActiveMainTab={setActiveMainTab} />
      <SubSidebar activeMainTab={activeMainTab} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />

      <main className="main-canvas">
        {activeMainTab === 'dashboard' && <TransactionLedger />}
        {activeMainTab === 'flows' && <FlowCanvas />}
        {activeMainTab === 'partners' && <PartnerDirectory />}
        {activeMainTab === 'certificates' && <CertificateGrid />}
        {activeMainTab === 'activity' && <VeevaTestPanel />}
        {activeMainTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
