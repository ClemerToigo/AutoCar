import { initAdmin, api, showError } from './common.js';
const params = new URLSearchParams(location.search);
const id = params.get('id'); const readonly = params.get('modo') === 'ver';
const form = document.querySelector('#record-form');
const fieldset = document.querySelector('#form-fields');
const submit = document.querySelector('#save-record');
const errorBox = document.querySelector('#page-error');
let current = null;
const field = (name) => form.elements.namedItem(name);
initAdmin(async () => {
  const title = readonly ? 'Visualizar Serviço' : id ? 'Editar Serviço' : 'Cadastrar Serviço';
  document.querySelector('#page-title').textContent = title; document.title = `${title} | AutoCar`;
  if (id) {
    current = await api(`/servicos/${encodeURIComponent(id)}`);
    for (const name of ['nome', 'preco', 'descricao']) field(name).value = current[name] ?? '';
    field('ativo').value = String(current.ativo);
  }
  if (readonly) { fieldset.disabled = true; submit.hidden = true; document.querySelector('#cancel-record').textContent = 'Voltar'; }
});
form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (readonly || submit.disabled) return;
  errorBox.hidden = true;
  const body = Object.fromEntries(['nome', 'preco', 'descricao'].map((name) => [name, field(name).value]));
  body.ativo = field('ativo').value === 'true'; if (current) body.versao = current.versao;
  fieldset.disabled = true; submit.disabled = true; submit.textContent = 'Salvando…';
  try {
    await api(`/servicos${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body });
    location.assign(`/pages/admin/servicos.html?sucesso=${id ? 'atualizado' : 'criado'}`);
  } catch (error) { showError(error); }
  finally { fieldset.disabled = false; submit.disabled = false; submit.textContent = 'Salvar serviço'; }
});
