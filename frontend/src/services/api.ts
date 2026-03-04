import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://delivery-tokio.preview.emergentagent.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Error getting token:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data: { nombre: string; email: string; password: string; role: string }) =>
    api.post('/auth/register', data),
  
  login: (email: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  
  getMe: () => api.get('/auth/me'),
};

// Order APIs
export const orderAPI = {
  create: (data: {
    tipo_servicio: string;
    descripcion: string;
    origen_texto: string;
    destino_texto: string;
    client_location?: { lat: number; lng: number } | null;
    payment_method?: string;
  }) => api.post('/orders', data),
  
  getMyOrders: () => api.get('/orders/my'),
  
  getPending: () => api.get('/orders/pending'),
  
  getDriverOrders: () => api.get('/orders/driver/my'),
  
  getOrder: (orderId: string) => api.get(`/orders/${orderId}`),
  
  getCourierLocation: (orderId: string) => api.get(`/orders/${orderId}/courier-location`),
  
  accept: (orderId: string) => api.post(`/orders/${orderId}/accept`),
  
  updateStatus: (orderId: string, status: string) =>
    api.patch(`/orders/${orderId}/status`, { status }),
  
  updateLocation: (orderId: string, lat: number, lng: number) =>
    api.patch(`/orders/${orderId}/location`, { lat, lng }),
};

// Chat APIs
export const chatAPI = {
  getMessages: (orderId: string) => api.get(`/orders/${orderId}/chat`),
  
  sendMessage: (orderId: string, message: string) =>
    api.post(`/orders/${orderId}/chat`, { message }),
};

// Rating APIs
export const ratingAPI = {
  create: (orderId: string, stars: number, comment?: string) =>
    api.post(`/orders/${orderId}/rating`, { stars, comment }),
  
  getDriverRatings: (repartidorId: string) =>
    api.get(`/ratings/repartidor/${repartidorId}`),
};

// Courier Stats APIs
export const courierAPI = {
  getStats: () => api.get('/courier/stats'),
  
  updateLocation: (orderId: string, lat: number, lng: number) =>
    api.post('/courier/location', { lat, lng }, { params: { order_id: orderId } }),
};

// Admin APIs
export const adminAPI = {
  getUsers: (role?: string) => api.get('/admin/users', { params: { role } }),
  
  getOrders: (status?: string) => api.get('/admin/orders', { params: { status } }),
  
  updateUserStatus: (userId: string, isActive: boolean) =>
    api.patch(`/admin/users/${userId}/status`, { is_active: isActive }),
  
  assignDriver: (orderId: string, repartidorId: string) =>
    api.patch(`/admin/orders/${orderId}/assign`, { repartidor_id: repartidorId }),
  
  updateOrderStatus: (orderId: string, status: string) =>
    api.patch(`/admin/orders/${orderId}/status`, { status }),
  
  getStats: () => api.get('/admin/stats'),
};

// Payment APIs
export const paymentAPI = {
  getConfig: () => api.get('/payments/config'),
  
  createIntent: (orderId: string) =>
    api.post('/payments/create-intent', { order_id: orderId }),
  
  confirmPayment: (orderId: string) =>
    api.post('/payments/confirm', null, { params: { order_id: orderId } }),
};

// Push Notification APIs
export const pushAPI = {
  getPublicKey: () => api.get('/push/public-key'),
  
  subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api.post('/push/subscribe', subscription),
  
  unsubscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api.post('/push/unsubscribe', subscription),
  
  test: () => api.post('/push/test'),
};

export default api;
