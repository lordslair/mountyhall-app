const API_BASE_URL = import.meta.env.VITE_API_URL;

// Log API configuration on module load (for debugging)
console.log(`[API] API Base URL: ${API_BASE_URL}`);
console.log(`[API] Environment VITE_API_URL: ${import.meta.env.VITE_API_URL || 'not set (using default)'}`);

/**
 * Get the JWT token from localStorage
 */
const getToken = () => {
  return localStorage.getItem('token');
};

/**
 * Set the JWT token in localStorage
 */
const setToken = (token) => {
  localStorage.setItem('token', token);
};

/**
 * Remove the JWT token from localStorage
 */
const removeToken = () => {
  localStorage.removeItem('token');
};

/**
 * Make an API request with automatic token injection
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`[API] ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log(`[API] Response status: ${response.status} for ${endpoint}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error(`[API] Error response:`, errorData);
      } catch (e) {
        // Response is not JSON
        const text = await response.text();
        console.error(`[API] Non-JSON error response:`, text);
        errorData = { error: text || `HTTP error! status: ${response.status}` };
      }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[API] Success response for ${endpoint}`);
    return data;
  } catch (error) {
    // Network errors or other fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`[API] Network error:`, error);
      throw new Error(`Network error: Unable to reach server at ${API_BASE_URL}. Check if the backend is running.`);
    }
    throw error;
  }
};

/**
 * API service functions
 */
export const api = {
  // Authentication
  register: async (email, password) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  login: async (email, password) => {
    console.log(`[API] Login attempt for email: ${email}`);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      if (data.access_token) {
        console.log(`[API] Login successful, token received`);
        setToken(data.access_token);
      } else {
        console.warn(`[API] Login response missing access_token:`, data);
        throw new Error('Login response missing access_token');
      }
      return data;
    } catch (error) {
      console.error(`[API] Login failed:`, error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    } finally {
      removeToken();
    }
  },

  // Profile
  getProfile: async () => {
    return apiRequest('/auth/profile', {
      method: 'GET',
    });
  },

  updateProfile: async (updates) => {
    return apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Group — SCIZ
  getScizGroupTrolls: async () => {
    return apiRequest('/group/sciz/trolls', {
      method: 'GET',
    });
  },

  // Group — BT (Bricol'Trolls mz_json via backend)
  getBtGroup: async () => {
    return apiRequest('/group/bt', {
      method: 'GET',
    });
  },

  getBtBonusMalus: async (trollIds) => {
    return apiRequest('/group/bt/bonus-malus', {
      method: 'POST',
      body: JSON.stringify({ troll_ids: trollIds }),
    });
  },

  refreshBtBonusMalus: async (trollId) => {
    return apiRequest('/group/bt/bonus-malus/refresh', {
      method: 'POST',
      body: JSON.stringify({ troll_id: trollId }),
    });
  },

  // Monsters
  searchMonster: async (mob_id) => {
    return apiRequest('/monsters/search', {
      method: 'POST',
      body: JSON.stringify({ mob_id }),
    });
  },

  fetchMZData: async (mob_id) => {
    return apiRequest(`/monsters/${mob_id}/mz`, {
      method: 'POST',
    });
  },

  getMonsterEvents: async (mob_id) => {
    return apiRequest(`/monsters/${mob_id}/events`, {
      method: 'GET',
    });
  },

  getMonsters: async () => {
    return apiRequest('/monsters', {
      method: 'GET',
    });
  },

  deleteMonster: async (mob_id) => {
    return apiRequest(`/monsters/${mob_id}`, {
      method: 'DELETE',
    });
  },

  purgeMonsters: async () => {
    return apiRequest('/monsters', {
      method: 'DELETE',
    });
  },

  // Admin
  getAdminMetrics: async () => {
    return apiRequest('/admin/metrics', {
      method: 'GET',
    });
  },
};

export { getToken, setToken, removeToken };
