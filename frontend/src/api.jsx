// API client wrapper for backend calls

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

async function request(endpoint, { method = 'GET', body = null } = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    method,
    headers,
  };
  
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        if (
          !window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/signup') && 
          window.location.pathname !== '/'
        ) {
          window.location.href = '/login?expired=true';
        }
      }
      throw new Error(data.error || 'Something went wrong');
    }
    
    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
  getBackendUrl: () => {
    const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    return url.replace(/\/api\/?$/, '');
  }
};
