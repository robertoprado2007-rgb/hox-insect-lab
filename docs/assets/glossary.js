/* Glossary page: A-Z list with search. */
(function () {
  var out = document.getElementById('glossary');
  var input = document.getElementById('gl-search');
  var azEl = document.getElementById('gl-az');
  if (!out) return;
  var terms = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(s) { return esc(s).replace(/&lt;(\/?)(i|b)&gt;/gi, '<$1$2>'); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function render() {
    var q = (input && input.value || '').trim().toLowerCase();
    var shown = terms.filter(function (t) {
      return !q || (t.term + ' ' + t.simple + ' ' + (t.more || '')).toLowerCase().indexOf(q) >= 0;
    });
    var html = '', letter = '', letters = [];
    shown.forEach(function (t) {
      var L = t.term.charAt(0).toUpperCase();
      if (L !== letter) {
        letter = L; letters.push(L);
        html += '<h2 class="gl-letter" id="letter-' + esc(L) + '">' + esc(L) + '</h2>';
      }
      html += '<article class="card term" id="term-' + slug(t.term) + '"><h3>' + esc(t.term) + '</h3><p class="simple">' + fmt(t.simple) + '</p>';
      if (t.more) html += '<p>' + fmt(t.more) + '</p>';
      if (t.see && t.see.length) {
        html += '<p class="see"><b>See also:</b> ' + t.see.map(function (s) {
          var hit = terms.some(function (x) { return x.term.toLowerCase() === String(s).toLowerCase(); });
          return hit ? '<a href="#term-' + slug(s) + '" data-term="' + esc(s) + '">' + esc(s) + '</a>' : esc(s);
        }).join(' ') + '</p>';
      }
      html += '</article>';
    });
    out.innerHTML = html || '<p class="empty">No words match. Try a shorter search.</p>';
    if (azEl) azEl.innerHTML = letters.map(function (L) { return '<li><a href="#letter-' + esc(L) + '" aria-label="Jump to ' + esc(L) + '">' + esc(L) + '</a></li>'; }).join('');
    var st = document.getElementById('gl-count');
    if (st) st.textContent = shown.length + ' of ' + terms.length + ' words';
  }

  // A "see" link to a hidden term: clear the search so it shows.
  out.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-term]');
    if (a && input && input.value) { input.value = ''; render(); }
  });

  fetch('data/glossary.json').then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (d) {
    terms = d.terms || [];
    render();
    if (input) input.addEventListener('input', render);
    if (location.hash) {
      var el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView();
    }
  }).catch(function () {
    out.innerHTML = '<p class="error">Sorry, the glossary could not load. Try reloading the page.</p>';
  });
})();
