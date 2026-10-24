// public/js/api.js - Cliente HTTP para comunicação com a API do Servidor WMS

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...options
      };

      const res = await fetch(url, config);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  getDashboard() {
    return this.request('/dashboard');
  },

  getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/products${query ? `?${query}` : ''}`);
  },

  getProduct(idOrSku) {
    return this.request(`/products/${encodeURIComponent(idOrSku)}`);
  },

  createProduct(productData) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  },

  getLocations() {
    return this.request('/locations');
  },

  getInventory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/inventory${query ? `?${query}` : ''}`);
  },

  applyAdjustment(adjustmentData) {
    return this.request('/inventory/apply-adjustment', {
      method: 'POST',
      body: JSON.stringify(adjustmentData)
    });
  },

  transferStock(transferData) {
    return this.request('/movements/transfer', {
      method: 'POST',
      body: JSON.stringify(transferData)
    });
  },

  createRequisition(requisitionData) {
    return this.request('/requisitions', {
      method: 'POST',
      body: JSON.stringify(requisitionData)
    });
  },

  getRequisitions() {
    return this.request('/requisitions');
  },

  getMovements(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/movements${query ? `?${query}` : ''}`);
  },

  sendChatMessage(message) {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  },

  resetDatabase() {
    return this.request('/data/reset', {
      method: 'POST'
    });
  }
};

