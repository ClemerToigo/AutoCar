import { initAdmin } from './common.js';
import { request, clearSession, goToLogin } from '../auth.js';

let current;
const themeStatus = document.querySelector('#theme-status');
function showTheme() {
  for (const radio of document.querySelectorAll('input[name="theme"]')) radio.checked = radio.value === window.AutoCarTheme.get();
}
showTheme();
window.addEventListener('autocar-theme-change', showTheme);
window.addEventListener('storage', (event) => { if (event.key === 'autocar.theme' || event.key === null) showTheme(); });
for (const radio of document.querySelectorAll('input[name="theme"]')) radio.addEventListener('change', () => {
  if (!radio.checked) return;
  const saved = window.AutoCarTheme.set(radio.value);
  themeStatus.textContent = saved ? `Tema ${radio.value === 'dark' ? 'escuro' : 'claro'} salvo neste navegador.` : 'Tema aplicado nesta aba. O navegador não permitiu salvar a preferência.';
});

initAdmin(async () => {
  current = await request('/profile');
  document.querySelector('#settings-email').textContent = current.email;
  document.querySelector('#settings-role').textContent = current.tipo === 'ADMIN' ? 'Administrador' : 'Cliente';
  document.querySelector('#open-close-account').disabled = !current.pode_encerrar;
  const block = document.querySelector('#close-account-block'); block.hidden = current.pode_encerrar;
  block.textContent = current.motivo_bloqueio || '';
});

for (const [name, endpoint, reason] of [['sessions', '/logout-all', 'sessoes-encerradas'], ['close', '/close-account', 'conta-encerrada']]) {
  const dialog = document.querySelector(`#${name}-dialog`);
  const form = document.querySelector(`#${name}-form`);
  const submit = document.querySelector(`#${name}-submit`);
  const cancel = document.querySelector(`#${name}-cancel`);
  const errorBox = document.querySelector(`#${name}-error`);
  document.querySelector(name === 'sessions' ? '#open-sessions' : '#open-close-account').addEventListener('click', () => {
    if (!current || (name === 'close' && !current.pode_encerrar)) return;
    form.reset(); errorBox.hidden = true; dialog.showModal();
  });
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => { if (submit.disabled) event.preventDefault(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (submit.disabled || !current) return;
    const body = { senha_atual: form.elements.namedItem('senha_atual').value, versao: current.versao };
    if (name === 'close') body.confirmacao = form.elements.namedItem('confirmacao').value;
    errorBox.hidden = true;
    for (const control of form.elements) control.disabled = true;
    try {
      await request(endpoint, { method: 'POST', body });
      clearSession(); window.location.replace(`/pages/login.html?motivo=${reason}`);
    } catch (error) {
      if (error.status === 401) { goToLogin(true); return; }
      errorBox.textContent = error.message; errorBox.hidden = false; errorBox.focus();
    } finally { for (const control of form.elements) control.disabled = false; }
  });
}
