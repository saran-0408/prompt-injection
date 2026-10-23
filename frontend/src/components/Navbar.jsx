import React from 'react';
import { Shield, ShieldAlert, MessageSquare, LayoutDashboard } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, providerInfo }) {
  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="brand-icon-wrapper">
          <Shield size={24} />
        </div>
        <div className="brand-title">
          <span>Prompt Firewall</span>
          <span className="brand-sub">Security & Enforcement System</span>
        </div>
      </div>

      <nav className="nav-links">
        <button
          className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={16} />
          <span>Chatbot</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={16} />
          <span>Admin Dashboard</span>
        </button>
      </nav>

      <div className="system-pill">
        <span className="pulse-dot"></span>
        <span>Enforcement Active</span>
        {providerInfo?.provider && (
          <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>
            ({providerInfo.provider.toUpperCase()})
          </span>
        )}
      </div>
    </header>
  );
}
