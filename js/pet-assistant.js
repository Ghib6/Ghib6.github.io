(async function () {
  if (document.getElementById('pet-chat')) return;
  let config;
  try { config = await fetch('/pet-assistant-config.json').then(r => { if (!r.ok) throw Error(); return r.json(); }); } catch { return; }
  if (!config.enabled) return;
  const panel = document.createElement('section');
  panel.id = 'pet-chat'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', config.name);
  panel.innerHTML = '<header><strong></strong><button type="button" title="清空对话" aria-label="清空对话">↺</button><button type="button" title="关闭" aria-label="关闭">×</button></header><div id="pet-chat-log" role="log" aria-live="polite"></div><form><textarea rows="2" maxlength="2000" aria-label="输入问题" placeholder="问问博客里的知识…" required></textarea><button type="submit" title="发送" aria-label="发送">↑</button></form>';
  panel.querySelector('strong').textContent = config.name;
  document.body.append(panel);
  const log = panel.querySelector('[role=log]'), input = panel.querySelector('textarea'), form = panel.querySelector('form');
  let history = [], busy = false;
  function say(text, role) { const p = document.createElement('div'); p.className = 'pet-message'; p.dataset.role = role; p.textContent = text; log.append(p); log.scrollTop = log.scrollHeight; return p; }
  function reset() { history = []; log.replaceChildren(); say(config.welcome, 'assistant'); }
  function toggle() { panel.hidden = !panel.hidden; if (!panel.hidden) input.focus(); }
  panel.querySelector('[aria-label="关闭"]').onclick = toggle;
  panel.querySelector('[aria-label="清空对话"]').onclick = () => { if (!busy) reset(); };
  const header = panel.querySelector('header');
  const resizeHandle = document.createElement('button');
  resizeHandle.type = 'button'; resizeHandle.className = 'pet-resize';
  resizeHandle.title = '调整窗口大小'; resizeHandle.setAttribute('aria-label', '调整窗口大小');
  panel.append(resizeHandle);
  let drag = null;
  let resizing = null;
  function position(left, top) {
    const rect = panel.getBoundingClientRect();
    panel.style.left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8)) + 'px';
    panel.style.top = Math.max(8, Math.min(top, window.innerHeight - rect.height - 8)) + 'px';
    panel.style.bottom = 'auto';
  }
  header.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    drag = { id:e.pointerId, x:e.clientX - rect.left, y:e.clientY - rect.top };
    header.setPointerCapture(e.pointerId);
    panel.classList.add('pet-dragging');
    e.preventDefault();
  });
  header.addEventListener('pointermove', e => {
    if (drag && drag.id === e.pointerId) position(e.clientX - drag.x, e.clientY - drag.y);
  });
  function stopDrag() { drag = null; panel.classList.remove('pet-dragging'); }
  header.addEventListener('pointerup', stopDrag);
  header.addEventListener('pointercancel', stopDrag);
  header.addEventListener('lostpointercapture', stopDrag);
  function resize(width, height) {
    const rect = panel.getBoundingClientRect();
    const availableWidth = Math.max(0, window.innerWidth - rect.left - 8);
    const availableHeight = Math.max(0, window.innerHeight - rect.top - 8);
    panel.style.width = Math.min(availableWidth, Math.max(280, width)) + 'px';
    panel.style.height = Math.min(availableHeight, Math.max(260, height)) + 'px';
  }
  resizeHandle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    position(rect.left, rect.top);
    resizing = {id:e.pointerId, x:e.clientX, y:e.clientY, width:rect.width, height:rect.height};
    resizeHandle.setPointerCapture(e.pointerId);
    panel.classList.add('pet-resizing');
    e.preventDefault();
  });
  resizeHandle.addEventListener('pointermove', e => {
    if (resizing && resizing.id === e.pointerId) resize(resizing.width + e.clientX - resizing.x, resizing.height + e.clientY - resizing.y);
  });
  function stopResize() { resizing = null; panel.classList.remove('pet-resizing'); }
  resizeHandle.addEventListener('pointerup', stopResize);
  resizeHandle.addEventListener('pointercancel', stopResize);
  resizeHandle.addEventListener('lostpointercapture', stopResize);
  resizeHandle.addEventListener('keydown', e => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    const rect = panel.getBoundingClientRect();
    position(rect.left, rect.top);
    resize(rect.width + (e.key === 'ArrowLeft' ? -20 : e.key === 'ArrowRight' ? 20 : 0), rect.height + (e.key === 'ArrowUp' ? -20 : e.key === 'ArrowDown' ? 20 : 0));
    e.preventDefault();
  });
  window.addEventListener('resize', () => {
    if (!panel.hidden && panel.style.top) {
      const rect = panel.getBoundingClientRect();
      panel.style.width = Math.min(rect.width, window.innerWidth - 16) + 'px';
      panel.style.height = Math.min(rect.height, window.innerHeight - 16) + 'px';
      position(rect.left, rect.top);
    }
  });
  function bindPet() {
    const canvas = document.getElementById('live2dcanvas');
    if (!canvas || canvas.dataset.petChatBound) return;
    canvas.dataset.petChatBound = 'true';
    // Live2D disables pointer events on its wrapper; re-enable its canvas only.
    canvas.style.setProperty('pointer-events', 'auto', 'important');
    canvas.style.cursor = 'pointer';
    canvas.setAttribute('role', 'button');
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', '打开博客助手');
    canvas.setAttribute('aria-controls', panel.id);
    canvas.addEventListener('click', toggle);
    canvas.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }
  bindPet();
  // The widget loads asynchronously and may be recreated after navigation.
  const petObserver = new MutationObserver(bindPet);
  petObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => petObserver.disconnect());
  window.addEventListener('pageshow', () => { bindPet(); petObserver.observe(document.body, { childList: true, subtree: true }); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) toggle(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const question = input.value.trim(); if (!question || busy) return;
    busy = true; form.querySelector('button').disabled = true; input.value = ''; say(question, 'user'); const pending = say('正在查找文章并思考…', 'assistant');
    let reply = '';
    function renderReply() {
      if (window.marked && window.DOMPurify) {
        pending.innerHTML = DOMPurify.sanitize(marked.parse(reply, {gfm:true, breaks:true}), {
          USE_PROFILES:{html:true}, FORBID_TAGS:['img','style','form','input','button','textarea','video','audio'], FORBID_ATTR:['style']
        });
        pending.classList.add('pet-markdown');
      } else { pending.textContent = reply; }
      log.scrollTop = log.scrollHeight;
    }
    try {
      const response = await fetch(config.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({question, history, path:location.pathname, stream:true}), signal:AbortSignal.timeout(65000) });
      if (!response.ok) {
        if (response.status === 429) throw Error('本分钟提问次数已达上限，请等待约一分钟后再试。');
        const data = await response.json().catch(() => ({}));
        throw Error(data.error || '服务暂时不可用，请稍后再试。');
      }
      let articles = [];
      if ((response.headers?.get('content-type') || '').includes('application/x-ndjson')) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let buffer = '', complete = false;
        function receive(line) {
          if (!line.trim()) return;
          const part = JSON.parse(line);
          if (part.type === 'error') throw Error(part.error);
          if (part.type === 'sources') articles = part.sources || [];
          if (part.type === 'delta') { reply += part.text; renderReply(); }
          if (part.type === 'done') complete = true;
        }
        try {
          while (true) {
            const chunk = await reader.read();
            buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, {stream:true});
            let boundary;
            while ((boundary = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0,boundary); buffer = buffer.slice(boundary+1); receive(line); }
            if (chunk.done) break;
          }
          if (buffer.trim()) receive(buffer);
          if (!complete) throw Error('回复中断，请重试');
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      } else {
        const data = await response.json(); reply = data.reply; articles = data.sources || []; renderReply();
      }
      const sources = document.createElement('nav'); sources.className = 'pet-sources'; sources.setAttribute('aria-label', '相关文章');
      for (const source of articles) {
        const url = new URL(source.url); if (url.protocol !== 'https:') continue;
        const a = document.createElement('a'); a.href = url.href; a.textContent = source.title; sources.append(a);
      }
      if (sources.childElementCount) pending.append(sources);
      history = [...history, {role:'user',content:question}, {role:'assistant',content:reply.slice(0,6000)}].slice(-6);
    } catch (error) {
      const message = error.name === 'TimeoutError' ? '网络或模型响应超时，请检查网络后重试。' : error instanceof TypeError ? '网络连接失败，请检查网络或代理后重试。如果刚连续提问，请等待一分钟；浏览器拦截的响应也可能显示为连接失败。' : error.message;
      if (reply) { renderReply(); const note = document.createElement('p'); note.textContent = message; pending.append(note); }
      else pending.textContent = message;
    }
    finally { busy = false; form.querySelector('button').disabled = false; log.scrollTop = log.scrollHeight; }
  });
  reset();
})();
