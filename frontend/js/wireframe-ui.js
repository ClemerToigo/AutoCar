const dialog = document.querySelector('#info-dialog');
if (dialog) {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-info-title]');
    if (!button) return;
    document.querySelector('#info-title').textContent = button.dataset.infoTitle;
    document.querySelector('#info-message').textContent = button.dataset.infoMessage || '';
    dialog.showModal();
  });
}
