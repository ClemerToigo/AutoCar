import { request, getToken, clearSession, goToLogin } from '../auth.js';
export const api = (path, options = {}) => request(path, { ...options, base: '/api' });
export const money = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const date = (value) => new Date(value).toLocaleDateString('pt-BR');
export const digits = (value) => String(value || '').replace(/\D/g, '');
export const phone = (value) => { const d = digits(value); return d ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : '—'; };
export const statusLabel = { DISPONIVEL: 'Disponível', RESERVADO: 'Reservado', VENDIDO: 'Vendido' };
export function el(tag, className = '', text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
export function picture(path, alt = '') {
  const image = el('img'); image.alt = alt;
  image.src = /^\/media\/[a-f0-9-]{36}\.webp$/.test(path || '') ? path : '/assets/images/veiculos/sem-foto.svg';
  image.addEventListener('error', () => { image.src = '/assets/images/veiculos/sem-foto.svg'; }, { once: true });
  return image;
}
export function badge(label, color) { return el('span', `status-badge ${color}`, label); }
export function showError(error, target = document.querySelector('#page-error')) {
  if (error.status === 401) { goToLogin(true); return; }
  target.textContent = error.message || 'Não foi possível concluir a solicitação.';
  target.hidden = false;
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
export function initAdmin(load = async () => {}) {
  const content = document.querySelector('#account-content');
  const status = document.querySelector('#session-status');
  const errorMessage = document.querySelector('#session-error');
  const retry = document.querySelector('#retry-session');
  let checking = false;
  document.querySelector('#logout').addEventListener('click', () => { clearSession(); content.hidden = true; goToLogin(); });
  async function validate() {
    if (checking) return;
    checking = true; content.hidden = true; status.hidden = false; errorMessage.hidden = true; retry.hidden = true;
    try {
      if (!getToken()) { goToLogin(); return; }
      const user = await request('/me');
      if (user.tipo !== 'ADMIN') throw Object.assign(new Error('Acesso restrito a administradores.'), { status: 403 });
      for (const node of document.querySelectorAll('[data-user-name]')) node.textContent = user.nome;
      for (const node of document.querySelectorAll('[data-user-role]')) node.textContent = 'Administrador';
      for (const node of document.querySelectorAll('[data-user-initials]')) node.textContent = user.nome.trim().charAt(0).toUpperCase();
      document.querySelector('#profile-menu').dataset.infoMessage = `${user.nome}\n${user.login}\nAdministrador`;
      await load(user);
      content.hidden = false;
    } catch (error) {
      if (error.status === 401) { goToLogin(true); return; }
      errorMessage.textContent = error.message; errorMessage.hidden = false; retry.hidden = error.status === 403;
    } finally { status.hidden = true; checking = false; }
  }
  retry.addEventListener('click', validate);
  window.addEventListener('pageshow', validate);
  window.addEventListener('pagehide', () => { content.hidden = true; });
  window.addEventListener('storage', (event) => { if (event.key === 'autocar.token') validate(); });
  if (document.readyState === 'complete') validate();
}
