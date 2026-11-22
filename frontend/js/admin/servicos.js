import { initAdmin, el, money, date, badge } from './common.js';
import { createList } from './list.js';
initAdmin(createList({ resource: 'servicos', singular: 'serviço', plural: 'serviços', formPage: '/pages/admin/servico-form.html', columns: 6, limit: 8,
  filters: { q: 'search', status: 'filter-status' },
  messages: { criado: 'Serviço criado com sucesso.', atualizado: 'Serviço atualizado com sucesso.', excluido: 'Serviço excluído com sucesso.' },
  render(service) {
    const tr = el('tr');
    const description = el('td', 'service-description', service.descricao || '—'); description.title = service.descricao || '';
    const status = el('td'); status.append(badge(service.ativo ? 'Ativo' : 'Inativo', service.ativo ? 'green' : 'gray'));
    tr.append(el('td', 'model-cell', service.nome), description, el('td', 'price-cell', money(service.preco)), status, el('td', 'date-cell', date(service.created_at)));
    return tr;
  },
}));
