(function () {
  'use strict';

  function updateEditLink() {
    const previous = document.getElementById('post-admin-edit');
    if (previous) previous.remove();

    const metadata = document.querySelector('#article-container [data-post-admin-edit]');
    const tools = document.getElementById('rightside-config-hide');
    if (!metadata || !tools) return;

    const link = document.createElement('a');
    link.id = 'post-admin-edit';
    link.href = metadata.getAttribute('data-post-admin-edit');
    link.title = '管理员后台：编辑当前文章';
    link.setAttribute('aria-label', '管理员后台：编辑当前文章');
    const icon = document.createElement('i');
    icon.className = 'fas fa-edit';
    icon.setAttribute('aria-hidden', 'true');
    link.appendChild(icon);
    tools.appendChild(link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateEditLink);
  } else {
    updateEditLink();
  }
  document.addEventListener('pjax:complete', updateEditLink);
})();
