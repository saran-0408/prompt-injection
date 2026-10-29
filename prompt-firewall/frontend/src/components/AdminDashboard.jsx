import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Lock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Server
} from 'lucide-react';

export default function AdminDashboard({ token, onLogin, onLogout }) {
  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard Data States
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState({ total: 0, data: [], page: 1, totalPages: 1 });
  const [pendingReviews, setPendingReviews] = useState([]);
  const [configStatus, setConfigStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  // Filter States
  const [decisionFilter, setDecisionFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Show config drawer/modal
  const [showConfig, setShowConfig] = useState(false);

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsData, logsData, reviewsData, configData] = await Promise.all([
        api.getStats(token),
        api.getAuditLogs(token, {
          decision: decisionFilter,
          outcome: outcomeFilter,
          search: searchQuery,
          limit: pageSize,
          offset: (page - 1) * pageSize
        }),
        api.getPendingReviews(token),
        api.getConfigStatus(token)
      ]);

      setStats(statsData);
      setAuditLogs(logsData);
      setPendingReviews(reviewsData.pendingReviews || []);
      setConfigStatus(configData);
    } catch (err) {
      if (err.status === 401) {
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token, decisionFilter, outcomeFilter, page]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await api.loginAdmin({ username, password });
      if (res.token) {
        onLogin(res.token);
      }
    } catch (err) {
      setLoginError(err.message || 'Invalid username or password');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDashboardData();
  };

  const handleApproveReview = async (requestId) => {
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      await api.approveReview(token, requestId);
      await fetchDashboardData();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleRejectReview = async (requestId) => {
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      await api.rejectReview(token, requestId);
      await fetchDashboardData();
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // If Not Authenticated, show Login Form
  if (!token) {
    return (
      <div className="login-wrapper">
        <div style={{ textAlign: 'center' }}>
          <div className="brand-icon-wrapper" style={{ display: 'inline-flex', marginBottom: '12px' }}>
            <Lock size={28} />
          </div>
          <h2>Admin Authentication</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
            Administrative access required to view security audit logs & stats.
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} className="login-form">
          {loginError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem' }}>
              {loginError}
            </div>
          )}

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loggingIn}>
            {loggingIn ? <div className="spinner"></div> : <Lock size={16} />}
            <span>Sign In to Dashboard</span>
          </button>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '10px' }}>
            Enter the administrative credentials configured in your backend <code>.env</code> file (ADMIN_USERNAME &amp; ADMIN_PASSWORD).
          </p>
        </form>
      </div>
    );
  }

  // Authenticated Dashboard View
  const total = stats?.totalRequests || 0;
  const allowed = stats?.allowedRequests || 0;
  const blocked = stats?.blockedRequests || 0;
  const review = stats?.reviewRequests || 0;
  const failures = stats?.providerFailures || 0;
  const blockRate = stats?.blockRate || 0;

  const allowPct = total > 0 ? (allowed / total) * 100 : 0;
  const blockPct = total > 0 ? (blocked / total) * 100 : 0;
  const reviewPct = total > 0 ? (review / total) * 100 : 0;

  return (
    <div className="dashboard-page">
      {/* Dashboard Top Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h2>Security Operations Center</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Real-time prompt firewall telemetry, audit trails, and moderation queue
          </p>
        </div>

        <div className="dashboard-actions">
          <button className="btn-secondary" onClick={() => setShowConfig(!showConfig)}>
            <Sliders size={15} />
            <span>Config Status</span>
          </button>
          <button className="btn-secondary" onClick={fetchDashboardData} disabled={loading}>
            <RotateCcw size={15} className={loading ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn-danger" onClick={onLogout}>
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Config Drawer / Modal */}
      {showConfig && configStatus && (
        <div className="panel-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="panel-title">
            <span>Firewall Service Configuration</span>
            <button className="btn-secondary" onClick={() => setShowConfig(false)}>Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>AI Provider:</span>{' '}
              <strong>{configStatus.aiProvider.provider.toUpperCase()} ({configStatus.aiProvider.model})</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>API Credentials:</span>{' '}
              <strong>{configStatus.aiProvider.credentialsConfigured ? 'Configured' : 'Offline / Mock'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Detector Version:</span>{' '}
              <strong>{configStatus.detector.version}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Thresholds:</span>{' '}
              <strong>Block &gt;= {configStatus.detector.blockThreshold}, Review &gt;= {configStatus.detector.reviewThreshold}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Storage Engine:</span>{' '}
              <strong>{configStatus.storage.engine}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Store Message Content:</span>{' '}
              <strong>{configStatus.storage.storeMessageContent ? 'Enabled (Redacted)' : 'Disabled (Privacy First)'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Primary Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-top">
            <span>Total Inspected</span>
            <Server size={18} />
          </div>
          <div className="metric-card-value">{total}</div>
        </div>

        <div className="metric-card allow">
          <div className="metric-card-top">
            <span>Allowed</span>
            <ShieldCheck size={18} color="var(--color-allow)" />
          </div>
          <div className="metric-card-value">{allowed}</div>
        </div>

        <div className="metric-card block">
          <div className="metric-card-top">
            <span>Blocked Attacks</span>
            <ShieldAlert size={18} color="var(--color-block)" />
          </div>
          <div className="metric-card-value">{blocked}</div>
        </div>

        <div className="metric-card review">
          <div className="metric-card-top">
            <span>Security Review</span>
            <AlertTriangle size={18} color="var(--color-review)" />
          </div>
          <div className="metric-card-value">{review}</div>
        </div>

        <div className="metric-card failure">
          <div className="metric-card-top">
            <span>Provider Errors</span>
            <Server size={18} color="#ea580c" />
          </div>
          <div className="metric-card-value">{failures}</div>
        </div>

        <div className="metric-card rate">
          <div className="metric-card-top">
            <span>Block Rate</span>
            <span>%</span>
          </div>
          <div className="metric-card-value">{blockRate}%</div>
        </div>
      </div>

      {/* Visual Charts & Breakdown */}
      <div className="charts-grid">
        {/* Ratio & Distribution Panel */}
        <div className="panel-card">
          <div className="panel-title">
            <span>Decision Distribution Ratio</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{total} Total Requests</span>
          </div>

          <div className="ratio-bar-container">
            <div className="ratio-segment" style={{ width: `${allowPct}%`, backgroundColor: 'var(--color-allow)' }} title={`Allowed: ${allowPct.toFixed(1)}%`} />
            <div className="ratio-segment" style={{ width: `${blockPct}%`, backgroundColor: 'var(--color-block)' }} title={`Blocked: ${blockPct.toFixed(1)}%`} />
            <div className="ratio-segment" style={{ width: `${reviewPct}%`, backgroundColor: 'var(--color-review)' }} title={`Review: ${reviewPct.toFixed(1)}%`} />
          </div>

          <div className="ratio-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-allow)' }}></span>
              <span>Allowed ({allowPct.toFixed(1)}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-block)' }}></span>
              <span>Blocked ({blockPct.toFixed(1)}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: 'var(--color-review)' }}></span>
              <span>Review ({reviewPct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* Risk Score Histogram */}
        <div className="panel-card">
          <div className="panel-title">
            <span>Risk Score Distribution</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score Buckets</span>
          </div>

          <div className="histogram-list">
            {(stats?.riskScoreDistribution || []).map((b, idx) => {
              const maxBucketCount = Math.max(...(stats?.riskScoreDistribution || []).map(x => x.count), 1);
              const pct = (b.count / maxBucketCount) * 100;
              const barColor = idx === 0 ? '#10b981' : idx === 1 ? '#34d399' : idx === 2 ? '#f59e0b' : idx === 3 ? '#f87171' : '#ef4444';

              return (
                <div key={idx} className="histogram-row">
                  <div className="histogram-row-header">
                    <span>{b.range}</span>
                    <span><strong>{b.count}</strong> requests</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Moderation Review Queue (If Any Pending) */}
      {pendingReviews.length > 0 && (
        <div className="panel-card" style={{ border: '1px solid rgba(245, 158, 11, 0.4)' }}>
          <div className="panel-title" style={{ color: '#fbbf24' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              <span>Pending Moderation Queue ({pendingReviews.length} awaiting review)</span>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Flagged Message</th>
                  <th>Risk Score</th>
                  <th>Detected Reasons</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingReviews.map(item => (
                  <tr key={item.id}>
                    <td><code style={{ fontSize: '0.78rem' }}>{item.requestId.slice(0, 8)}...</code></td>
                    <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>{item.message}</td>
                    <td>
                      <span className="badge review">{item.riskScore}/100</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {(item.reasons || []).join('; ')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-secondary"
                          style={{ borderColor: '#10b981', color: '#34d399' }}
                          onClick={() => handleApproveReview(item.requestId)}
                          disabled={actionLoading[item.requestId]}
                        >
                          <CheckCircle size={14} />
                          <span>Approve & Dispatch</span>
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => handleRejectReview(item.requestId)}
                          disabled={actionLoading[item.requestId]}
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log Table Section */}
      <div className="panel-card">
        <div className="panel-title">
          <span>Security Audit Log Trail</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {auditLogs.data.length} of {auditLogs.total} events
          </span>
        </div>

        {/* Filters Bar */}
        <div className="filter-bar">
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              className="filter-input"
              style={{ flex: 1 }}
              placeholder="Search by Request ID or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn-secondary">
              <Search size={14} />
            </button>
          </form>

          <select
            className="filter-select"
            value={decisionFilter}
            onChange={(e) => { setDecisionFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">All Decisions</option>
            <option value="ALLOW">ALLOW only</option>
            <option value="BLOCK">BLOCK only</option>
            <option value="REVIEW">REVIEW only</option>
          </select>

          <select
            className="filter-select"
            value={outcomeFilter}
            onChange={(e) => { setOutcomeFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">All Outcomes</option>
            <option value="ALLOWED">ALLOWED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
            <option value="PROVIDER_ERROR">PROVIDER_ERROR</option>
            <option value="APPROVED_AFTER_REVIEW">APPROVED_AFTER_REVIEW</option>
            <option value="REJECTED_AFTER_REVIEW">REJECTED_AFTER_REVIEW</option>
          </select>
        </div>

        {/* Audit Table */}
        <div className="table-container">
          {auditLogs.data.length === 0 ? (
            <div className="empty-state">
              <ShieldAlert size={36} style={{ opacity: 0.4 }} />
              <p>No audit log events match the current filter criteria.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Timestamp</th>
                  <th>Decision</th>
                  <th>Risk Score</th>
                  <th>Outcome</th>
                  <th>Detection Reasons</th>
                  <th>Provider</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        {row.requestId.slice(0, 8)}...
                      </code>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className={`badge ${row.decision.toLowerCase()}`}>
                        {row.decision}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: row.riskScore >= 70 ? '#f87171' : row.riskScore >= 40 ? '#fbbf24' : '#34d399'
                      }}>
                        {row.riskScore}/100
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {row.outcome}
                      </span>
                    </td>
                    <td style={{ maxWidth: '280px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {(row.reasons || []).join('; ') || 'None'}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{row.provider}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{row.latencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Row */}
        {auditLogs.totalPages > 1 && (
          <div className="pagination-row">
            <span>
              Page {auditLogs.page} of {auditLogs.totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <button
                className="btn-secondary"
                disabled={page >= auditLogs.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
