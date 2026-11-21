/* Learn page: one lesson at a time, quiz, stars saved in this browser only. */
(function () {
  var listEl = document.getElementById('progress');
  var box = document.getElementById('lesson');
  if (!box) return;
  var lessons = [];
  var KEY = 'hox-stars';
  var memStars = [];

  var ALT = {
    segments: 'An insect side view split into head, three thorax segments with legs and a wing, and a row of abdomen segments.',
    genes: 'Eight coloured blocks for the Hox genes lab, pb, Dfd, Scr, Antp, Ubx, abd-A and Abd-B, matched to the body from front to back.',
    backwins: 'Two genes overlap on one body segment and the back gene, Ubx, wins.',
    fourwings: 'A normal fly with two wings and two tiny balance knobs next to a fly with four wings.',
    headlegs: 'A fly head with antennae next to a fly head with legs growing where the antennae should be.',
    flybeetle: 'A fly with two soft wings next to a beetle with hard wing covers over its flying wings.',
    headcode: 'Four head segments with the Hox genes that help shape each one.',
    evidence: 'Two cards: one marked seen in a real experiment, one marked the model\'s guess.'
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Escape everything, then allow only <i> and <b>.
  function fmt(s) {
    return esc(s == null ? '' : s).replace(/&lt;(\/?)(i|b)&gt;/gi, '<$1$2>');
  }
  function getStars() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(v)) return v;
    } catch (e) {}
    return memStars.slice();
  }
  function addStar(id) {
    var s = getStars();
    if (s.indexOf(id) < 0) s.push(id);
    memStars = s;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function idx() {
    var h = decodeURIComponent((location.hash || '').replace('#', ''));
    for (var i = 0; i < lessons.length; i++) if (lessons[i].id === h) return i;
    return 0;
  }
  function labLink(L) {
    var t = L.try;
    var p = new URLSearchParams({ sp: t.species, e: JSON.stringify(t.edits || []), lesson: L.id });
    return 'lab.html#' + p.toString();
  }

  function renderList(cur) {
    var stars = getStars();
    var n = lessons.filter(function (L) { return stars.indexOf(L.id) >= 0; }).length;
    listEl.innerHTML = lessons.map(function (L, i) {
      var got = stars.indexOf(L.id) >= 0;
      return '<li><a href="learn.html#' + esc(L.id) + '"' + (i === cur ? ' aria-current="true"' : '') +
        ' aria-label="Lesson ' + (i + 1) + ': ' + esc(L.title) + (got ? ', star earned' : '') + '">' +
        (i + 1) + (got ? '<span class="st" aria-hidden="true">&#9733;</span>' : '') + '</a></li>';
    }).join('');
    var tot = document.getElementById('stars-total');
    if (tot) tot.textContent = n + ' of ' + lessons.length + ' stars earned';
  }

  function render(focus) {
    var i = idx(), L = lessons[i];
    renderList(i);
    var html = '<article class="lesson" aria-labelledby="lt">';
    html += '<p class="mono" style="margin:0;color:var(--muted)">Lesson ' + (i + 1) + ' of ' + lessons.length + '</p>';
    html += '<h2 id="lt" tabindex="-1">' + fmt(L.title) + '</h2>';
    if (L.subtitle) html += '<p class="sub">' + fmt(L.subtitle) + '</p>';
    if (L.picture) html += '<img class="pic" src="assets/img/' + esc(L.picture) + '.svg" alt="' + esc(ALT[L.picture] || L.title) + '" width="640" height="300">';
    html += '<div class="lesson-body">' + (L.body || []).map(function (p) { return '<p>' + fmt(p) + '</p>'; }).join('') + '</div>';
    if (L.try) {
      var look = L.look_for || L.try.look_for;
      html += '<div class="try"><a class="btn sun" href="' + esc(labLink(L)) + '">Try it in the Lab: ' + fmt(L.try.label || 'Open the Lab') + '</a>';
      if (look) html += '<p><b>Look for:</b> ' + fmt(look) + '</p>';
      html += '</div>';
    }
    var q = L.quiz;
    if (q) {
      html += '<section class="quiz" aria-labelledby="qt"><h3 id="qt">Quick quiz</h3><p>' + fmt(q.q) + '</p><div class="opts" role="group" aria-label="Answer choices">';
      html += q.options.map(function (o, k) { return '<button type="button" class="opt" data-k="' + k + '">' + fmt(o) + '</button>'; }).join('');
      html += '</div><p class="feedback" id="fb" role="status" aria-live="polite"></p></section>';
    }
    html += '<div class="lesson-nav">';
    html += i > 0 ? '<a class="btn alt" href="learn.html#' + esc(lessons[i - 1].id) + '">&larr; Previous</a>' : '<span></span>';
    html += i < lessons.length - 1 ? '<a class="btn" href="learn.html#' + esc(lessons[i + 1].id) + '">Next lesson &rarr;</a>' : '<a class="btn" href="lab.html">Play in the Lab</a>';
    html += '</div></article>';
    box.innerHTML = html;

    if (q) {
      var fb = document.getElementById('fb');
      var btns = box.querySelectorAll('.opt');
      var done = false;
      Array.prototype.forEach.call(btns, function (b) {
        b.addEventListener('click', function () {
          if (done) return;
          var k = +b.getAttribute('data-k');
          var why = q.explain || '';
          if (k === q.answer) {
            done = true;
            addStar(L.id);
            b.classList.add('right');
            Array.prototype.forEach.call(btns, function (x) { x.disabled = true; });
            fb.className = 'feedback ok';
            fb.innerHTML = '<span class="star-pop" aria-hidden="true">&#9733;</span> Correct! You earned a star. ' + fmt(why || q.right || '');
            renderList(i);
          } else {
            b.classList.add('wrong');
            b.disabled = true;
            fb.className = 'feedback no';
            fb.innerHTML = 'Not quite. Have another go. ' + fmt(q.wrong || '');
          }
        });
      });
      if (getStars().indexOf(L.id) >= 0) {
        var a = btns[q.answer];
        if (a) a.classList.add('right');
        fb.className = 'feedback ok';
        fb.innerHTML = 'You already earned this star. Want to try again? Pick any answer.';
      }
    }
    if (focus) {
      var h = document.getElementById('lt');
      if (h) { h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start' }); }
    }
  }

  fetch('data/lessons.json').then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (d) {
    lessons = d.lessons || [];
    if (!lessons.length) throw new Error('empty');
    render(false);
    window.addEventListener('hashchange', function () { render(true); });
  }).catch(function () {
    box.innerHTML = '<p class="error">Sorry, the lessons could not load. Try reloading the page.</p>';
  });
})();
