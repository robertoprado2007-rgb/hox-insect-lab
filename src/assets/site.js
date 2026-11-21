/* Theme toggle. Choice is remembered only in this browser; works without storage. */
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function label() {
    if (btn) btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  }
  label();
  if (btn) btn.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('hox-theme', next); } catch (e) {}
    label();
  });
})();
