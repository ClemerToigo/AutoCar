(() => {
  const key = 'autocar.theme';
  let current = 'light';
  const valid = (value) => value === 'light' || value === 'dark';
  function read() {
    try { const saved = localStorage.getItem(key); return valid(saved) ? saved : 'light'; }
    catch { return current; }
  }
  function apply(theme) { current = theme; document.documentElement.dataset.theme = theme; }
  window.AutoCarTheme = {
    get: () => current,
    set(theme) {
      if (!valid(theme)) throw new Error('Selecione um tema válido.');
      let persisted = true;
      try { localStorage.setItem(key, theme); } catch { persisted = false; }
      apply(theme);
      window.dispatchEvent(new CustomEvent('autocar-theme-change', { detail: { theme, persisted } }));
      return persisted;
    },
  };
  window.addEventListener('storage', (event) => { if (event.key === key || event.key === null) apply(read()); });
  apply(read());
})();
