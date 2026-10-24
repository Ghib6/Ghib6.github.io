(function () {
  function markPjaxNavigation() {
    document.documentElement.classList.add('pjax-navigation');
  }

  document.addEventListener('pjax:send', markPjaxNavigation);
  document.addEventListener('pjax:complete', markPjaxNavigation);
})();
