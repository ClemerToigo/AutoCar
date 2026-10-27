import { clearSession, getToken, goToLogin, request } from '../auth.js';

const content = document.querySelector('#account-content');
const status = document.querySelector('#session-status');
const errorMessage = document.querySelector('#session-error');
const retry = document.querySelector('#retry-session');
let checking = false;

document.querySelector('#logout').addEventListener('click', () => {
  clearSession();
  content.hidden = true;
  goToLogin();
});

async function validateSession() {
  if (checking) return;
  checking = true;
  content.hidden = true;
  status.hidden = false;
  errorMessage.hidden = true;
  retry.hidden = true;
  if (!getToken()) { goToLogin(); return; }
  try {
    const user = await request('/me');
    if (user.tipo !== 'ADMIN') {
      errorMessage.textContent = 'Acesso restrito a administradores.';
      errorMessage.hidden = false;
      return;
    }
    for (const element of document.querySelectorAll('[data-user-name]')) element.textContent = user.nome;
    for (const element of document.querySelectorAll('[data-user-role]')) element.textContent = 'Administrador';
    for (const element of document.querySelectorAll('[data-user-initials]')) element.textContent = user.nome.trim().charAt(0).toUpperCase();
    document.querySelector('#profile-menu').dataset.infoMessage = `${user.nome}\n${user.login}\nAdministrador`;
    content.hidden = false;
  } catch (error) {
    if (error.status === 401) { goToLogin(true); return; }
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    retry.hidden = false;
  } finally {
    status.hidden = true;
    checking = false;
  }
}

retry.addEventListener('click', validateSession);
window.addEventListener('pageshow', validateSession);
window.addEventListener('pagehide', () => { content.hidden = true; });
window.addEventListener('storage', (event) => { if (event.key === 'autocar.token') validateSession(); });
