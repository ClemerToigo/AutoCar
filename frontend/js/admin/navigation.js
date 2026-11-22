const sprite = '/assets/images/icones/sprite.svg';
const modules = [
  ['Dashboard', 'grid', '/pages/admin/dashboard.html'],
  ['Veículos', 'car', '/pages/admin/veiculos.html'],
  ['Usuários', 'users', '/pages/admin/usuarios.html'],
  ['Marcas', 'tag', '/pages/admin/marcas.html'], ['Categorias', 'list', '/pages/admin/categorias.html'],
  ['Serviços', 'wrench', '/pages/admin/servicos.html'], ['Vendas', 'dollar', '/pages/admin/vendas.html'],
  ['Clientes/Leads', 'users', null, 'Etapa atribuída à Isadora. Este módulo ainda não está implementado.'],
  ['Avaliação de Veículos', 'list', null, 'Etapa atribuída à Isadora. Este módulo ainda não está implementado.'],
];

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', `${sprite}#${name}`); svg.append(use);
  return svg;
}
function item(label, symbol, href, message) {
  const node = document.createElement(href ? 'a' : 'button'); node.className = 'nav-item';
  node.setAttribute('aria-label', label); node.title = label;
  if (href) {
    node.href = href;
    const active = location.pathname === href || (label === 'Veículos' && location.pathname.endsWith('/veiculo-form.html')) || (label === 'Usuários' && location.pathname.endsWith('/usuario-form.html')) || (label === 'Marcas' && location.pathname.endsWith('/marca-form.html')) || (label === 'Categorias' && location.pathname.endsWith('/categoria-form.html')) || (label === 'Serviços' && location.pathname.endsWith('/servico-form.html')) || (label === 'Vendas' && location.pathname.endsWith('/venda-form.html'));
    if (active) { node.classList.add('active'); node.setAttribute('aria-current', 'page'); }
  } else {
    node.type = 'button'; node.dataset.infoTitle = label;
    node.dataset.infoMessage = message || 'Este módulo ainda não está implementado.';
  }
  const text = document.createElement('span'); text.textContent = label; node.append(icon(symbol), text);
  return node;
}
function linkToProfile(node) {
  if (!node) return;
  if (node.tagName === 'A') { node.href = '/pages/admin/perfil.html'; return; }
  const link = document.createElement('a'); link.className = node.className; if (node.id) link.id = node.id;
  link.href = '/pages/admin/perfil.html'; link.setAttribute('aria-label', 'Abrir meu perfil');
  link.append(...node.childNodes); node.replaceWith(link);
}

export function initAdminNavigation() {
  const nav = document.querySelector('.sidebar-navigation');
  if (nav) { nav.replaceChildren(...modules.map((args) => item(...args))); nav.setAttribute('aria-busy', 'false'); }
  const settings = document.querySelector('.sidebar-settings');
  if (settings) settings.replaceChildren(item('Configurações', 'settings', '/pages/admin/configuracoes.html'));
  linkToProfile(document.querySelector('#profile-menu'));
  linkToProfile(document.querySelector('.sidebar-profile'));
}
