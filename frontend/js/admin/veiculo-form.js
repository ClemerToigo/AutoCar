import { initAdmin, api, showError, el, picture } from './common.js';
const params = new URLSearchParams(location.search);
const id = params.get('id'); const readonly = params.get('modo') === 'ver';
const form = document.querySelector('#record-form'); const fieldset = document.querySelector('#form-fields');
const submit = document.querySelector('#save-record'); const errorBox = document.querySelector('#page-error');
const mainInput = document.querySelector('#photo-input'); const galleryInput = document.querySelector('#gallery-input');
let current = null, mainFile = null, mainURL = null, removeMain = false, retained = [], additions = [];
const field = (name) => form.elements.namedItem(name);
function validateFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Selecione uma foto JPG, PNG ou WEBP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Cada foto pode ter no máximo 5 MB.');
}
function mainPreview() {
  const target = document.querySelector('#main-photo');
  target.src = mainURL || (!removeMain && current?.foto) || '/assets/images/veiculos/sem-foto.svg';
  document.querySelector('#remove-main').hidden = readonly || (!mainFile && (!current?.foto || removeMain));
}
function galleryPreview() {
  const container = document.querySelector('#gallery-list'); container.replaceChildren();
  for (const [type, items] of [['retained', retained], ['new', additions]]) for (const [index, item] of items.entries()) {
    const card = el('div', 'gallery-item');
    const image = type === 'retained' ? picture(item) : el('img'); if (type === 'new') image.src = item.url;
    image.alt = `Foto ${index + 1} da galeria`; card.append(image);
    if (!readonly) {
      const button = el('button', 'remove-photo', '×'); button.type = 'button'; button.setAttribute('aria-label', `Remover foto ${index + 1} ${type === 'new' ? 'nova' : 'da galeria'}`);
      button.addEventListener('click', () => { if (type === 'retained') retained.splice(index, 1); else { URL.revokeObjectURL(additions[index].url); additions.splice(index, 1); } galleryPreview(); });
      card.append(button);
    }
    container.append(card);
  }
  document.querySelector('#add-gallery').disabled = retained.length + additions.length >= 6;
}
document.querySelector('#choose-main').addEventListener('click', () => mainInput.click());
document.querySelector('#add-gallery').addEventListener('click', () => galleryInput.click());
document.querySelector('#remove-main').addEventListener('click', () => { if (mainURL) URL.revokeObjectURL(mainURL); mainURL = null; mainFile = null; removeMain = true; mainInput.value = ''; mainPreview(); });
mainInput.addEventListener('change', () => {
  const file = mainInput.files[0]; if (!file) return;
  try { validateFile(file); if (mainURL) URL.revokeObjectURL(mainURL); mainFile = file; mainURL = URL.createObjectURL(file); removeMain = false; mainPreview(); errorBox.hidden = true; }
  catch (error) { showError(error); } finally { mainInput.value = ''; }
});
galleryInput.addEventListener('change', () => {
  try {
    const files = [...galleryInput.files]; if (retained.length + additions.length + files.length > 6) throw new Error('A galeria permite no máximo 6 fotos.');
    files.forEach(validateFile); additions.push(...files.map((file) => ({ file, url: URL.createObjectURL(file) }))); galleryPreview(); errorBox.hidden = true;
  } catch (error) { showError(error); } finally { galleryInput.value = ''; }
});
initAdmin(async () => {
  const title = readonly ? 'Visualizar Veículo' : id ? 'Editar Veículo' : 'Cadastrar Veículo';
  document.querySelector('#page-title').textContent = title; document.title = `${title} | AutoCar`;
  const options = await api('/veiculos/opcoes');
  for (const [name, items] of [['marca_id', options.marcas], ['categoria_id', options.categorias]]) {
    const placeholder = el('option', '', 'Selecionar…'); placeholder.value = ''; field(name).replaceChildren(placeholder);
    for (const item of items) { const option = el('option', '', item.nome); option.value = item.id; field(name).append(option); }
  }
  field('ano').max = new Date().getFullYear() + 1;
  if (id) {
    current = await api(`/veiculos/${encodeURIComponent(id)}`);
    for (const name of ['marca_id', 'categoria_id', 'modelo', 'ano', 'quilometragem', 'preco', 'combustivel', 'cambio', 'cor', 'status', 'descricao']) field(name).value = current[name];
    retained = [...current.galeria];
  }
  mainPreview(); galleryPreview();
  if (readonly) {
    fieldset.disabled = true; submit.hidden = true; document.querySelector('#cancel-record').textContent = 'Voltar';
    document.querySelector('#upload-controls').hidden = true; document.querySelector('#add-gallery').hidden = true;
  }
});
form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (readonly || submit.disabled) return;
  errorBox.hidden = true;
  const body = new FormData();
  for (const name of ['marca_id', 'categoria_id', 'modelo', 'ano', 'quilometragem', 'preco', 'combustivel', 'cambio', 'cor', 'status', 'descricao']) body.set(name, field(name).value);
  if (current) body.set('versao', current.versao);
  body.set('galeria_manter', JSON.stringify(retained)); body.set('remover_foto', String(removeMain));
  if (mainFile) body.set('foto', mainFile);
  for (const item of additions) body.append('galeria', item.file);
  fieldset.disabled = true; submit.disabled = true; submit.textContent = 'Salvando…';
  try {
    await api(`/veiculos${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body });
    location.assign(`/pages/admin/veiculos.html?sucesso=${id ? 'atualizado' : 'criado'}`);
  } catch (error) { showError(error); }
  finally { fieldset.disabled = false; submit.disabled = false; submit.textContent = 'Salvar veículo'; galleryPreview(); }
});
window.addEventListener('unload', () => { if (mainURL) URL.revokeObjectURL(mainURL); for (const item of additions) URL.revokeObjectURL(item.url); });
