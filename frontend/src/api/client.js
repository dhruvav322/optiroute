const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Get JWT token from localStorage
function getToken() {
  return localStorage.getItem('auth_token');
}

// Store JWT token in localStorage
function setToken(token) {
  localStorage.setItem('auth_token', token);
}

// Remove JWT token from localStorage
export function clearToken() {
  localStorage.removeItem('auth_token');
}

async function request(path, options = {}) {
  // Get token from storage and add to Authorization header
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const error = new Error(errorPayload.detail || 'Request failed');
    error.status = response.status;
    error.statusText = response.statusText;
    error.payload = errorPayload;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getForecast(days = 30) {
  // client_id removed - now extracted from JWT token on backend
  return request(`/api/v1/forecast/current?days=${days}`);
}

export function getInventorySummary() {
  return request('/api/v1/inventory/summary');
}

export function runSimulation(payload) {
  // client_id removed from payload - now extracted from JWT token on backend
  const { client_id: _client_id, ...payloadWithoutClientId } = payload;
  return request('/api/v1/simulation/run', {
    method: 'POST',
    body: JSON.stringify(payloadWithoutClientId),
  });
}

export function retrainModel(body = { train_from_uploaded_data: true, outlier_handling: 'winsorize' }) {
  // client_id removed - now extracted from JWT token on backend
  const { client_id: _client_id, ...bodyWithoutClientId } = body;
  return request('/api/v1/model/retrain', {
    method: 'POST',
    body: JSON.stringify(bodyWithoutClientId),
  });
}

export function getModelStatus() {
  return request('/api/v1/model/status');
}

export function getModelEvaluation() {
  // client_id removed - now extracted from JWT token on backend
  return request('/api/v1/model/evaluation');
}

export function getFeatureAnalysis() {
  // client_id removed - now extracted from JWT token on backend
  return request('/api/v1/features/analysis');
}

export function getExperimentsHistory(limit = 20) {
  return request(`/api/v1/experiments/history?limit=${limit}`);
}

export function getExperimentsBest(metric) {
  const query = metric ? `?metric=${encodeURIComponent(metric)}` : '';
  return request(`/api/v1/experiments/best${query}`);
}

export function getExperimentsCompare(ids) {
  const param = Array.isArray(ids) ? ids.join(',') : ids;
  return request(`/api/v1/experiments/compare?ids=${encodeURIComponent(param)}`);
}

export function logExperiment(payload) {
  return request('/api/v1/experiments/log', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function calculateBusinessImpact(payload) {
  return request('/api/v1/analysis/business-impact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadHistoricalCsv(file, columnMapping = null) {
  // Get token from storage
  const token = getToken();
  
  const formData = new FormData();
  formData.append('file', file, file.name);  // Include filename explicitly
  // client_id removed - now extracted from JWT token on backend
  
  // Add column mapping if provided
  if (columnMapping) {
    formData.append('column_mapping', JSON.stringify(columnMapping));
  }

  const headers = {};
  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/data/upload`, {
    method: 'POST',
    headers,
    body: formData,
    // Don't set Content-Type header - let browser set it with boundary
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const error = new Error(errorPayload.detail || 'Upload failed');
    error.status = response.status;
    error.payload = errorPayload;
    throw error;
  }

  return response.json();
}

export function optimizeRoutes(payload) {
  return request('/api/v1/routes/optimize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Authentication functions
export async function login(userId, clientId, password = null) {
  // Login endpoint doesn't require auth - use fetch directly instead of request()
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      client_id: clientId,
      password: password,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const error = new Error(errorPayload.detail || 'Login failed');
    error.status = response.status;
    error.payload = errorPayload;
    throw error;
  }

  const data = await response.json();
  
  // Store token in localStorage
  if (data.access_token) {
    setToken(data.access_token);
  }
  
  return data;
}

export async function getCurrentUser() {
  return request('/api/v1/auth/me');
}
