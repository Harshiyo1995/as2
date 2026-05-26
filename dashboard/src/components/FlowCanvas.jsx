import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Controls, Background, useNodesState, useEdgesState, addEdge, MarkerType } from 'reactflow';
import AdvancedSettingsDrawer from './AdvancedSettingsDrawer';
import 'reactflow/dist/style.css';

const initialNodes = [
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { 
      label: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', width: '100%' }}>
            <span style={{ color: '#2563eb', fontWeight: 'bold' }}>* AS2</span>
            <span style={{ fontSize: '12px' }}>dev1021-async</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Receive files from:</div>
          <div style={{ fontSize: '11px', fontWeight: 500 }}>test</div>
          <a href="#" style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'none', marginTop: '4px' }}>→ Go to Send Action</a>
        </div>
      ) 
    },
    style: { width: 250, background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
  },
  {
    id: '2',
    position: { x: 400, y: 50 },
    data: { 
      label: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', width: '100%' }}>
            <span style={{ color: '#2563eb', fontWeight: 'bold' }}>&gt; AS2</span>
            <span style={{ fontSize: '12px' }}>dev1021-sync</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Send files to:</div>
          <div style={{ fontSize: '11px', fontWeight: 500 }}>veeva_vault</div>
          <a href="#" style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'none', marginTop: '4px' }}>→ Go to Receive Action</a>
        </div>
      ) 
    },
    style: { width: 250, background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
  },
  {
    id: '3',
    position: { x: 750, y: 100 },
    data: { 
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</div>
          <span style={{ fontWeight: 600 }}>Flow End</span>
        </div>
      )
    },
    style: { background: 'white', border: '1px solid #cbd5e1', borderRadius: '24px', padding: '4px' }
  }
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'e2-3', source: '2', target: '3', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' }, style: { stroke: '#94a3b8', strokeWidth: 2 } },
];

const FlowCanvas = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [liveDbPartner, setLiveDbPartner] = useState(null);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // DYNAMIC ALIGNMENT PASSAGE: Fetch records directly from active DB state on load
  useEffect(() => {
    fetch('http://localhost:8080/api/partners')
      .then((res) => res.json())
      .then((data) => {
        // Look for the specific profile record matching our target connection ID
        const veevaRecord = data.find((p) => p.as2_id === 'connectionvault1021');
        if (veevaRecord) {
          setLiveDbPartner(veevaRecord);
        }
      })
      .catch((err) => console.error('Failed to sync canvas view with database context', err));
  }, []);

  const onNodeClick = (event, node) => {
    if (node.id === '2') {
      if (liveDbPartner) {
        // If database data exists, load it directly into the drawer context
        setSelectedPartner(liveDbPartner);
      } else {
        // Fallback default state if database lookup hasn't resolved yet
        setSelectedPartner({ 
          id: 'connectionvault1021',
          name: 'dev1021-async', 
          as2_id: 'connectionvault1021', 
          url: 'https://connectionvault1021.gateway.dev.veevavaultsafety.com/api/v1/inbound/transmission',
          sign_outbound: true,
          encrypt_outbound: true,
          encryption_algorithm: '3DES',
          request_mdn: true,
          mdn_delivery_mode: 'SYNC'
        });
      }
    } else {
      setSelectedPartner({ id: 'dev1021-async', name: 'test_partner', as2_id: 'dev1021-async', url: 'https://test.com/as2' });
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div className="top-toolbar" style={{ display: 'flex', padding: '10px', background: 'white', borderBottom: '1px solid #cbd5e1', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <select className="form-select" style={{ width: '180px', padding: '6px' }}>
              <option>Flows / Default</option>
            </select>
          </div>
          <div>
            <input type="text" placeholder="Search Connectors..." className="form-input" style={{ width: '350px', background: '#f8fafc', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
          </div>
        </div>
        
        <div style={{ height: 'calc(100% - 56px)', width: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-left"
          >
            <Controls />
            <Background color="#cbd5e1" gap={16} />
          </ReactFlow>
        </div>
      </div>
      
      {selectedPartner && (
        <AdvancedSettingsDrawer partner={selectedPartner} onClose={() => setSelectedPartner(null)} />
      )}
    </div>
  );
};

export default FlowCanvas;