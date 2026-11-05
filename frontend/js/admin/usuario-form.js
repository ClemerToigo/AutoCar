import { initAdmin, api, showError, digits } from './common.js';
import { clearSession, goToLogin } from '../auth.js';
const params = new URLSearchParams(location.search);
const id = params.get('id'); const readonly = params.get('modo') === 'ver';
const form = document.querySelector('#record-form');
const fieldset = document.querySelector('#form-fields');
const submit = document.querySelector('#save-record');
const errorBox = document.querySelector('#page-error');
let current = null, actor = null;
const field = (name) => form.elements.namedItem(name);
function reconcile() {
  fieldset.disabled = readonly;
  if (id && actor && Number(id) === actor.id_usuario) { field('tipo').disabled = true; field('ativo').disabled = true; document.querySelector('#self-note').hidden = readonly; }
}
for (const name of ['cpf', 'telefone']) field(name).addEventListener('input', () => {
  const d = digits(field(name).value).slice(0, 11);
  field(name).value = name === 'cpf' ? d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,2})$/, '$1-$2') : d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2');
});
initAdmin(async (user) => {
  actor = user;
  const title = readonly ? 'Visualizar Usuário' : id ? 'Editar Usuário' : 'Cadastrar Usuário';
  document.querySelector('#page-title').textContent = title; document.title = `${title} | AutoCar`;
  if (id) {
    current = await api(`/usuarios/${encodeURIComponent(id)}`);
    for (const name of ['nome', 'email', 'cpf', 'telefone', 'tipo']) field(name).value = current[name] || '';
    field('ativo').value = String(current.ativo);
    for (const name of ['cpf', 'telefone']) field(name).dispatchEvent(new Event('input'));
    field('senha').required = false;
    document.querySelector('#password-label').textContent = 'Nova senha';
    document.querySelector('#password-note').hidden = readonly;
    if (readonly) document.querySelector('#password-field').hidden = true;
  }
  if (readonly) { submit.hidden = true; document.querySelector('#cancel-record').textContent = 'Voltar'; }
  reconcile();
});
form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (readonly || submit.disabled) return;
  errorBox.hidden = true;
  const body = Object.fromEntries(['nome', 'email', 'cpf', 'telefone', 'tipo', 'senha'].map((name) => [name, field(name).value]));
  body.ativo = field('ativo').value === 'true'; if (current) body.versao = current.versao;
  fieldset.disabled = true; submit.disabled = true; submit.textContent = 'Salvando…';
  try {
    await api(`/usuarios${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body });
    if (current && current.id === actor.id_usuario && (body.senha || body.email.trim().toLowerCase() !== current.email)) { clearSession(); goToLogin(true); return; }
    location.assign(`/pages/admin/usuarios.html?sucesso=${id ? 'atualizado' : 'criado'}`);
  } catch (error) { showError(error); }
  finally { submit.disabled = false; submit.textContent = 'Salvar usuário'; reconcile(); }
});
