import { initAdmin, api, el, picture, money, badge, statusLabel, phone, date } from './common.js';
import { goToLogin } from '../auth.js';

const refresh = document.querySelector('#refresh-dashboard');
const refreshError = document.querySelector('#dashboard-error');
let loading = false;

function renderVehicles(vehicles) {
  const list = document.querySelector('#recent-vehicles-list'); list.replaceChildren();
  if (!vehicles.length) list.append(el('li', 'empty-recent', 'Nenhum veículo cadastrado.'));
  for (const vehicle of vehicles) {
    const row = el('li'); const details = el('div', 'vehicle-detail');
    const link = el('a', 'recent-vehicle-link', `${vehicle.marca.nome} ${vehicle.modelo}`);
    link.href = `/pages/admin/veiculo-form.html?id=${vehicle.id}&modo=ver`;
    details.append(link, el('span', '', `${vehicle.ano} · ${money(vehicle.preco)}`));
    row.append(picture(vehicle.foto), details, badge(statusLabel[vehicle.status], { DISPONIVEL: 'green', RESERVADO: 'yellow', VENDIDO: 'gray' }[vehicle.status]));
    list.append(row);
  }
}

function renderCustomers(customers) {
  const body = document.querySelector('#recent-customers-body'); body.replaceChildren();
  if (!customers.length) {
    const row = el('tr'); const empty = el('td', 'dashboard-empty', 'Nenhum cliente cadastrado.'); empty.colSpan = 5; row.append(empty); body.append(row);
  }
  for (const customer of customers) {
    const row = el('tr'); const name = el('td');
    const link = el('a', 'customer-link', customer.nome); link.href = `/pages/admin/usuario-form.html?id=${customer.id}&modo=ver`; name.append(link);
    const status = el('td'); status.append(badge(customer.ativo ? 'Ativo' : 'Inativo', customer.ativo ? 'green' : 'gray'));
    row.append(name, el('td', '', customer.login), el('td', '', phone(customer.telefone)), status, el('td', 'customer-date', date(customer.created_at)));
    body.append(row);
  }
}

function svgElement(name, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function renderChart(months) {
  const graph = document.querySelector('#registrations-chart'); graph.replaceChildren();
  const table = document.querySelector('#chart-data-body'); table.replaceChildren();
  const max = Math.max(1, ...months.flatMap((month) => [month.veiculos, month.clientes]));
  const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  for (const month of months) {
    const label = formatter.format(new Date(`${month.mes}-01T12:00:00Z`)).replace('.', '').replace(' de ', '/');
    const column = el('div', 'registration-column');
    const values = el('div', 'registration-values');
    values.append(el('span', 'vehicle-count', month.veiculos), el('span', 'client-count', month.clientes));
    const svg = svgElement('svg', { viewBox: '0 0 36 122', 'aria-hidden': 'true', class: 'registration-bars' });
    for (const [key, x, className] of [['veiculos', 3, 'vehicle-bar'], ['clientes', 20, 'client-bar']]) {
      const height = month[key] / max * 116;
      svg.append(svgElement('rect', { x, y: 120 - height, width: 13, height, rx: 3, class: className }));
    }
    column.append(values, svg, el('span', 'chart-month', label));
    column.title = `${label}: ${month.veiculos} veículos e ${month.clientes} clientes cadastrados`;
    graph.append(column);
    const row = el('tr'); row.append(el('th', '', label), el('td', '', month.veiculos), el('td', '', month.clientes)); row.firstChild.scope = 'row'; table.append(row);
  }
  const vehicleTotal = months.reduce((sum, month) => sum + month.veiculos, 0);
  const clientTotal = months.reduce((sum, month) => sum + month.clientes, 0);
  document.querySelector('#chart-total').textContent = `${vehicleTotal} ${vehicleTotal === 1 ? 'veículo' : 'veículos'} · ${clientTotal} ${clientTotal === 1 ? 'cliente' : 'clientes'} no período`;
  document.querySelector('#chart-empty').hidden = vehicleTotal + clientTotal !== 0;
}

async function loadDashboard() {
  if (loading) return;
  loading = true; refresh.disabled = true; refresh.textContent = 'Atualizando…'; refreshError.hidden = true;
  document.querySelector('#account-content').setAttribute('aria-busy', 'true');
  try {
    const data = await api('/painel');
    for (const [id, value] of [['metric-total', data.total], ['metric-available', data.disponiveis], ['metric-sold', data.vendidos], ['metric-clients', data.clientes], ['metric-reserved', data.reservados]]) document.querySelector(`#${id}`).textContent = value.toLocaleString('pt-BR');
    document.querySelector('#metric-stock-value').textContent = money(data.valorEstoque);
    document.querySelector('#note-total').textContent = `+${data.novosVeiculos} ${data.novosVeiculos === 1 ? 'cadastrado' : 'cadastrados'} este mês`;
    document.querySelector('#note-available').textContent = `${data.total ? Math.round(data.disponiveis / data.total * 100) : 0}% dos veículos cadastrados`;
    document.querySelector('#note-clients').textContent = `+${data.novosClientes} este mês · ${data.clientesAtivos} ${data.clientesAtivos === 1 ? 'ativo' : 'ativos'}`;
    document.querySelector('#note-reserved').textContent = `${data.total ? Math.round(data.reservados / data.total * 100) : 0}% dos veículos cadastrados`;
    renderVehicles(data.recentes); renderCustomers(data.clientesRecentes); renderChart(data.cadastrosMensais);
    const updated = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: data.fusoHorario });
    document.querySelector('#dashboard-updated').textContent = `Atualizado em ${updated.format(new Date(data.atualizadoEm))} · Brasília`;
  } finally {
    loading = false; refresh.disabled = false; refresh.textContent = 'Atualizar dados';
    document.querySelector('#account-content').setAttribute('aria-busy', 'false');
  }
}

async function refreshDashboard() {
  if (document.querySelector('#account-content').hidden || document.hidden) return;
  try { await loadDashboard(); }
  catch (error) {
    if (error.status === 401) { goToLogin(true); return; }
    if (error.status === 403) {
      document.querySelector('#account-content').hidden = true;
      document.querySelector('#session-error').textContent = error.message;
      document.querySelector('#session-error').hidden = false;
      return;
    }
    refreshError.textContent = `${error.message} Os dados exibidos são da última atualização indicada no painel.`;
    refreshError.hidden = false;
  }
}
refresh.addEventListener('click', refreshDashboard);
window.addEventListener('focus', refreshDashboard);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDashboard(); });
initAdmin(loadDashboard);
