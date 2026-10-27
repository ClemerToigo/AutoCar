import { ApiError, getToken, request, saveToken } from './auth.js';

const form = document.querySelector('#login-form');
const email = document.querySelector('#email');
const password = document.querySelector('#senha');
const submit = document.querySelector('#login-submit');
const label = document.querySelector('#submit-label');
const errorMessage = document.querySelector('#login-error');
const status = document.querySelector('#login-status');
const dashboard = '/pages/admin/dashboard.html';

function setBusy(busy, message = '') {
  form.setAttribute('aria-busy', String(busy));
  for (const control of form.elements) control.disabled = busy;
  label.textContent = busy ? 'Aguarde…' : 'Entrar';
  status.textContent = message;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  errorMessage.hidden = true;
  const body = { login: email.value.trim(), senha: password.value };
  const remember = document.querySelector('#remember').checked;
  setBusy(true, 'Verificando seu acesso…');
  try {
    const data = await request('/login', { method: 'POST', body, authenticated: false });
    saveToken(data.token, remember);
    password.value = '';
    window.location.replace(dashboard);
  } catch (error) {
    showError(error instanceof ApiError ? error.message : 'Não foi possível guardar sua sessão. Permita o armazenamento do site e tente novamente.');
    if (error.status === 401) password.value = '';
  } finally {
    setBusy(false);
  }
});

async function restoreSession() {
  if (new URLSearchParams(window.location.search).get('motivo') === 'expirada') {
    showError('Sua sessão expirou. Entre novamente para continuar.');
  }
  if (!getToken()) return;
  setBusy(true, 'Verificando sua sessão…');
  try {
    await request('/me');
    window.location.replace(dashboard);
  } catch (error) {
    showError(error.status === 401 ? 'Sua sessão expirou. Entre novamente para continuar.' : error.message);
  } finally {
    setBusy(false);
  }
}

restoreSession();
