(function () {
  'use strict';
  var CMS = window.CMS;
  var h = window.h;
  if (!CMS || !h || !window.createClass) return;
  var markdown = CMS.getWidget('markdown');
  if (!markdown || !markdown.control) return;
  var ENDPOINT = 'https://blog-cms-oauth-dusky.vercel.app/api/agent';
  var DEFAULT_BASE = 'https://llm-xv437suq1xghcfvy.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';
  var preferences = {};
  var memoryKey = '';
  try { preferences = JSON.parse(sessionStorage.getItem('articleAgentSettings') || '{}'); } catch (_) {}
  function savedKey() { try { return sessionStorage.getItem('articleAgentKey') || ''; } catch (_) { return ''; } }
  function secret() { try { return sessionStorage.getItem('picbedUploadSecret') || ''; } catch (_) { return ''; } }
  function filename(url) { var name = url.split('/').pop(); try { return decodeURIComponent(name); } catch (_) { return name; } }
  function articleImages(body) {
    var urls = [];
    var pattern = /!\[[^\]]*\]\((https:\/\/picbed\.ghib6\.com\/[^\s)]+)(?:\s+[^)]*)?\)|<img\b[^>]*\bsrc=["'](https:\/\/picbed\.ghib6\.com\/[^"']+)["']/gi;
    var match;
    while ((match = pattern.exec(body))) {
      var url = match[1] || match[2];
      if (!urls.includes(url)) urls.push(url);
    }
    return urls;
  }
  function imageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) return reject(new Error('请上传 12 MB 以内的 PNG、JPEG 或 WebP 图片'));
      var objectUrl = URL.createObjectURL(file);
      var image = new Image();
      image.onerror = function () { URL.revokeObjectURL(objectUrl); reject(new Error('图片读取失败')); };
      image.onload = function () {
        try {
          var scale = Math.min(1, 1600 / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          var context = canvas.getContext('2d');
          context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          var url = canvas.toDataURL('image/jpeg', 0.85);
          if (url.length > 1400000) throw new Error('图片压缩后仍较大，请裁剪或缩小后重试');
          resolve({ url: url, name: file.name });
        } catch (error) { reject(error); } finally { URL.revokeObjectURL(objectUrl); }
      };
      image.src = objectUrl;
    });
  }
  var Control = window.createClass({
    getInitialState: function () {
      return { open: false, page: 'edit', historyPage: 0, imagePage: 0, diffView: 'diff', diffIndex: 0, expandDiff: false, x: 20, y: 80, dockX: null, dockY: null, editorVersion: 0, settings: !memoryKey && !savedKey(), apiKey: memoryKey || savedKey(), remember: !!savedKey(), baseUrl: preferences.baseUrl || DEFAULT_BASE, model: preferences.model || 'deepseek-v4.1-flash', managerSecret: secret(), prompt: '', mode: 'edit', images: [], messages: [], lastReply: '', lastPrompt: '', proposal: null, reviewIndex: null, original: '', undo: null, busy: false, imageBusy: false, error: '', status: '' };
    },
    componentDidMount: function () { this.alive = true; },
    componentWillUnmount: function () { this.alive = false; if (this.controller) this.controller.abort(); if (this.stopDrag) this.stopDrag(); },
    setOpen: function (open) {
      if (this.stopDrag) this.stopDrag();
      this.dragged = false;
      this.setState({ open: open });
    },
    drag: function (event) {
      if (event.button !== 0) return;
      if (this.stopDrag) this.stopDrag();
      this.dragged = false;
      var rect = event.currentTarget.parentElement.getBoundingClientRect();
      var expanded = this.state.open;
      var self = this, startX = event.clientX, startY = event.clientY;
      var x = expanded ? this.state.x : (this.state.dockX === null ? rect.left : this.state.dockX);
      var y = expanded ? this.state.y : (this.state.dockY === null ? rect.top : this.state.dockY);
      var width = rect.width;
      var height = expanded ? 60 : rect.height;
      function move(e) {
        if (!self.dragged && Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) <= 5) return;
        self.dragged = true;
        var nextX = Math.max(0, Math.min(window.innerWidth - Math.min(width, window.innerWidth), x + e.clientX - startX));
        var nextY = Math.max(0, Math.min(window.innerHeight - Math.min(height, window.innerHeight), y + e.clientY - startY));
        self.setState(expanded ? { x: nextX, y: nextY } : { dockX: nextX, dockY: nextY });
      }
      function stop() { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); self.stopDrag = null; }
      this.stopDrag = stop; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
    },
    componentDidUpdate: function (previous) {
      var before = previous.entry && previous.entry.get('slug');
      var after = this.props.entry && this.props.entry.get('slug');
      if (before !== after) {
        if (this.controller) this.controller.abort();
        this.controller = null;
        this.setState({ messages: [], lastReply: '', lastPrompt: '', proposal: null, images: [], undo: null, page: 'edit', historyPage: 0, imagePage: 0, prompt: '', error: '', status: '', busy: false });
      }
    },
    configure: function () {
      if (!this.state.baseUrl.trim() || !this.state.model.trim()) return this.setState({ error: '请填写接口地址和模型名称' });
      memoryKey = this.state.apiKey.trim();
      preferences = { baseUrl: this.state.baseUrl.trim(), model: this.state.model.trim() };
      try {
        sessionStorage.setItem('articleAgentSettings', JSON.stringify(preferences));
        if (this.state.remember && memoryKey) sessionStorage.setItem('articleAgentKey', memoryKey);
        else sessionStorage.removeItem('articleAgentKey');
        if (this.state.managerSecret.trim()) sessionStorage.setItem('picbedUploadSecret', this.state.managerSecret.trim());
      } catch (_) { return this.setState({ error: '浏览器禁止会话存储，请允许此站点存储后重试' }); }
      this.setState({ settings: false, page: 'edit', error: '', status: '连接设置已保存；发送请求时验证 Key。' });
    },
    clearKey: function () {
      memoryKey = ''; try { sessionStorage.removeItem('articleAgentKey'); } catch (_) {}
      this.setState({ apiKey: '', remember: false, status: 'API Key 已从助手中清除。' });
    },
    addFiles: async function (event) {
      var files = Array.from(event.target.files || []); event.target.value = '';
      if (files.length + this.state.images.length > 4) return this.setState({ error: '每次最多附加 4 张图片' });
      this.setState({ imageBusy: true, error: '' });
      try {
        var images = await Promise.all(files.map(imageFile));
        if (this.alive) this.setState(function (state) { return { images: state.images.concat(images) }; });
      } catch (error) { if (this.alive) this.setState({ error: error.message }); }
      finally { if (this.alive) this.setState({ imageBusy: false }); }
    },
    toggleImage: function (url) {
      var images = this.state.images;
      if (images.some(function (x) { return x.url === url; })) images = images.filter(function (x) { return x.url !== url; });
      else {
        if (images.length >= 4) return this.setState({ error: '每次最多附加 4 张图片' });
        images = images.concat({ url: url, name: filename(url) });
      }
      this.setState({ images: images, error: '' });
    },
    send: async function () {
      if (this.state.busy || this.state.imageBusy) return;
      var key = this.state.apiKey.trim() || memoryKey || savedKey();
      var managerSecret = this.state.managerSecret.trim() || secret();
      if (!key || !managerSecret) return this.setState({ settings: true, page: 'settings', error: '请先填写 API Key 和原来的图库管理密钥' });
      var prompt = this.state.prompt.trim();
      if (!prompt) return this.setState({ error: '请先输入要求' });
      var snapshot = this.props.value || '';
      var body = this.state.mode === 'edit' && this.state.proposal !== null && this.state.original === snapshot ? this.state.proposal : snapshot;
      var images = this.state.images.slice();
      if (images.reduce(function (sum, x) { return sum + (x.url.startsWith('data:') ? x.url.length : 0); }, 0) > 2800000) return this.setState({ error: '附图总量较大，请减少图片后发送' });
      var title = this.props.entry && this.props.entry.getIn(['data', 'title']);
      var history = this.state.messages.slice(-6).map(function (message) { return { role: message.role, content: message.text.slice(0, 16000) }; });
      var controller = new AbortController(); this.controller = controller;
      var requestMode = this.state.mode;
      this.setState({ busy: true, error: '', lastReply: '', status: '正在读取写作规则并处理文章' + (images.length ? '与 ' + images.length + ' 张图片…' : '…') });
      var timeout = setTimeout(function () { controller.abort(); }, 125000);
      try {
        var response = await fetch(ENDPOINT, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-Upload-Secret': managerSecret }, body: JSON.stringify({ apiKey: key, baseUrl: this.state.baseUrl.trim(), model: this.state.model.trim(), article: body, title: title || '', prompt: prompt, mode: this.state.mode, images: images, history: history }) });
        var data = await response.json().catch(function () { throw new Error('服务响应无法读取，请检查后台是否已部署'); });
        if (!response.ok) throw new Error(response.status === 401 ? '图库管理密钥错误，请在连接设置中重新填写' : (data.error || '调用失败，请稍后重试'));
        if (!this.alive || this.controller !== controller) return;
        if (typeof data.reply !== 'string') throw new Error('助手回复不完整，请重试。');
        var proposal = requestMode === 'edit' && typeof data.replacement === 'string' && data.replacement.trim() && data.replacement !== snapshot ? data.replacement : null;
        var status = proposal !== null ? '正文修改已生成，尚未应用。请点击消息中的“查看修改”，审阅后应用。' : requestMode === 'analyze' ? '本次为分析与问答，正文未改动。可以继续提出修改要求。' : '助手仅返回说明或正文未发生变化，尚未生成可应用的修改。';
        this.setState(function (state) { return { messages: state.messages.concat([{ role: 'user', text: prompt + (images.length ? '\n（附图 ' + images.length + ' 张）' : '') }, { role: 'assistant', text: data.reply, requestPrompt: prompt, change: proposal !== null ? { before: snapshot, after: proposal, status: 'pending' } : null }]).slice(-12), page: 'edit', historyPage: 0, diffView: 'diff', diffIndex: 0, expandDiff: false, lastReply: data.reply, lastPrompt: prompt, proposal: proposal, reviewIndex: proposal !== null ? Math.min(state.messages.length + 1, 11) : null, original: snapshot, undo: null, prompt: '', status: status }; }, function () {
          if (this.resultNode) this.resultNode.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      } catch (error) {
        if (this.alive && this.controller === controller) this.setState({ error: error.name === 'AbortError' ? '请求已取消或超时，文章未改动。' : error.message, status: '' });
      } finally {
        clearTimeout(timeout);
        if (this.alive && this.controller === controller) { this.controller = null; this.setState({ busy: false }); }
      }
    },
    generateEdit: function () {
      if (!this.state.lastPrompt || this.state.busy) return;
      this.setState({ mode: 'edit', prompt: this.state.lastPrompt }, this.send);
    },
    reviewMessage: function (index) {
      var message = this.state.messages[index];
      if (!message || !message.change) return;
      this.setState({ page: 'result', reviewIndex: index, original: message.change.before, proposal: message.change.after, lastReply: message.text, lastPrompt: message.requestPrompt || this.state.lastPrompt, diffView: 'diff', diffIndex: 0, expandDiff: false });
    },
    apply: function () {
      if ((this.props.value || '') !== this.state.original) return this.setState({ error: '正文在生成后发生了变化。请重新生成修改，避免覆盖你刚才的编辑。' });
      var replacement = this.state.proposal;
      if (!replacement || !replacement.trim()) return this.setState({ error: '修改正文不能为空' });
      this.props.onChange(replacement);
      var messages = this.state.messages.map(function (message, index) { return index === this.state.reviewIndex && message.change ? Object.assign({}, message, { change: Object.assign({}, message.change, { after: replacement, status: 'applied' }) }) : message; }, this);
      this.setState({ messages: messages, page: 'edit', editorVersion: this.state.editorVersion + 1, undo: { before: this.state.original, after: replacement, index: this.state.reviewIndex }, proposal: null, status: '已应用到编辑器。请预览，再使用后台的保存草稿或发布按钮。', error: '' });
    },
    undo: function () {
      if ((this.props.value || '') !== this.state.undo.after) return this.setState({ error: '应用后正文已有新编辑，无法直接撤销。请保留当前内容并手动调整。' });
      this.props.onChange(this.state.undo.before);
      var messages = this.state.messages.map(function (message, index) { return index === this.state.undo.index && message.change ? Object.assign({}, message, { change: Object.assign({}, message.change, { status: 'pending' }) }) : message; }, this);
      this.setState({ messages: messages, editorVersion: this.state.editorVersion + 1, undo: null, status: '已撤销上次应用。', error: '' });
    },
    moveDiff: function (direction) {
      var count = this.diffCache && this.diffCache.data ? this.diffCache.data.groups.length : 0;
      if (!count) return;
      var index = (this.state.diffIndex + direction + count) % count;
      this.setState({ diffIndex: index }, function () {
        var node = this.diffNodes && this.diffNodes[index];
        if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    },
    renderDiff: function () {
      var self = this, state = this.state;
      if (!this.diffCache || this.diffCache.before !== state.original || this.diffCache.after !== state.proposal) {
        this.diffCache = { before: state.original, after: state.proposal, data: window.ArticleDiff ? window.ArticleDiff.build(state.original, state.proposal) : null };
      }
      var diff = this.diffCache.data;
      if (!diff) return h('div', { className: 'aa-error' }, '差异暂时无法计算，请切换到全文视图审阅。');
      this.diffNodes = {};
      function cell(text, number, kind) {
        return h('div', { className: 'aa-diff-cell ' + (text === null ? 'aa-diff-blank' : kind) }, h('span', { className: 'aa-line-number', 'aria-hidden': true }, number), h('span', { className: 'aa-diff-sign', 'aria-hidden': true }, text === null ? '' : kind === 'aa-deleted' ? '−' : kind === 'aa-added' ? '+' : ' '), h('code', null, text === null ? '' : text || ' '));
      }
      return h('section', { className: 'aa-diff', 'aria-label': '逐行差异对比' },
        h('div', { className: 'aa-diff-toolbar' }, h('span', null, h('b', { className: 'aa-add-count' }, '+' + diff.added), ' / ', h('b', { className: 'aa-delete-count' }, '−' + diff.removed), ' · ' + diff.groups.length + ' 处改动'),
          h('div', { className: 'aa-actions' }, h('button', { type: 'button', className: 'aa-button', disabled: !diff.groups.length, onClick: function () { self.moveDiff(-1); } }, '上一处'), h('span', null, diff.groups.length ? (Math.min(state.diffIndex, diff.groups.length - 1) + 1) + '/' + diff.groups.length : '无差异'), h('button', { type: 'button', className: 'aa-button', disabled: !diff.groups.length, onClick: function () { self.moveDiff(1); } }, '下一处'))),
        h('label', { className: 'aa-check aa-diff-toggle' }, h('input', { type: 'checkbox', checked: state.expandDiff, onChange: function (event) { self.setState({ expandDiff: event.target.checked }); } }), '显示未修改内容'),
        h('div', { className: 'aa-diff-scroll', tabIndex: 0, 'aria-label': '红色删除、绿色新增，两侧同步滚动' },
          h('div', { className: 'aa-diff-titles' }, h('span', null, '原文 · 删除'), h('span', null, '修改后 · 新增')),
          window.ArticleDiff.visible(diff.rows, state.expandDiff).map(function (row, index) {
            if (row.gap) return h('button', { key: 'gap-' + index, type: 'button', className: 'aa-diff-gap', onClick: function () { self.setState({ expandDiff: true }); } }, '··· ' + row.gap + ' 行未修改内容 · 点击展开');
            return h('div', { key: index, className: 'aa-diff-row' + (row.changed && row.group === state.diffIndex ? ' aa-diff-current' : ''), ref: row.first ? function (node) { self.diffNodes[row.group] = node; } : undefined }, cell(row.left, row.oldLine, row.changed ? 'aa-deleted' : ''), cell(row.right, row.newLine, row.changed ? 'aa-added' : ''));
          })), h('p', { className: 'aa-note' }, '按行对齐；红色为删除，绿色为新增。切换“编辑全文”可调整修改，再返回查看差异。'));
    },
    render: function () {
      var self = this, state = this.state;
      function button(text, action, disabled, kind) { return h('button', { type: 'button', onClick: action, disabled: disabled, className: 'aa-button ' + (kind || '') }, text); }
      function go(page) { self.setState({ page: page }); }
      function field(label, key, type) { return h('label', { className: 'aa-field' }, label, h('input', { type: type || 'text', value: state[key], autoComplete: 'off', spellCheck: false, onChange: function (event) { var next = {}; next[key] = event.target.value; self.setState(next); } })); }
      function empty(title, detail) { return h('div', { className: 'aa-empty' }, h('strong', null, title), h('p', null, detail)); }
      var urls = articleImages(this.props.value || '');
            var imagePage = Math.min(state.imagePage, Math.max(0, Math.ceil(urls.length / 8) - 1));
      var content;
      if (state.page === 'settings') content = h('div', { className: 'aa-page' },
        h('div', { className: 'aa-page-title' }, h('h3', null, '连接设置'), h('p', null, '配置一次，开始编辑与看图。')),
        field('API Key', 'apiKey', 'password'), field('管理密钥 · 与图库相同', 'managerSecret', 'password'),
        h('label', { className: 'aa-check' }, h('input', { type: 'checkbox', checked: state.remember, onChange: function (event) { self.setState({ remember: event.target.checked }); if (!event.target.checked) try { sessionStorage.removeItem('articleAgentKey'); } catch (_) {} } }), '在当前标签页记住 API Key'),
        h('p', { className: 'aa-note' }, '默认仅保存在页面内存，不写入文章或仓库。'),
        h('details', { className: 'aa-details' }, h('summary', null, '接口与模型'), field('接口地址（Base URL）', 'baseUrl'), field('模型名称', 'model')),
        h('div', { className: 'aa-actions' }, button('保存并返回', this.configure, state.busy, 'aa-primary'), button('清除 API Key', this.clearKey, state.busy)));
      else if (state.page === 'images') content = h('div', { className: 'aa-page' },
        h('div', { className: 'aa-page-title' }, h('h3', null, '图片上下文'), h('p', null, '已选择 ' + state.images.length + ' / 4 张，只识别本次附图。')),
        h('label', { className: 'aa-upload' }, '＋ 上传参考图片', h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, disabled: state.busy || state.imageBusy, onChange: this.addFiles })),
        state.images.length > 0 && h('div', { className: 'aa-attachments' }, state.images.map(function (image, index) { return h('div', { key: image.url, className: 'aa-attachment' }, h('img', { src: image.url, alt: image.name }), h('span', null, image.name), button('移除', function () { self.setState({ images: state.images.filter(function (_, i) { return i !== index; }) }); }, state.busy || state.imageBusy)); })),
        h('h4', null, '文章配图 · ' + urls.length),
        urls.length ? h('div', { className: 'aa-thumbnails' }, urls.slice(imagePage * 8, imagePage * 8 + 8).map(function (url) { return h('label', { key: url, className: 'aa-thumbnail' }, h('input', { type: 'checkbox', checked: state.images.some(function (x) { return x.url === url; }), disabled: state.busy || state.imageBusy, onChange: function () { self.toggleImage(url); } }), h('img', { src: url, alt: '文章配图', loading: 'lazy' }), h('span', null, filename(url))); })) : empty('正文中暂无图床图片', '可以上传参考图，或先在正文插入图片链接。'),
        urls.length > 8 && h('div', { className: 'aa-pagination' }, button('上一页', function () { self.setState({ imagePage: imagePage - 1 }); }, imagePage === 0), h('span', null, (imagePage + 1) + ' / ' + Math.ceil(urls.length / 8)), button('下一页', function () { self.setState({ imagePage: imagePage + 1 }); }, (imagePage + 1) * 8 >= urls.length)),
        h('p', { className: 'aa-note' }, '上传附件仅用于分析，不会自动存入图床。'), button('完成选择，返回编辑', function () { go('edit'); }, state.imageBusy, 'aa-primary'));
      else if (state.page === 'result') content = h('div', { className: 'aa-page' },
        h('div', { className: 'aa-page-title' }, h('h3', null, state.proposal !== null ? '审阅修改' : '助手回复'), h('p', null, state.proposal !== null ? '确认内容后应用到正文，再保存草稿或发布。' : '分析与建议会显示在这里。')),
        state.lastReply ? h('div', { className: 'aa-latest', ref: function (node) { self.resultNode = node; }, 'aria-label': '最新回复' }, h('div', { className: 'aa-message-text' }, state.lastReply)) : empty('还没有处理结果', '发送编辑要求后，将自动切换到这里。'),
        state.proposal !== null && h('section', { className: 'aa-review' },
          h('div', { className: 'aa-review-actions' }, button('应用到正文', this.apply, state.busy, 'aa-primary'), button('放弃修改', function () { self.setState({ proposal: null, status: '已放弃此次修改，正文未改动。' }); }, state.busy)),
          h('div', { className: 'aa-segments', 'aria-label': '对比视图' }, ['diff', 'after', 'before'].map(function (view) { return button({ diff: '差异对比', after: '编辑全文', before: '原文' }[view], function () { self.setState({ diffView: view }); }, false, state.diffView === view ? 'aa-selected' : ''); })),
          state.diffView === 'diff' ? this.renderDiff() : h('div', { className: 'aa-comparison aa-single' }, state.diffView !== 'after' && h('label', null, '原文', h('textarea', { readOnly: true, value: state.original, rows: 15 })), state.diffView !== 'before' && h('label', null, '修改后 · 可继续编辑', h('textarea', { value: state.proposal, rows: 15, onChange: function (event) { self.setState({ proposal: event.target.value }); } })))),
        state.lastReply && state.proposal === null && state.lastPrompt && !state.undo && button('按此要求生成正文修改', this.generateEdit, state.busy, 'aa-primary'),
        button('继续提出要求', function () { go('edit'); }, false));
      else content = h('div', { className: 'aa-chat-layout' },
        h('div', { className: 'aa-thread', 'aria-label': '文章助手聊天', 'aria-live': 'polite' },
          !state.messages.length && h('div', { className: 'aa-chat-welcome' }, h('span', { className: 'aa-welcome-symbol' }, '✦'), h('h3', null, '一起完善这篇文章'), h('p', null, '润色表达、补充实验，也能看图检查。'),
            h('div', { className: 'aa-chat-suggestions' }, ['补充实验验证方式', '检查图文是否一致', '优化段落表达'].map(function (text) { return button(text + ' ↗', function () { self.setState({ prompt: text }); }, state.busy); }))),
          state.messages.map(function (message, index) { var latest = index === state.messages.length - 1 && message.role === 'assistant'; return h('div', { key: index, className: 'aa-chat-message aa-chat-' + message.role }, h('div', { className: 'aa-chat-author' }, message.role === 'user' ? '你' : '✦ 文章助手'), h('div', { className: 'aa-chat-bubble' }, h('div', { className: 'aa-message-text' }, message.text),
            message.change && h('div', { className: 'aa-change-card' }, h('div', null, h('strong', null, message.change.status === 'applied' ? '这轮修改已应用' : '这轮修改可审阅'), h('small', null, '保留本轮原文与修改后的差异')), button('查看修改 →', function () { self.reviewMessage(index); }, state.busy, 'aa-primary')),
            latest && !message.change && !state.busy && h('div', { className: 'aa-note' }, '本轮仅返回说明，未生成正文差异。'),
            latest && !message.change && state.lastPrompt && !state.undo && button('按此要求修改正文', self.generateEdit, state.busy),
            latest && state.undo && h('span', { className: 'aa-applied-label' }, '✓ 修改已应用'))); }),
          state.busy && h('div', { className: 'aa-chat-message aa-chat-user' }, h('div', { className: 'aa-chat-author' }, '你'), h('div', { className: 'aa-chat-bubble aa-message-text' }, state.prompt)),
          state.busy && h('div', { className: 'aa-chat-message aa-chat-assistant' }, h('div', { className: 'aa-chat-author' }, '✦ 文章助手'), h('div', { className: 'aa-chat-bubble aa-thinking' }, '正在处理正文' + (state.images.length ? '和图片' : '') + '…')),
          h('div', { ref: function (node) { self.resultNode = node; } })),
        h('div', { className: 'aa-chat-composer' },
          state.images.length > 0 && h('div', { className: 'aa-chat-attachments' }, state.images.map(function (image, index) { return h('div', { key: image.url, className: 'aa-chat-attachment' }, h('img', { src: image.url, alt: image.name }), h('span', { title: image.name }, image.name), button('×', function () { self.setState({ images: state.images.filter(function (_, i) { return i !== index; }) }); }, state.busy || state.imageBusy)); })),
          h('label', { className: 'aa-chat-input' }, h('span', { className: 'aa-visually-hidden' }, '编辑要求'), h('textarea', { rows: 3, maxLength: 6000, value: state.prompt, disabled: state.busy, placeholder: '说说你的想法，或添加图片一起讨论…', onChange: function (event) { self.setState({ prompt: event.target.value }); }, onKeyDown: function (event) { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); self.send(); } } })),
          h('div', { className: 'aa-chat-tools' }, h('div', { className: 'aa-actions' }, h('label', { className: 'aa-upload aa-tool-upload', title: '添加参考图片' }, '＋ 图片', h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, disabled: state.busy || state.imageBusy, onChange: this.addFiles })), button('文章配图', function () { go('images'); }, state.busy),
            h('label', { className: 'aa-mode-label' }, h('span', { className: 'aa-visually-hidden' }, '处理方式'), h('select', { value: state.mode, disabled: state.busy, onChange: function (event) { self.setState({ mode: event.target.value }); } }, h('option', { value: 'edit' }, '修改正文'), h('option', { value: 'analyze' }, '仅问答')))),
            state.busy ? button('停止', function () { if (self.controller) self.controller.abort(); }) : button('发送 ↑', this.send, state.imageBusy || !state.prompt.trim(), 'aa-primary')),
          h('div', { className: 'aa-composer-hint' }, state.imageBusy ? '正在处理图片…' : '当前文章 · 遵循写作规则', h('span', null, 'Ctrl / ⌘ + Enter 发送'))));
      var panel = state.open && h('div', { className: 'aa-panel' },
        h('div', { className: 'aa-content ' + (state.page === 'edit' ? 'aa-chat-content' : ''), key: state.page }, content),
        state.error && h('div', { className: 'aa-error', role: 'alert' }, state.error),
        state.page !== 'edit' && state.status && h('div', { className: 'aa-status' + (state.proposal !== null ? ' aa-pending' : ''), role: 'status', 'aria-live': 'polite' }, state.status),
        state.page === 'edit' && state.undo && h('div', { className: 'aa-chat-undo' }, h('span', null, '修改已应用，记得保存草稿。'), button('撤销', this.undo, state.busy)));
      return h('div', null, h('section', { className: 'article-agent aa-floating ' + (state.open ? 'aa-open' : 'aa-closed'), style: state.open ? { left: state.x + 'px', top: state.y + 'px' } : state.dockX !== null ? { left: state.dockX + 'px', top: state.dockY + 'px', bottom: 'auto' } : undefined, role: state.open ? 'dialog' : undefined, 'aria-modal': false, 'aria-label': '文章助手' }, h('div', { className: 'aa-titlebar' }, h('button', { className: 'aa-heading', type: 'button', title: state.open ? '拖动移动，点击收起' : '拖动移动，点击展开', 'aria-expanded': state.open, onPointerDown: this.drag, onClick: function () { if (self.dragged) { self.dragged = false; return; } self.setOpen(!state.open); } }, h('span', null, '✦ 文章助手'), !state.open && h('span', { className: 'aa-heading-detail' }, '编辑 · 看图')),
        state.open && h('div', { className: 'aa-title-tools' }, state.page === 'edit' ? button('清空', function () { self.setState({ messages: [], lastReply: '', lastPrompt: '', proposal: null, error: '', status: '' }); }, state.busy) : button('‹ 返回', function () { go('edit'); }, false), button('⚙ 设置', function () { go(state.page === 'settings' ? 'edit' : 'settings'); }, false), button('收起', function () { self.setOpen(false); }, false))), panel), h(markdown.control, Object.assign({}, this.props, { key: state.editorVersion, field: this.props.field.set('widget', 'markdown') })));
    }
  });
  CMS.registerWidget({ name: 'agent-markdown', controlComponent: Control, previewComponent: markdown.preview, schema: markdown.schema, globalStyles: markdown.globalStyles, allowMapValue: markdown.allowMapValue });
}());
