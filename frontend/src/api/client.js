const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const error = new Error(errorPayload.detail || 'Request failed');
    error.status = response.status;
    error.payload = errorPayload;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getForecast(days = 30, clientId = 'default') {
  return request(`/api/v1/forecast/current?days=${days}&client_id=${clientId}`);
}

export function getInventorySummary() {
  return request('/api/v1/inventory/summary');
}

export function runSimulation(payload) {
  return request('/api/v1/simulation/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function retrainModel(body = { client_id: 'default', train_from_uploaded_data: true, outlier_handling: 'winsorize' }) {
  return request('/api/v1/model/retrain', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getModelStatus() {
  return request('/api/v1/model/status');
}

export function getModelEvaluation(clientId = 'default') {
  return request(`/api/v1/model/evaluation?client_id=${clientId}`);
}

export function getFeatureAnalysis(clientId = 'default') {
  return request(`/api/v1/features/analysis?client_id=${clientId}`);
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

export async function uploadHistoricalCsv(file) {
  const formData = new FormData();
  formData.append('file', file, file.name);  // Include filename explicitly
  formData.append('client_id', 'default');  // Add required client_id

  const response = await fetch(`${API_BASE_URL}/api/v1/data/upload`, {
    method: 'POST',
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
