import { initAdmin, updateIdentity, phone, digits } from './common.js';
import { request, clearSession, goToLogin } from '../auth.js';

const form = document.querySelector('#profile-form');
const field = (name) => form.elements.namedItem(name);
const submit = document.querySelector('#save-profile');
const errorMessage = document.querySelector('#profile-error');
const success = document.querySelector('#profile-success');
let current;
function paint(profile) {
  current = profile;
  updateIdentity(profile);
  field('nome').value = profile.nome; field('email').value = profile.email;
  for (const name of ['senha_atual', 'nova_senha', 'confirmar_senha']) field(name).value = '';
  document.querySelector('#profile-summary-email').textContent = profile.email;
  const cpf = digits(profile.cpf);
  document.querySelector('#profile-cpf').textContent = cpf ? cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : 'Não informado';
  document.querySelector('#profile-phone').textContent = profile.telefone ? phone(profile.telefone) : 'Não informado';
  document.querySelector('#profile-created').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(profile.created_at));
  checkPasswords();
}
function checkPasswords() {
  field('confirmar_senha').required = Boolean(field('nova_senha').value);
  field('confirmar_senha').setCustomValidity(field('confirmar_senha').value !== field('nova_senha').value ? 'A confirmação da nova senha não confere.' : '');
}
field('nova_senha').addEventListener('input', checkPasswords);
field('confirmar_senha').addEventListener('input', checkPasswords);
initAdmin(async () => paint(await request('/profile')));
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled || !current) return;
  checkPasswords(); if (!form.reportValidity()) return;
  errorMessage.hidden = true; success.hidden = true;
  const body = Object.fromEntries(['nome', 'email', 'senha_atual', 'nova_senha', 'confirmar_senha'].map((name) => [name, field(name).value])); body.versao = current.versao;
  document.querySelector('#profile-fields').disabled = true; submit.disabled = true; submit.textContent = 'Salvando…';
  try {
    const response = await request('/profile', { method: 'PUT', body });
    if (response.autenticar_novamente) {
      clearSession(); window.location.replace('/pages/login.html?motivo=dados-atualizados'); return;
    }
    paint(response.usuario); success.textContent = 'Seu perfil foi atualizado com sucesso.'; success.hidden = false; success.focus();
  } catch (error) {
    if (error.status === 401) { goToLogin(true); return; }
    errorMessage.textContent = error.message; errorMessage.hidden = false; errorMessage.focus();
  } finally { document.querySelector('#profile-fields').disabled = false; submit.disabled = false; submit.textContent = 'Salvar alterações'; }
});
