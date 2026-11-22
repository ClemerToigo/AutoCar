import { initAdmin, api, showError } from './common.js';
const params = new URLSearchParams(location.search);
const id = params.get('id'); const readonly = params.get('modo') === 'ver';
const form = document.querySelector('#record-form');
const fieldset = document.querySelector('#form-fields');
const submit = document.querySelector('#save-record');
const errorBox = document.querySelector('#page-error');
const field = (name) => form.elements.namedItem(name);
initAdmin(async () => {
  const title = readonly ? 'Visualizar Marca' : id ? 'Editar Marca' : 'Cadastrar Marca';
  document.querySelector('#page-title').textContent = title; document.title = `${title} | AutoCar`;
  if (id) field('nome').value = (await api(`/marcas/${encodeURIComponent(id)}`)).nome ?? '';
  if (readonly) { fieldset.disabled = true; submit.hidden = true; document.querySelector('#cancel-record').textContent = 'Voltar'; }
});
form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (readonly || submit.disabled) return;
  errorBox.hidden = true;
  fieldset.disabled = true; submit.disabled = true; submit.textContent = 'Salvando…';
  try {
    await api(`/marcas${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body: { nome: field('nome').value } });
    location.assign(`/pages/admin/marcas.html?sucesso=${id ? 'atualizado' : 'criado'}`);
  } catch (error) { showError(error); }
  finally { fieldset.disabled = false; submit.disabled = false; submit.textContent = 'Salvar marca'; }
});
