import { getToken, request, clearSession, goToLogin } from './auth.js';
const content = document.querySelector('#account-content');
const status = document.querySelector('#session-status');
const errorMessage = document.querySelector('#session-error');
const retry = document.querySelector('#retry-session');
let checking = false;
document.querySelector('#logout').addEventListener('click', () => { clearSession(); content.hidden = true; goToLogin(); });
async function validateSession() {
  if (checking) return;
  checking = true; content.hidden = true; status.hidden = false; errorMessage.hidden = true; retry.hidden = true;
  try {
    if (!getToken()) { goToLogin(); return; }
    const user = await request('/me');
    if (user.tipo === 'ADMIN') { window.location.replace('/pages/admin/dashboard.html'); return; }
    document.querySelector('#user-name').textContent = user.nome;
    document.querySelector('#user-email').textContent = user.login;
    content.hidden = false;
  } catch (error) {
    if (error.status === 401) { goToLogin(true); return; }
    errorMessage.textContent = error.message; errorMessage.hidden = false; retry.hidden = false;
  } finally { status.hidden = true; checking = false; }
}
retry.addEventListener('click', validateSession);
window.addEventListener('pageshow', validateSession);
window.addEventListener('pagehide', () => { content.hidden = true; });
window.addEventListener('storage', (event) => { if (event.key === 'autocar.token') validateSession(); });
if (document.readyState === 'complete') validateSession();
