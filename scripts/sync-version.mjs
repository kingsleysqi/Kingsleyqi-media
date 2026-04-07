import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
const readmePath = path.join(root, 'README.MD');
const versionJsPath = path.join(root, 'version.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
if (!version) throw new Error('package.json version missing');

// 1) version.js
const versionJs = `// Single source of truth for UI version labels.
// Auto-generated from package.json by scripts/sync-version.mjs
window.APP_VERSION = '${version}';

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
`;
fs.writeFileSync(versionJsPath, versionJs, 'utf8');

// 2) README badge
let readme = fs.readFileSync(readmePath, 'utf8');
readme = readme.replace(
  /https:\/\/img\.shields\.io\/badge\/version-[0-9A-Za-z.\-_]+-c9a84c\?style=flat-square/g,
  `https://img.shields.io/badge/version-${version}-c9a84c?style=flat-square`
);
fs.writeFileSync(readmePath, readme, 'utf8');

console.log(`Synced version ${version}`);

