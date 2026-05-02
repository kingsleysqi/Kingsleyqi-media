// Single source of truth for UI version labels.
// Auto-generated from package.json by scripts/sync-version.mjs
window.APP_VERSION = '2.1.8';

function applyVersion() {
  const v = window.APP_VERSION || '';
  if (document.title && document.title.includes('{version}')) {
    document.title = document.title.replaceAll('{version}', v);
  }
  document.querySelectorAll('[data-app-version]').forEach(el => {
    el.textContent = v;
  });
  document.querySelectorAll('[data-app-version-attr]').forEach(el => {
    const attr = el.getAttribute('data-app-version-attr');
    if (attr) el.setAttribute(attr, v);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyVersion);
} else {
  applyVersion();
}

