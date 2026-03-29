export async function onRequestGet() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>上传文件 · Kingsley Media</title>
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
    .container{width:100%;max-width:560px}
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
    .upload-header{margin-bottom:28px}
    .upload-badge{display:inline-block;padding:2px 10px;font-family:var(--mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(79,156,249,0.4);color:var(--accent);margin-bottom:12px}
    .upload-title{font-size:1.5rem;font-weight:300;margin-bottom:8px;line-height:1.3}
    .upload-meta{display:flex;flex-wrap:wrap;gap:16px;font-family:var(--mono);font-size:0.6rem;color:var(--muted);margin-bottom:20px}
    .meta-item{display:flex;align-items:center;gap:5px}
    .meta-dot{width:6px;height:6px;border-radius:50%;background:var(--green);flex-shrink:0}
    .meta-dot.red{background:var(--red)}
    .meta-dot.yellow{background:var(--yellow)}
    .upload-zone{border:1px dashed var(--border2);padding:48px 20px;text-align:center;cursor:pointer;transition:all 0.2s;position:relative;margin-bottom:16px}
    .upload-zone:hover,.upload-zone.dragover{border-color:var(--accent);background:rgba(79,156,249,0.04)}
    .upload-zone input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}
    .upload-zone-icon{font-size:2.5rem;margin-bottom:12px;opacity:0.4}
    .upload-zone-text{font-size:0.9rem;color:var(--muted);margin-bottom:4px}
    .upload-zone-sub{font-family:var(--mono);font-size:0.6rem;color:var(--muted)}
    .file-list{margin-bottom:16px}
    .file-item{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surface);border:1px solid var(--border);margin-bottom:6px}
    .file-item:last-child{margin-bottom:0}
    .file-icon{font-size:1.2rem;flex-shrink:0}
    .file-info{flex:1;min-width:0}
    .file-name{font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .file-size{font-family:var(--mono);font-size:0.6rem;color:var(--muted);margin-top:2px}
    .file-status{font-family:var(--mono);font-size:0.6rem;padding:2px 8px;text-transform:uppercase;flex-shrink:0}
    .status-pending{color:var(--muted)}
    .status-uploading{color:var(--accent)}
    .status-done{color:var(--green)}
    .status-error{color:var(--red)}
    .progress-wrap{height:2px;background:var(--border);margin-top:6px;border-radius:1px}
    .progress-bar{height:100%;background:var(--accent);border-radius:1px;transition:width 0.3s}
    .file-remove{background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.9rem;padding:2px 6px;transition:color 0.2s;flex-shrink:0}
    .file-remove:hover{color:var(--red)}
    .btn-upload{width:100%;padding:12px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-family:var(--mono);font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;transition:background 0.2s}
    .btn-upload:hover{background:var(--accent2)}
    .btn-upload:disabled{opacity:0.5;cursor:not-allowed}
    .size-warning{padding:10px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:var(--yellow);font-family:var(--mono);font-size:0.62rem;margin-bottom:12px;display:none}
    #toast{position:fixed;bottom:24px;right:24px;z-index:999;padding:10px 18px;font-family:var(--mono);font-size:0.68rem;border-left:3px solid var(--green);background:var(--surface);border-top:1px solid var(--border);border-right:1px solid var(--border);border-bottom:1px solid var(--border);transform:translateY(60px);opacity:0;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);pointer-events:none;max-width:calc(100vw - 48px)}
    #toast.show{transform:translateY(0);opacity:1}
    #toast.error{border-left-color:var(--red)}
    .spinner{display:inline-block;width:16px;height:16px;border:1.5px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:8px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .upload-footer{margin-top:24px;text-align:center;font-family:var(--mono);font-size:0.55rem;color:var(--muted)}
    .upload-footer span{color:var(--accent)}
    @media(max-width:480px){
      .page{padding:24px 12px 48px}
      .upload-title{font-size:1.2rem}
      .upload-zone{padding:32px 16px}
    }
  </style>
</head>
<body>

<div class="topbar">
  <div class="topbar-logo">Kingsley · Media</div>
  <a href="/" class="topbar-home">← 返回首页</a>
</div>

<div class="page">
  <div class="container">

    <div id="state-loading" class="state-screen">
      <div><span class="spinner"></span></div>
      <div class="state-sub">加载中…</div>
    </div>

    <div id="state-notfound" class="state-screen" style="display:none">
      <div class="state-icon">🔍</div>
      <div class="state-title">链接无效</div>
      <div class="state-sub">此上传链接不存在或已被删除</div>
    </div>

    <div id="state-expired" class="state-screen" style="display:none">
      <div class="state-icon">⏰</div>
      <div class="state-title">链接已过期</div>
      <div class="state-sub">此上传链接已超过有效期</div>
    </div>

    <div id="state-notstarted" class="state-screen" style="display:none">
      <div class="state-icon">🕐</div>
      <div class="state-title">尚未开始</div>
      <div class="state-sub" id="notstarted-time"></div>
    </div>

    <div id="state-limit" class="state-screen" style="display:none">
      <div class="state-icon">🚫</div>
      <div class="state-title">文件数量已达上限</div>
      <div class="state-sub">此链接允许上传的文件数量已用完</div>
    </div>

    <div id="state-password" class="state-screen" style="display:none">
      <div class="pw-box">
        <div style="font-family:var(--mono);font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent);margin-bottom:20px">🔒 需要访问密码</div>
        <div id="pw-token-name" style="font-size:1.1rem;font-weight:300;margin-bottom:20px"></div>
        <div class="pw-label">访问密码</div>
        <input class="pw-input" type="password" id="pw-input" placeholder="输入密码…" autocomplete="off"/>
        <button class="pw-btn" id="pw-btn">验证密码</button>
        <div class="pw-error" id="pw-error">密码错误，请重试</div>
      </div>
    </div>

    <div id="state-content" style="display:none">
      <div class="upload-header">
        <div class="upload-badge">📥 文件上传</div>
        <h1 class="upload-title" id="upload-title"></h1>
        <div class="upload-meta" id="upload-meta"></div>
      </div>

      <div class="size-warning" id="size-warning"></div>

      <div class="upload-zone" id="drop-zone">
        <input type="file" id="file-input" multiple/>
        <div class="upload-zone-icon">📁</div>
        <div class="upload-zone-text">拖放文件到此处，或点击选择</div>
        <div class="upload-zone-sub" id="zone-sub">支持任意格式</div>
      </div>

      <div id="file-list"></div>

      <button class="btn-upload" id="upload-btn" style="display:none">▶ 开始上传</button>

      <div class="upload-footer" style="margin-top:20px">
        由 <span>Kingsley Media</span> 提供上传服务
      </div>
    </div>

    <div id="state-done" class="state-screen" style="display:none">
      <div class="state-icon">✅</div>
      <div class="state-title">上传完成</div>
      <div class="state-sub">文件已成功上传</div>
    </div>

  </div>
</div>

<div id="toast"></div>

<script>
const pathParts = location.pathname.split('/').filter(Boolean);
const tokenId = pathParts[pathParts.indexOf('upload') + 1] || '';
let tokenData = null;
let enteredPw = '';
let uploadQueue = [];

async function fetchToken(password = '') {
  const url = \`/api/upload/\${tokenId}\${password ? \`?password=\${encodeURIComponent(password)}\` : ''}\`;
  const res = await fetch(url);
  return { status: res.status, data: await res.json() };
}

async function init() {
  if (!tokenId) { show('notfound'); return; }
  try {
    const { status, data } = await fetchToken();
    if (status === 404) { show('notfound'); return; }
    if (status === 410 || data.expired) { show('expired'); return; }
    if (status === 403 && data.notStarted) {
      document.getElementById('notstarted-time').textContent =
        '开始时间：' + new Date(data.startTime).toLocaleString();
      show('notstarted'); return;
    }
    if (status === 403 && data.limitReached) { show('limit'); return; }
    if (data.needPassword) {
      document.getElementById('pw-token-name').textContent = data.name || '';
      show('password');
      setupPasswordForm();
      return;
    }
    tokenData = data;
    renderUpload();
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
      const { status, data } = await fetchToken(pw);
      if (status === 401 || data.wrongPassword) {
        errEl.style.display = 'block'; inp.value = ''; inp.focus();
      } else if (status === 410) { show('expired'); return; }
      else if (status === 403 && data.limitReached) { show('limit'); return; }
      else { enteredPw = pw; tokenData = data; renderUpload(); show('content'); return; }
    } catch { errEl.textContent = '请求失败'; errEl.style.display = 'block'; }
    btn.disabled = false; btn.textContent = '验证密码';
  }
  btn.onclick = submit;
  inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
  setTimeout(() => inp.focus(), 100);
}

function renderUpload() {
  const d = tokenData;
  document.title = \`\${d.name} · 上传文件 · Kingsley Media\`;
  document.getElementById('upload-title').textContent = d.name;

  const meta = [];
  if (d.endTime) {
    const remaining = d.endTime - Date.now();
    const hours = Math.floor(remaining / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    const dotClass = hours < 1 ? 'red' : hours < 6 ? 'yellow' : '';
    meta.push(\`<span class="meta-item"><span class="meta-dot \${dotClass}"></span>截止：\${new Date(d.endTime).toLocaleString()}</span>\`);
  }
  if (d.maxFiles) {
    meta.push(\`<span class="meta-item"><span class="meta-dot yellow"></span>已上传 \${d.uploadCount}/\${d.maxFiles} 个</span>\`);
  }
  if (d.maxFileSize) {
    meta.push(\`<span class="meta-item">单文件限 \${fmt(d.maxFileSize)}</span>\`);
  }
  document.getElementById('upload-meta').innerHTML = meta.join('');

  if (d.maxFileSize) {
    document.getElementById('zone-sub').textContent = \`支持任意格式 · 单文件最大 \${fmt(d.maxFileSize)}\`;
  }

  setupDrop();
}

function setupDrop() {
  const zone = document.getElementById('drop-zone');
  const inp = document.getElementById('file-input');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); addFiles([...e.dataTransfer.files]); });
  inp.onchange = () => { addFiles([...inp.files]); inp.value = ''; };
}

function addFiles(files) {
  const maxSize = tokenData.maxFileSize;
  const oversized = [];
  files.forEach(f => {
    if (maxSize && f.size > maxSize) { oversized.push(f.name); return; }
    uploadQueue.push({ file: f, status: 'pending', progress: 0 });
  });
  if (oversized.length) {
    const w = document.getElementById('size-warning');
    w.textContent = \`以下文件超过大小限制（\${fmt(maxSize)}）已跳过：\${oversized.join(', ')}\`;
    w.style.display = 'block';
  }
  renderQueue();
}

function renderQueue() {
  const listEl = document.getElementById('file-list');
  const btn = document.getElementById('upload-btn');
  if (!uploadQueue.length) { listEl.innerHTML = ''; btn.style.display = 'none'; return; }
  btn.style.display = 'block';

  listEl.innerHTML = uploadQueue.map((item, i) => \`
    <div class="file-item">
      <div class="file-icon">\${fileIcon(item.file.name)}</div>
      <div class="file-info">
        <div class="file-name">\${escHtml(item.file.name)}</div>
        <div class="file-size">\${fmt(item.file.size)}</div>
        \${item.status === 'uploading' || item.status === 'done' ? \`<div class="progress-wrap"><div class="progress-bar" style="width:\${item.progress}%"></div></div>\` : ''}
      </div>
      <span class="file-status status-\${item.status}">\${statusLabel(item.status)}</span>
      \${item.status === 'pending' ? \`<button class="file-remove" onclick="removeFile(\${i})">✕</button>\` : ''}
    </div>
  \`).join('');
}

window.removeFile = i => { uploadQueue.splice(i, 1); renderQueue(); };

document.getElementById('upload-btn').onclick = startUpload;

async function startUpload() {
  const pending = uploadQueue.filter(i => i.status === 'pending');
  if (!pending.length) return;

  document.getElementById('upload-btn').disabled = true;

  for (const item of pending) {
    item.status = 'uploading'; renderQueue();
    try {
      const res = await fetch(\`/api/upload/\${tokenId}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: item.file.name,
          contentType: item.file.type || 'application/octet-stream',
          password: enteredPw || undefined,
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || \`HTTP \${res.status}\`);
      }
      const { url } = await res.json();
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) { item.progress = Math.round(e.loaded / e.total * 100); renderQueue(); }
        };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(\`HTTP \${xhr.status}\`));
        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.send(item.file);
      });
      item.status = 'done'; item.progress = 100;
    } catch (err) {
      item.status = 'error';
      toast(\`上传失败：\${item.file.name} — \${err.message}\`, true);
    }
    renderQueue();
  }

  document.getElementById('upload-btn').disabled = false;

  const allDone = uploadQueue.every(i => i.status === 'done');
  const anyError = uploadQueue.some(i => i.status === 'error');
  if (allDone) { toast('全部上传完成！'); }
  else if (!anyError) { toast('上传完成'); }
}

function show(state) {
  ['loading','notfound','expired','notstarted','limit','password','content','done'].forEach(s => {
    const el = document.getElementById(\`state-\${s}\`);
    if (el) el.style.display = s === state ? (s === 'content' ? 'block' : 'flex') : 'none';
  });
}

function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = isError ? 'error' : '';
  void t.offsetWidth; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function fmt(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function fileIcon(name) {
  const e = (name || '').split('.').pop().toLowerCase();
  if (['mp4','mkv','avi','mov','webm'].includes(e)) return '🎬';
  if (['mp3','flac','aac','wav','m4a'].includes(e)) return '🎵';
  if (['jpg','jpeg','png','webp','gif'].includes(e)) return '🖼';
  if (['pdf'].includes(e)) return '📄';
  if (['zip','rar','7z'].includes(e)) return '📦';
  if (['doc','docx'].includes(e)) return '📝';
  return '📎';
}

function statusLabel(s) {
  return { pending: '等待', uploading: '上传中', done: '完成', error: '失败' }[s] || s;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); } init(); </script> </body> </html>`; return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" }, }); }