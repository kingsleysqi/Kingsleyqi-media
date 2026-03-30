export async function onRequestGet() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>分享 · Kingsley Qi Media</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#0a0c0f;--surface:#111318;--border:#1e2230;--border2:#2a2f42;--accent:#4f9cf9;--accent2:#3b82f6;--green:#22c55e;--red:#ef4444;--yellow:#f59e0b;--text:#e2e8f0;--muted:#64748b;--mono:'IBM Plex Mono',monospace;--sans:'IBM Plex Sans',sans-serif}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;min-height:100vh;display:flex;flex-direction:column}
    a{color:inherit;text-decoration:none}
    .topbar{height:50px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}
    .topbar-logo{font-family:var(--mono);font-size:0.68rem;letter-spacing:0.25em;text-transform:uppercase;color:var(--accent)}
    .topbar-home{font-family:var(--mono);font-size:0.62rem;color:var(--muted);transition:color 0.2s}
    .topbar-home:hover{color:var(--text)}
    .page{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px 60px}
    .container{width:100%;max-width:640px}
    .state-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;gap:16px}
    .state-icon{font-size:3rem;opacity:0.4}
    .state-title{font-size:1.1rem;font-weight:300}
    .state-sub{font-family:var(--mono);font-size:0.65rem;color:var(--muted)}
    .pw-box{background:var(--surface);border:1px solid var(--border2);padding:32px;width:100%;max-width:360px}
    .pw-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
    .pw-input{width:100%;background:var(--bg);border:1px solid var(--border2);color:var(--text);font-family:var(--mono);font-size:0.85rem;padding:10px 14px;outline:none;transition:border-color 0.2s;margin-bottom:12px}
    .pw-input:focus{border-color:var(--accent)}
    .pw-btn{width:100%;padding:11px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-family:var(--mono);font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;transition:background 0.2s}
    .pw-btn:hover{background:var(--accent2)}
    .pw-btn:disabled{opacity:0.5;cursor:not-allowed}
    .pw-error{margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;font-family:var(--mono);font-size:0.62rem;display:none}
    .share-header{margin-bottom:28px}
    .share-badge{display:inline-block;padding:2px 10px;font-family:var(--mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(79,156,249,0.4);color:var(--accent);margin-bottom:12px}
    .share-title{font-size:1.5rem;font-weight:300;margin-bottom:8px;line-height:1.3}
    .share-desc{font-size:0.85rem;color:var(--muted);line-height:1.6;margin-bottom:14px}
    .share-meta{display:flex;flex-wrap:wrap;gap:16px;font-family:var(--mono);font-size:0.6rem;color:var(--muted)}
    .meta-item{display:flex;align-items:center;gap:5px}
    .meta-dot{width:6px;height:6px;border-radius:50%;background:var(--green);flex-shrink:0}
    .meta-dot.yellow{background:var(--yellow)}
    .meta-dot.red{background:var(--red)}
    .files-label{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
    .file-card{background:var(--surface);border:1px solid var(--border);margin-bottom:8px;display:flex;align-items:center;gap:14px;padding:14px 16px;transition:border-color 0.2s}
    .file-card:hover{border-color:var(--border2)}
    .file-icon{font-size:1.4rem;flex-shrink:0}
    .file-info{flex:1;min-width:0}
    .file-name{font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}
    .file-type{font-family:var(--mono);font-size:0.58rem;color:var(--muted);text-transform:uppercase}
    .file-actions{display:flex;gap:6px;flex-shrink:0}
    .btn-dl{padding:7px 16px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-family:var(--mono);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;transition:background 0.2s;white-space:nowrap}
    .btn-dl:hover{background:var(--accent2)}
    .btn-dl.secondary{background:transparent;border:1px solid var(--border2);color:var(--muted)}
    .btn-dl.secondary:hover{border-color:var(--accent);color:var(--accent)}
    .btn-dl:disabled{opacity:0.4;cursor:not-allowed}
    .share-footer{margin-top:32px;padding-top:20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
    .footer-brand{font-family:var(--mono);font-size:0.6rem;color:var(--muted)}
    .footer-brand span{color:var(--accent)}
    #toast{position:fixed;bottom:24px;right:24px;z-index:999;padding:10px 18px;font-family:var(--mono);font-size:0.68rem;border-left:3px solid var(--green);background:var(--surface);border-top:1px solid var(--border);border-right:1px solid var(--border);border-bottom:1px solid var(--border);transform:translateY(60px);opacity:0;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);pointer-events:none;max-width:calc(100vw - 48px)}
    #toast.show{transform:translateY(0);opacity:1}
    #toast.error{border-left-color:var(--red)}
    .spinner{display:inline-block;width:16px;height:16px;border:1.5px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:8px}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media(max-width:480px){
      .page{padding:24px 12px 48px}
      .share-title{font-size:1.2rem}
      .file-card{padding:12px;flex-wrap:wrap}
      .file-actions{width:100%;margin-top:8px}
      .btn-dl{flex:1;text-align:center}
    }
  </style>
</head>
<body>

<div class="topbar">
  <div class="topbar-logo">Kingsley Qi · Media</div>
  <a href="/" class="topbar-home">← 返回首页</a>
</div>

<div class="page">
  <div class="container">

    <div id="state-loading" class="state-screen">
      <div><span class="spinner"></span></div>
      <div class="state-sub">加载分享内容…</div>
    </div>

    <div id="state-notfound" class="state-screen" style="display:none">
      <div class="state-icon">🔍</div>
      <div class="state-title">分享不存在</div>
      <div class="state-sub">链接可能已失效或被删除</div>
    </div>

    <div id="state-expired" class="state-screen" style="display:none">
      <div class="state-icon">⏰</div>
      <div class="state-title">分享已过期</div>
      <div class="state-sub">此分享链接已超过有效期</div>
    </div>

    <div id="state-limit" class="state-screen" style="display:none">
      <div class="state-icon">🚫</div>
      <div class="state-title">访问次数已达上限</div>
      <div class="state-sub">此分享链接的访问次数已用完</div>
    </div>

    <div id="state-password" class="state-screen" style="display:none">
      <div class="pw-box">
        <div style="font-family:var(--mono);font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent);margin-bottom:20px">🔒 需要访问密码</div>
        <div id="pw-share-title" style="font-size:1.1rem;font-weight:300;margin-bottom:6px"></div>
        <div id="pw-share-desc" style="font-size:0.8rem;color:var(--muted);margin-bottom:20px"></div>
        <div class="pw-label">访问密码</div>
        <input class="pw-input" type="password" id="pw-input" placeholder="输入密码…" autocomplete="off"/>
        <button class="pw-btn" id="pw-btn">验证密码</button>
        <div class="pw-error" id="pw-error">密码错误，请重试</div>
      </div>
    </div>

    <div id="state-content" style="display:none">
      <div class="share-header">
        <div class="share-badge">📤 分享文件</div>
        <h1 class="share-title" id="share-title"></h1>
        <div class="share-desc" id="share-desc"></div>
        <div class="share-meta" id="share-meta"></div>
      </div>
      <div class="files-label" id="files-label">文件列表</div>
      <div id="file-list"></div>
      <div class="share-footer">
        <div class="footer-brand">由 <span>Kingsley Qi  Media</span> 分享</div>
        <button class="btn-dl secondary" id="dl-all-btn" style="display:none">⬇ 复制全部链接</button>
      </div>
    </div>

  </div>
</div>

<div id="toast"></div>

<script>
// 从 URL 路径中提取分享 ID
// /share/abc123 → abc123
const pathParts = location.pathname.split('/').filter(Boolean);
const shareId = pathParts[pathParts.indexOf('share') + 1] || '';

let shareData = null;

async function fetchShare(password = '') {
  const url = `/api/share/${shareId}${password ? `?password=${encodeURIComponent(password)}` : ''}`;
  const res = await fetch(url);
  return { status: res.status, data: await res.json() };
}

async function init() {
  if (!shareId) { show('notfound'); return; }
  try {
    const { status, data } = await fetchShare();
    if (status === 404) { show('notfound'); return; }
    if (status === 410 || data.expired) { show('expired'); return; }
    if (status === 403 && data.limitReached) { show('limit'); return; }
    if (data.needPassword) {
      document.getElementById('pw-share-title').textContent = data.title || '';
      document.getElementById('pw-share-desc').textContent = data.desc || `包含 ${data.fileCount || 0} 个文件`;
      show('password');
      setupPasswordForm();
      return;
    }
    shareData = data;
    renderContent();
    show('content');
  } catch { show('notfound'); }
}

function setupPasswordForm() {
  const btn = document.getElementById('pw-btn');
  const inp = document.getElementById('pw-input');
  const errEl = document.getElementById('pw-error');
  async function submit() {
    const pw = inp.value.trim();
    if (!pw) return;
    btn.disabled = true; btn.textContent = '验证中…'; errEl.style.display = 'none';
    try {
      const { status, data } = await fetchShare(pw);
      if (status === 401 || data.wrongPassword) {
        errEl.style.display = 'block'; inp.value = ''; inp.focus();
      } else if (status === 410) { show('expired'); return; }
      else if (status === 403) { show('limit'); return; }
      else { shareData = data; renderContent(); show('content'); return; }
    } catch { errEl.textContent = '请求失败，请重试'; errEl.style.display = 'block'; }
    btn.disabled = false; btn.textContent = '验证密码';
  }
  btn.onclick = submit;
  inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
  setTimeout(() => inp.focus(), 100);
}

function renderContent() {
  const d = shareData;
  document.title = `${d.title} · 分享 · Kingsley Qi Media`;
  document.getElementById('share-title').textContent = d.title;
  document.getElementById('share-desc').textContent = d.desc || '';
  document.getElementById('share-desc').style.display = d.desc ? 'block' : 'none';
  document.getElementById('files-label').textContent = `文件列表（${d.files.length} 个）`;

  const meta = [];
  if (d.expires) {
    const days = Math.ceil((d.expires - Date.now()) / 86400000);
    const dotClass = days <= 1 ? 'red' : days <= 3 ? 'yellow' : '';
    meta.push(`<span class="meta-item"><span class="meta-dot ${dotClass}"></span>过期：${new Date(d.expires).toLocaleDateString()}</span>`);
  } else {
    meta.push(`<span class="meta-item"><span class="meta-dot"></span>永久有效</span>`);
  }
  if (d.maxUse) meta.push(`<span class="meta-item"><span class="meta-dot yellow"></span>访问 ${d.useCount}/${d.maxUse} 次</span>`);
  meta.push(`<span class="meta-item">创建于 ${new Date(d.created).toLocaleDateString()}</span>`);
  document.getElementById('share-meta').innerHTML = meta.join('');

  const listEl = document.getElementById('file-list');
  if (!d.files.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-family:var(--mono);font-size:0.7rem">此分享暂无文件</div>';
    return;
  }
  listEl.innerHTML = d.files.map(f => `
    <div class="file-card">
      <div class="file-icon">${fileIcon(f.name)}</div>
      <div class="file-info">
        <div class="file-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
        <div class="file-type">${f.type === 'external' ? '外部链接' : 'R2 存储'}</div>
      </div>
      <div class="file-actions">
        ${f.url
          ? `<a href="${escHtml(f.url)}" target="_blank" download="${escHtml(f.name)}"><button class="btn-dl">⬇ 下载</button></a>
             <button class="btn-dl secondary" onclick="copyLink('${escJs(f.url)}')">复制链接</button>`
          : `<button class="btn-dl" disabled>不可用</button>`}
      </div>
    </div>
  `).join('');

  if (d.files.length > 1) {
    const dlAll = document.getElementById('dl-all-btn');
    dlAll.style.display = 'inline-block';
    dlAll.onclick = () => {
      const links = d.files.filter(f => f.url).map(f => f.url).join('\n');
      navigator.clipboard.writeText(links).then(() => toast('已复制全部链接'));
    };
  }
}

function show(state) {
  ['loading','notfound','expired','limit','password','content'].forEach(s => {
    const el = document.getElementById(`state-${s}`);
    if (el) el.style.display = s === state ? (s === 'content' ? 'block' : 'flex') : 'none';
  });
}
function copyLink(url) { navigator.clipboard.writeText(url).then(() => toast('链接已复制')); }
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = isError ? 'error' : '';
  void t.offsetWidth; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
function fileIcon(name) {
  const e = (name || '').split('.').pop().toLowerCase();
  if (['mp4','mkv','avi','mov','webm','m4v'].includes(e)) return '🎬';
  if (['mp3','flac','aac','wav','m4a','ogg'].includes(e)) return '🎵';
  if (['jpg','jpeg','png','webp','gif','svg'].includes(e)) return '🖼';
  if (['pdf'].includes(e)) return '📄';
  if (['zip','rar','7z','tar','gz'].includes(e)) return '📦';
  if (['doc','docx'].includes(e)) return '📝';
  if (['xls','xlsx'].includes(e)) return '📊';
  if (['txt','md'].includes(e)) return '📃';
  return '📎';
}
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escJs(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

init();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}