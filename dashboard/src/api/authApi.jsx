// authentication functions

import api from './api';

// define login, logout and refresh functions
export const authApi = {
  login: async (password) => {
    const response = await api.post('/security/login', null, {
      params: { password },
      withCredentials: true,
    });
    return response;
  },
  logout: () => api.post('/security/logout'), //, {}, {withCredentials: true}),
  refresh: async () => {
    // Refresh the session without handling tokens
    const response = await api.post('/security/refresh', {}, { withCredentials: true });
    return response; // Session cookie maintains authentication state
  },

  // refresh: async () => {
  //   const response = await api.post("security/refresh", {}, {withCredentials: true});
  //   setAccessToken(response.data.access_token);
  //   return response;
  // },
  me: () => "orc_client"  // there is only a password, so the user is always orc_client
}
