import React from 'react';
import { LayoutDashboard, Waypoints, FileCode2, Users, Shield, FileText, Activity, Settings, User } from 'lucide-react';

const Sidebar = ({ activeMainTab, setActiveMainTab }) => {
  return (
    <aside className="sidebar-dark">
      <div className="logo">AS2</div>

      <nav className="nav-menu">
        <NavItem id="dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeMainTab} set={setActiveMainTab} />
        <NavItem id="flows" icon={<Waypoints size={20} />} label="Flows" active={activeMainTab} set={setActiveMainTab} />
        <NavItem id="partners" icon={<Users size={20} />} label="Partners" active={activeMainTab} set={setActiveMainTab} />
        <NavItem id="certificates" icon={<Shield size={20} />} label="Certs" active={activeMainTab} set={setActiveMainTab} />
        <NavItem id="activity" icon={<Activity size={20} />} label="Test" active={activeMainTab} set={setActiveMainTab} />
        <NavItem id="settings" icon={<Settings size={20} />} label="Settings" active={activeMainTab} set={setActiveMainTab} />
      </nav>

      <div className="nav-footer">
        <NavItem id="admin" icon={<User size={20} />} label="Admin" active={activeMainTab} set={setActiveMainTab} />
      </div>
    </aside>
  );
};

const NavItem = ({ id, icon, label, active, set }) => (
  <div className={`nav-icon ${active === id ? 'active' : ''}`} onClick={() => set(id)}>
    {icon}
    <span>{label}</span>
  </div>
);

export default Sidebar;
