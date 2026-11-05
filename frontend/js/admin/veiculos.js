import { initAdmin, api, el, picture, money, badge, statusLabel } from './common.js';
import { createList } from './list.js';
const list = createList({ resource: 'veiculos', singular: 'veículo', plural: 'veículos', formPage: '/pages/admin/veiculo-form.html', columns: 9, limit: 8,
  filters: { q: 'search', marca_id: 'filter-brand', categoria_id: 'filter-category', status: 'filter-status' },
  render(vehicle) {
    const tr = el('tr'); const photo = el('td', 'vehicle-photo'); photo.append(picture(vehicle.foto));
    const status = el('td'); status.append(badge(statusLabel[vehicle.status], { DISPONIVEL: 'green', RESERVADO: 'yellow', VENDIDO: 'gray' }[vehicle.status]));
    tr.append(photo, el('td', 'model-cell', vehicle.modelo), el('td', '', vehicle.marca.nome), el('td', '', vehicle.categoria.nome), el('td', '', vehicle.ano), el('td', '', `${vehicle.quilometragem.toLocaleString('pt-BR')} km`), el('td', 'price-cell', money(vehicle.preco)), status); return tr;
  },
});
let loaded = false;
initAdmin(async (user) => {
  if (!loaded) {
    const options = await api('/veiculos/opcoes');
    for (const [id, items] of [['filter-brand', options.marcas], ['filter-category', options.categorias]]) {
      const select = document.querySelector(`#${id}`);
      for (const item of items) { const option = el('option', '', item.nome); option.value = item.id; select.append(option); }
    }
    loaded = true;
  }
  await list(user);
});
