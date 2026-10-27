const TOKEN_KEY = 'autocar.token';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function saveToken(token, remember) {
  clearSession();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export async function request(path, { method = 'GET', body, authenticated = true } = {}) {
  const token = authenticated ? getToken() : null;
  let response;
  try {
    response = await fetch(`/api/auth${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao AutoCar. Verifique sua conexão e tente novamente.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (authenticated && response.status === 401) clearSession();
    throw new ApiError(data.message || 'Não foi possível concluir a solicitação.', response.status);
  }
  return data;
}

export function goToLogin(expired = false) {
  window.location.replace(`/pages/login.html${expired ? '?motivo=expirada' : ''}`);
}
