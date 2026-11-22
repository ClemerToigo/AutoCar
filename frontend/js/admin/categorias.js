import { initAdmin, el } from './common.js';
import { createList } from './list.js';
initAdmin(createList({ resource: 'categorias', singular: 'categoria', plural: 'categorias', formPage: '/pages/admin/categoria-form.html', columns: 3, limit: 8, feminine: true,
  filters: { q: 'search' },
  messages: { criado: 'Categoria criada com sucesso.', atualizado: 'Categoria atualizada com sucesso.', excluido: 'Categoria excluída com sucesso.' },
  render(row) {
    const tr = el('tr');
    tr.append(el('td', 'model-cell', row.nome), el('td', '', String(row.total_veiculos ?? 0)));
    return tr;
  },
}));
