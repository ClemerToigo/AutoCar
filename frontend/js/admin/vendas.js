import { initAdmin, el, money, date, badge } from './common.js';
import { createList } from './list.js';
import { statusLabel, statusColor, paymentLabel } from './venda-labels.js';
initAdmin(createList({ resource: 'vendas', singular: 'venda', plural: 'vendas', feminine: true, formPage: '/pages/admin/venda-form.html', columns: 8, limit: 8,
  filters: { q: 'search', periodo: 'filter-period', status: 'filter-status' },
  deleteLabel: 'Cancelar', labelOf: (sale) => sale.numero,
  canEdit: (sale) => sale.status !== 'CANCELADA', canDelete: (sale) => sale.status !== 'CANCELADA',
  messages: { criado: 'Venda registrada com sucesso.', atualizado: 'Venda atualizada com sucesso.', excluido: 'Venda cancelada com sucesso.' },
  render(sale) {
    const tr = el('tr');
    const status = el('td'); status.append(badge(statusLabel[sale.status], statusColor[sale.status]));
    tr.append(el('td', 'model-cell', sale.numero), el('td', '', sale.cliente.nome), el('td', '', `${sale.veiculo.marca.nome} ${sale.veiculo.modelo} ${sale.veiculo.ano}`),
      el('td', '', date(sale.created_at)), el('td', 'price-cell', money(sale.valor_total)), el('td', '', paymentLabel[sale.forma_pagamento]), status);
    return tr;
  },
}));
