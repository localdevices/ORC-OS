import api from '../../api/api.js'

export const getCallbackUrl= async () => {
  const response = await api.get('/callback_url/');
  if (response.data != null) {
    const received_data = {
      "url": response.data.url,
      "user": '',
      "password": '',
      "retry_timeout": response.data.retry_timeout,
      "remote_site_id": response.data.remote_site_id,
      "createdAt": response.data.created_at,
      "tokenRefresh": response.data.token_refresh,
      "tokenAccess": response.data.token_access,
      "tokenExpiration": response.data.token_expiration
    }
    return received_data
  }
}
