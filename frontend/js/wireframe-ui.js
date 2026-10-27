const dialog = document.querySelector('#info-dialog');
if (dialog) {
  for (const button of document.querySelectorAll('[data-info-title]')) {
    button.addEventListener('click', () => {
      document.querySelector('#info-title').textContent = button.dataset.infoTitle;
      document.querySelector('#info-message').textContent = button.dataset.infoMessage || '';
      dialog.showModal();
    });
  }
}
