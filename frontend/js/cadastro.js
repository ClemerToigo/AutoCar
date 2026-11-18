import { request } from './auth.js';

const form = document.querySelector('#registration-form');
const password = document.querySelector('#senha');
const confirmation = document.querySelector('#confirmar-senha');
const submit = document.querySelector('#registration-submit');
const errorMessage = document.querySelector('#registration-error');
const status = document.querySelector('#registration-status');

function checkPasswords() {
  confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? 'As senhas não conferem.' : '');
}
password.addEventListener('input', checkPasswords);
confirmation.addEventListener('input', checkPasswords);
for (const name of ['cpf', 'telefone']) {
  const input = form.elements.namedItem(name);
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 11);
    input.value = name === 'cpf'
      ? digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      : digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2');
  });
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  checkPasswords();
  if (!form.reportValidity()) return;
  errorMessage.hidden = true;
  const body = Object.fromEntries(['nome', 'cpf', 'telefone', 'email', 'senha', 'confirmar_senha'].map((name) => [name, form.elements.namedItem(name).value]));
  body.aceite_termos = document.querySelector('#aceite-termos').checked;
  form.setAttribute('aria-busy', 'true');
  for (const control of form.elements) control.disabled = true;
  submit.textContent = 'Criando conta…'; status.textContent = 'Salvando seu cadastro…';
  try {
    await request('/register', { method: 'POST', body, authenticated: false });
    form.reset();
    window.location.assign('/pages/login.html?cadastro=sucesso');
  } catch (error) {
    errorMessage.textContent = error.message || 'Não foi possível criar sua conta. Tente novamente.';
    errorMessage.hidden = false; errorMessage.focus();
  } finally {
    form.setAttribute('aria-busy', 'false');
    for (const control of form.elements) control.disabled = false;
    submit.textContent = 'Criar conta'; status.textContent = '';
  }
});
