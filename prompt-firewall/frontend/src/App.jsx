import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Chatbot from './components/Chatbot';
import AdminDashboard from './components/AdminDashboard';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [adminToken, setAdminToken] = useState(() => {
    return sessionStorage.getItem('prompt_firewall_admin_token') || '';
  });
  const [healthInfo, setHealthInfo] = useState(null);

  useEffect(() => {
    // Initial health check
    api.getHealth()
      .then(data => setHealthInfo(data))
      .catch(err => console.warn('Health check warning:', err.message));
  }, []);

  const handleLogin = (token) => {
    setAdminToken(token);
    sessionStorage.setItem('prompt_firewall_admin_token', token);
  };

  const handleLogout = () => {
    setAdminToken('');
    sessionStorage.removeItem('prompt_firewall_admin_token');
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        providerInfo={healthInfo}
      />

      <main className="main-content">
        {activeTab === 'chat' && <Chatbot />}
        {activeTab === 'dashboard' && (
          <AdminDashboard
            token={adminToken}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  );
}
