import { api, el, showError } from './common.js';
export function createList({ resource, singular, plural, formPage, columns, render, filters, limit }) {
  const table = document.querySelector('#records-body');
  const errorBox = document.querySelector('#page-error');
  const notice = document.querySelector('#page-notice');
  const summary = document.querySelector('#records-summary');
  const pagination = document.querySelector('#pagination');
  const dialog = document.querySelector('#delete-dialog');
  const confirm = document.querySelector('#confirm-delete');
  let currentUser, page = 1, sequence = 0, deleting = null, timer;
  function actions(row) {
    const cell = el('td', 'row-actions');
    const view = el('a', 'action-view', 'Ver'); view.href = `${formPage}?id=${row.id}&modo=ver`; view.setAttribute('aria-label', `Ver ${row.modelo || row.nome}`);
    const edit = el('a', 'action-edit', 'Editar'); edit.href = `${formPage}?id=${row.id}`; edit.setAttribute('aria-label', `Editar ${row.modelo || row.nome}`);
    const remove = el('button', 'action-delete', 'Excluir'); remove.type = 'button'; remove.setAttribute('aria-label', `Excluir ${row.modelo || row.nome}`);
    if (resource === 'usuarios' && row.id === currentUser.id_usuario) { remove.disabled = true; remove.title = 'Você não pode excluir sua própria conta.'; }
    remove.addEventListener('click', () => {
      deleting = row; document.querySelector('#delete-name').textContent = row.modelo || row.nome;
      document.querySelector('#delete-error').hidden = true;
      dialog.showModal();
    });
    cell.append(view, edit, remove); return cell;
  }
  function button(text, target, disabled = false) {
    const node = el('button', target === page && /^\d/.test(text) ? 'page-button current' : 'page-button', text); node.type = 'button'; node.disabled = disabled;
    node.setAttribute('aria-label', text === '←' ? 'Página anterior' : text === '→' ? 'Próxima página' : `Página ${text}`);
    if (target === page && /^\d/.test(text)) node.setAttribute('aria-current', 'page');
    node.addEventListener('click', () => { page = target; load(); }); return node;
  }
  async function load() {
    const requestNumber = ++sequence;
    errorBox.hidden = true; summary.textContent = 'Carregando…';
    document.querySelector('#records-table').setAttribute('aria-busy', 'true');
    const params = new URLSearchParams({ page, limit });
    for (const [name, id] of Object.entries(filters)) { const value = document.querySelector(`#${id}`).value.trim(); if (value) params.set(name, value); }
    try {
      const data = await api(`/${resource}?${params}`);
      if (requestNumber !== sequence) return;
      if (data.page > data.pages) { page = data.pages; return load(); }
      table.replaceChildren();
      if (!data.items.length) { const tr = el('tr'); const td = el('td', 'empty-state', `Nenhum ${singular} encontrado.`); td.colSpan = columns; tr.append(td); table.append(tr); }
      for (const row of data.items) { const tr = render(row); tr.append(actions(row)); table.append(tr); }
      summary.textContent = `${data.total} ${data.total === 1 ? singular : plural} ${data.total === 1 ? 'encontrado' : 'encontrados'}`;
      pagination.replaceChildren(button('←', page - 1, page === 1));
      const first = Math.max(1, Math.min(page - 2, data.pages - 4));
      for (let i = first; i <= Math.min(data.pages, first + 4); i++) pagination.append(button(String(i), i));
      pagination.append(button('→', page + 1, page >= data.pages));
    } catch (error) {
      if (requestNumber !== sequence) return;
      summary.textContent = 'Não foi possível carregar os dados.'; showError(error);
    } finally { if (requestNumber === sequence) document.querySelector('#records-table').setAttribute('aria-busy', 'false'); }
  }
  for (const id of Object.values(filters)) {
    const control = document.querySelector(`#${id}`);
    const schedule = () => { clearTimeout(timer); page = 1; timer = setTimeout(load, control.type === 'search' ? 250 : 0); };
    control.addEventListener(control.type === 'search' ? 'input' : 'change', schedule);
  }
  document.querySelector('#cancel-delete').addEventListener('click', () => dialog.close());
  confirm.addEventListener('click', async () => {
    if (!deleting || confirm.disabled) return;
    confirm.disabled = true; document.querySelector('#cancel-delete').disabled = true;
    try {
      await api(`/${resource}/${deleting.id}`, { method: 'DELETE' }); dialog.close(); deleting = null;
      notice.textContent = `${singular === 'usuário' ? 'Usuário excluído' : 'Veículo excluído'} com sucesso.`; notice.hidden = false;
      await load();
    } catch (error) { showError(error, document.querySelector('#delete-error')); }
    finally { confirm.disabled = false; document.querySelector('#cancel-delete').disabled = false; }
  });
  dialog.addEventListener('cancel', (event) => { if (confirm.disabled) event.preventDefault(); });
  return async (user) => {
    currentUser = user;
    const flash = new URLSearchParams(location.search).get('sucesso');
    if (flash === 'criado' || flash === 'atualizado') { notice.textContent = `${singular === 'usuário' ? 'Usuário' : 'Veículo'} ${flash} com sucesso.`; notice.hidden = false; }
    await load();
  };
}
