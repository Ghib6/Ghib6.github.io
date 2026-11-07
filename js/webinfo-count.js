(() => {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;

    const text = el.textContent.trim();
    if (text && !el.querySelector('.fa-spinner')) return;
    el.textContent = value;
  };

  const formatCount = value => {
    if (value >= 10000) return `${(value / 10000).toFixed(1)}w`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return String(value);
  };

  const updateLocalCount = () => {
    const keyPrefix = `webinfo:${location.hostname || 'local'}`;
    const visitorKey = `${keyPrefix}:visitor`;
    const uvKey = `${keyPrefix}:uv`;
    const pvKey = `${keyPrefix}:pv`;

    let uv = Number(localStorage.getItem(uvKey) || 0);
    let pv = Number(localStorage.getItem(pvKey) || 0) + 1;

    if (!localStorage.getItem(visitorKey)) {
      uv += 1;
      localStorage.setItem(visitorKey, '1');
    }

    localStorage.setItem(uvKey, String(uv));
    localStorage.setItem(pvKey, String(pv));

    setText('busuanzi_value_site_uv', formatCount(uv));
    setText('busuanzi_value_site_pv', formatCount(pv));
  };

  window.addEventListener('load', () => {
    setTimeout(updateLocalCount, 2500);
  });
})();
