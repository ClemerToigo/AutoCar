import { initAdmin, el } from './common.js';
import { createList } from './list.js';
initAdmin(createList({ resource: 'marcas', singular: 'marca', plural: 'marcas', formPage: '/pages/admin/marca-form.html', columns: 3, limit: 8, feminine: true,
  filters: { q: 'search' },
  messages: { criado: 'Marca criada com sucesso.', atualizado: 'Marca atualizada com sucesso.', excluido: 'Marca excluída com sucesso.' },
  render(row) {
    const tr = el('tr');
    tr.append(el('td', 'model-cell', row.nome), el('td', '', String(row.total_veiculos ?? 0)));
    return tr;
  },
}));
