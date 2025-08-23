// authentication functions

import api from './api';

// define login, logout and refresh functions
export const authApi = {
  login: async (password) => {
    const response = await api.post('/auth/login', null, {
      params: { password },
      withCredentials: true,
    });
    return response;
  },
  logout: () => api.post('/auth/logout'), //, {}, {withCredentials: true}),
  validate: async () => {
    return await api.get('/auth/verify');
  },
  passwordAvailable: async () => {
    return await api.get('auth/password_available');
  },
  setPassword: async (password) => {
    return await api.post('/auth/set_password', null, { params: { password }, withCredentials: true });
  },
  me: () => "orc_client"  // there is only a password, so the user is always orc_client
}
