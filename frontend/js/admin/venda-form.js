import { initAdmin, api, showError, el, money } from './common.js';
const params = new URLSearchParams(location.search);
const id = params.get('id'); const viewMode = params.get('modo') === 'ver';
const form = document.querySelector('#record-form');
const fieldset = document.querySelector('#form-fields');
const submit = document.querySelector('#save-record');
const errorBox = document.querySelector('#page-error');
const notice = document.querySelector('#page-notice');
const servicesBox = document.querySelector('#service-options');
const submitLabel = id ? 'Salvar venda' : 'Finalizar venda';
const field = (name) => form.elements.namedItem(name);
const prices = new Map(); // id do serviço -> preço usado no cálculo do total
let current = null, vehicles = [], readonly = viewMode, priceTouched = false;
const cents = (value) => Math.round(Number(value || 0) * 100);
const selected = () => [...servicesBox.querySelectorAll('input:checked')].map((box) => Number(box.value));
function fill(select, items, label) {
  const placeholder = el('option', '', 'Selecionar…'); placeholder.value = ''; select.replaceChildren(placeholder);
  for (const item of items) { const option = el('option', '', label(item)); option.value = item.id; select.append(option); }
}
function updateTotals() {
  const services = selected().reduce((sum, serviceId) => sum + cents(prices.get(serviceId)), 0);
  field('valor_servicos').value = money(services / 100);
  field('valor_total').value = money((cents(field('valor_veiculo').value) + services) / 100);
}
function renderServices(list, chosen) {
  servicesBox.replaceChildren(); prices.clear();
  if (!list.length) { servicesBox.append(el('p', 'service-empty', 'Nenhum serviço ativo cadastrado.')); return; }
  for (const service of list) {
    prices.set(service.id, service.preco);
    const label = el('label', 'service-option'); const box = el('input'); box.type = 'checkbox'; box.value = service.id; box.checked = chosen.has(service.id);
    const text = el('div'); text.append(el('strong', '', service.nome), el('span', '', money(service.preco)));
    box.addEventListener('change', updateTotals); label.append(box, text); servicesBox.append(label);
  }
}
field('veiculo_id').addEventListener('change', () => {
  const vehicle = vehicles.find((item) => String(item.id) === field('veiculo_id').value);
  if (vehicle?.preco && !priceTouched) field('valor_veiculo').value = vehicle.preco;
  updateTotals();
});
field('valor_veiculo').addEventListener('input', () => { priceTouched = true; updateTotals(); });
initAdmin(async () => {
  const options = await api('/vendas/opcoes');
  current = id ? await api(`/vendas/${encodeURIComponent(id)}`) : null;
  readonly = viewMode || current?.status === 'CANCELADA';
  const title = viewMode ? 'Visualizar Venda' : id ? 'Editar Venda' : 'Registrar Venda';
  document.querySelector('#page-title').textContent = title; document.title = `${title} | AutoCar`;
  let clients = options.clientes; vehicles = options.veiculos;
  if (current && !clients.some((client) => client.id === current.cliente.id)) clients = [current.cliente, ...clients];
  if (current && !vehicles.some((vehicle) => vehicle.id === current.veiculo.id)) vehicles = [current.veiculo, ...vehicles];
  fill(field('cliente_id'), clients, (client) => `${client.nome} (${client.email})`);
  fill(field('veiculo_id'), vehicles, (vehicle) => `${vehicle.marca.nome} ${vehicle.modelo} ${vehicle.ano}`);
  // Serviços que a venda já tem mantêm o preço cobrado; os demais usam o preço atual.
  const list = new Map(options.servicos.map((service) => [service.id, service]));
  for (const service of current?.servicos || []) list.set(service.id, service);
  renderServices([...list.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), new Set((current?.servicos || []).map((service) => service.id)));
  if (current) {
    field('cliente_id').value = current.cliente.id; field('veiculo_id').value = current.veiculo.id;
    field('valor_veiculo').value = current.valor_veiculo; field('forma_pagamento').value = current.forma_pagamento; field('status').value = current.status;
    field('veiculo_id').disabled = true; document.querySelector('#vehicle-note').hidden = readonly;
  } else field('status').value = 'EM_NEGOCIACAO';
  updateTotals();
  if (readonly) {
    fieldset.disabled = true; submit.hidden = true; document.querySelector('#cancel-record').textContent = 'Voltar';
    if (current?.status === 'CANCELADA' && !viewMode) { notice.textContent = 'Esta venda está cancelada e não pode ser alterada.'; notice.hidden = false; }
  }
});
form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (readonly || submit.disabled) return;
  errorBox.hidden = true;
  const body = {
    cliente_id: field('cliente_id').value, veiculo_id: field('veiculo_id').value, valor_veiculo: field('valor_veiculo').value,
    servicos: selected(), forma_pagamento: field('forma_pagamento').value, status: field('status').value,
  };
  if (current) body.versao = current.versao;
  fieldset.disabled = true; submit.disabled = true; submit.textContent = 'Salvando…';
  try {
    await api(`/vendas${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body });
    location.assign(`/pages/admin/vendas.html?sucesso=${id ? 'atualizado' : 'criado'}`);
  } catch (error) { showError(error); }
  finally { fieldset.disabled = false; submit.disabled = false; submit.textContent = submitLabel; }
});
