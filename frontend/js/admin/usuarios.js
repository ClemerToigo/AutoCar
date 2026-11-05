import { initAdmin, el, phone, date, badge } from './common.js';
import { createList } from './list.js';
initAdmin(createList({ resource: 'usuarios', singular: 'usuário', plural: 'usuários', formPage: '/pages/admin/usuario-form.html', columns: 7, limit: 5,
  filters: { q: 'search', tipo: 'filter-type', status: 'filter-status' },
  render(user) {
    const tr = el('tr'); const name = el('td'); const group = el('div', 'user-cell');
    group.append(el('span', 'table-avatar', user.nome.charAt(0).toUpperCase()), el('strong', '', user.nome)); name.append(group);
    tr.append(name, el('td', '', user.email), el('td', '', phone(user.telefone)));
    const type = el('td'); type.append(badge(user.tipo === 'ADMIN' ? 'Administrador' : 'Cliente', user.tipo === 'ADMIN' ? 'purple' : 'blue'));
    const status = el('td'); status.append(badge(user.ativo ? 'Ativo' : 'Inativo', user.ativo ? 'green' : 'red'));
    tr.append(type, status, el('td', 'date-cell', date(user.created_at))); return tr;
  },
}));
