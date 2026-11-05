import { initAdmin, api, el, picture, money, badge, statusLabel } from './common.js';
initAdmin(async () => {
  const data = await api('/painel');
  for (const [id, value] of [['metric-total', data.total], ['metric-available', data.disponiveis], ['metric-sold', data.vendidos], ['metric-clients', data.clientes]]) document.querySelector(`#${id}`).textContent = value;
  document.querySelector('#note-total').textContent = `+${data.novosVeiculos} este mês`;
  document.querySelector('#note-available').textContent = `${data.total ? Math.round(data.disponiveis / data.total * 100) : 0}% do total`;
  document.querySelector('#note-sold').textContent = 'Status no estoque';
  document.querySelector('#note-clients').textContent = `+${data.novosClientes} este mês`;
  const list = document.querySelector('#recent-vehicles-list'); list.replaceChildren();
  if (!data.recentes.length) list.append(el('li', 'empty-recent', 'Nenhum veículo cadastrado.'));
  for (const vehicle of data.recentes) {
    const row = el('li'); const details = el('div', 'vehicle-detail');
    details.append(el('p', '', `${vehicle.marca.nome} ${vehicle.modelo}`), el('span', '', `${vehicle.ano} · ${money(vehicle.preco)}`));
    row.append(picture(vehicle.foto), details, badge(statusLabel[vehicle.status], { DISPONIVEL: 'green', RESERVADO: 'yellow', VENDIDO: 'gray' }[vehicle.status])); list.append(row);
  }
});
