/**
 * Frontend API Service Layer
 * Interacts with backend Prompt Firewall endpoints using standard Fetch API
 */

const API_BASE = ''; // Uses Vite proxy in development or same-origin in production

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {}),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}: Request failed`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Public Chat & Health
  async getHealth() {
    return request('/api/health');
  },

  async sendChatMessage(message) {
    try {
      return await request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
    } catch (err) {
      // If server returned structured JSON on 400, 403 (BLOCK), 429 (RATE_LIMIT), or 502 (PROVIDER_ERROR)
      if (err.data && (err.status === 400 || err.status === 403 || err.status === 429 || err.status === 502)) {
        return err.data;
      }
      throw err;
    }
  },

  // Admin Auth
  async loginAdmin(credentials) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },

  async verifyAuth(token) {
    return request('/api/auth/verify', { token });
  },

  // Protected Admin APIs
  async getStats(token) {
    return request('/api/stats', { token });
  },

  async getAuditLogs(token, queryParams = {}) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, val);
      }
    });
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/audit-logs${queryString}`, { token });
  },

  async getConfigStatus(token) {
    return request('/api/config/status', { token });
  },

  async getPendingReviews(token) {
    return request('/api/reviews/pending', { token });
  },

  async approveReview(token, requestId) {
    return request(`/api/reviews/${requestId}/approve`, {
      method: 'POST',
      token
    });
  },

  async rejectReview(token, requestId) {
    return request(`/api/reviews/${requestId}/reject`, {
      method: 'POST',
      token
    });
  }
};
