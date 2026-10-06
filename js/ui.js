/* UI: mengikat kontrol DOM ke aksi app dan memperbarui tampilan (status, statistik,
 * toast, dialog). Logika utama ada di main.js, file ini hanya urusan tampilan. */
(function (ns) {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var fmtNum = function (n, d) { return ns.Stats.fmtNum(n, d); };

  var STATE_TEXT = {
    idle: 'Siapkan bidak',
    ready: 'Siap jalan',
    running: 'Berjalan',
    paused: 'Dijeda',
    done: 'Selesai'
  };

  function UI() {
    this.el = {
      stateChip: $('#state-chip'),
      algoPill: $('#algo-pill'),
      algoMeta: $('#algo-meta'),
      run: $('#btn-run'),
      pause: $('#btn-pause'),
      step: $('#btn-step'),
      finish: $('#btn-finish'),
      runHint: $('#run-hint'),
      speed: $('#speed'),
      speedOut: $('#speed-out'),
      diagonal: $('#diagonal'),
      heuristic: $('#heuristic-out'),
      piecesMeta: $('#pieces-meta'),
      coach: $('#coach'),
      coachPiece: $('#coach .coach__piece'),
      coachStep: $('#coach-step'),
      coachTitle: $('#coach-title'),
      coachDesc: $('#coach-desc'),
      hint: $('#hint'),
      playbar: $('.playbar'),
      results: $('#hasil'),
      rowsRange: $('#rows-range'), rowsNum: $('#rows-num'),
      colsRange: $('#cols-range'), colsNum: $('#cols-num'),
      cellTotal: $('#cell-total'), sizeMeta: $('#size-meta'),
      density: $('#density'), densityOut: $('#density-out'),
      status: $('#status'),
      resultChip: $('#result-chip'),
      driverName: $('#driver-name'), driverSub: $('#driver-sub'), fare: $('#fare'),
      tracker: $('#tracker'),
      time: $('#st-time'), visited: $('#st-visited'), length: $('#st-length'),
      cost: $('#st-cost'), steps: $('#st-steps'), frontier: $('#st-frontier'),
      dsName: $('#ds-name'), dsItems: $('#ds-items'),
      rating: $('#rating'), stars: $('#stars'), ratingNote: $('#rating-note'),
      insight: $('#insight'), cmpInsight: $('#cmp-insight'),
      toasts: $('#toasts')
    };
    this._lastDs = 0;
  }

  var P = UI.prototype;

  /* ---------- Binding kontrol ---------- */
  P.bind = function (app) {
    var el = this.el, self = this;

    el.run.addEventListener('click', function () { app.run(); });
    el.pause.addEventListener('click', function () { app.togglePause(); });
    el.step.addEventListener('click', function () { app.step(); });
    el.finish.addEventListener('click', function () { app.finish(); });

    el.speed.addEventListener('input', function () {
      app.setSpeed(+el.speed.value);
      self.syncSpeed(+el.speed.value);
    });

    $$('input[name="algo"]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) app.setAlgo(r.value); });
    });
    el.diagonal.addEventListener('change', function () { app.setDiagonal(el.diagonal.checked); });
    $$('input[name="tool"]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) app.settings.tool = +r.value; });
    });

    // Ukuran grid: slider dan input angka saling sinkron.
    function onSize(src) {
      var rows = +(src === 'num' ? el.rowsNum.value : el.rowsRange.value);
      var cols = +(src === 'num' ? el.colsNum.value : el.colsRange.value);
      if (!rows || !cols) return;
      app.resize(rows, cols);
    }
    el.rowsRange.addEventListener('input', function () { onSize('range'); });
    el.colsRange.addEventListener('input', function () { onSize('range'); });
    el.rowsNum.addEventListener('change', function () { onSize('num'); });
    el.colsNum.addEventListener('change', function () { onSize('num'); });

    el.density.addEventListener('input', function () {
      app.settings.density = el.density.value / 100;
      el.densityOut.value = el.density.value + '%';
      self.fillRange(el.density);
    });

    $$('[data-action="autoplace"]').forEach(function (b) { b.addEventListener('click', function () { app.autoPlace(); }); });
    $('#btn-maze').addEventListener('click', function () { app.generateMaze(); });
    $('#btn-random').addEventListener('click', function () { app.randomBuildings(); });
    $('#btn-clear-vis').addEventListener('click', function () { app.clearVis(); });
    $('#btn-clear-walls').addEventListener('click', function () { app.clearWalls(); });
    $('#btn-reset-all').addEventListener('click', function () { app.resetAll(); });
    $('#btn-save').addEventListener('click', function () { app.saveMap(); });
    $('#btn-load').addEventListener('click', function () { app.loadMap(); });
    $('#btn-export').addEventListener('click', function () { app.exportMap(); });
    $('#file-import').addEventListener('change', function (e) {
      if (e.target.files[0]) app.importFile(e.target.files[0]);
      e.target.value = '';
    });
    $('#btn-compare').addEventListener('click', function () { app.compareAll(); });
    $('#btn-quiz').addEventListener('click', function () { app.openQuiz(); });
    $('#btn-reset-progress').addEventListener('click', function () {
      if (window.confirm('Hapus semua SelPoin, misi, dan riwayat?')) app.game.reset();
    });

    $('#btn-help').addEventListener('click', function () { $('#dlg-help').showModal(); });
    $('#btn-about').addEventListener('click', function () { $('#dlg-about').showModal(); });
    $('#btn-theme').addEventListener('click', function () { app.toggleTheme(); });

    // Klik di luar kotak dialog menutup dialog.
    $$('dialog').forEach(function (d) {
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    });

    $$('input[type="range"]').forEach(function (r) { self.fillRange(r); r.addEventListener('input', function () { self.fillRange(r); }); });

    this.renderScenarios(app);
    this.bindScrollSpy();
  };

  // Warna isian slider (WebKit tidak punya ::range-progress).
  P.fillRange = function (r) {
    var pct = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty('--fill', pct + '%');
  };

  P.renderScenarios = function (app) {
    var list = $('#scenario-list'), tpl = $('#tpl-scenario');
    ns.Scenarios.forEach(function (sc) {
      var node = tpl.content.cloneNode(true), li = node.querySelector('li');
      li.style.setProperty('--tone', sc.tone);
      li.querySelector('.promo-card__tag').textContent = sc.tag;
      li.querySelector('.promo-card__title').textContent = sc.title;
      li.querySelector('.promo-card__desc').textContent = sc.desc;
      li.querySelector('canvas').dataset.scenario = sc.id;
      var btn = li.querySelector('button');
      btn.setAttribute('aria-label', 'Coba skenario ' + sc.title);
      btn.addEventListener('click', function () { app.loadScenario(sc); });
      list.appendChild(node);
    });
    this.drawThumbs();
  };

  // Thumbnail tiap skenario digambar dari peta aslinya + jalur optimal (Dijkstra).
  P.drawThumbs = function () {
    var cs = getComputedStyle(document.documentElement);
    var col = function (n) { return cs.getPropertyValue(n).trim(); };
    $$('.promo-card__thumb').forEach(function (cv) {
      var sc = ns.Scenarios.filter(function (x) { return x.id === cv.dataset.scenario; })[0];
      var b = sc.build(), g = b.grid, ctx = cv.getContext('2d');
      var s = Math.min(cv.width / g.cols, cv.height / g.rows);
      var ox = (cv.width - s * g.cols) / 2, oy = (cv.height - s * g.rows) / 2;
      ctx.fillStyle = col('--surface-2');
      ctx.fillRect(0, 0, cv.width, cv.height);
      var res = ns.algorithms.dijkstra.solve(g.cells, g.rows, g.cols, g.startIndex(), g.goalIndex(), { diagonal: b.diagonal });
      var onPath = {};
      if (res.path) res.path.forEach(function (i) { onPath[i] = true; });
      for (var i = 0; i < g.cells.length; i++) {
        var r = (i / g.cols) | 0, c = i - r * g.cols, v = g.cells[i];
        if (v === 0 && !onPath[i]) continue;
        ctx.fillStyle = onPath[i] ? col('--gs-green-600') : v === 1 ? col('--cell-wall') : col('--cell-jam');
        ctx.fillRect(ox + c * s, oy + r * s, Math.ceil(s), Math.ceil(s));
      }
      [['start', col('--gs-green-800')], ['goal', col('--gs-amber-500')]].forEach(function (p) {
        var pc = g[p[0]];
        ctx.fillStyle = p[1];
        ctx.beginPath();
        ctx.arc(ox + (pc.c + 0.5) * s, oy + (pc.r + 0.5) * s, Math.max(3, s * 0.9), 0, Math.PI * 2);
        ctx.fill();
      });
    });
  };

  // Menandai menu navigasi sesuai bagian yang sedang terlihat.
  P.bindScrollSpy = function () {
    if (!window.IntersectionObserver) return;
    var links = $$('.bottomnav a, .topnav a');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + en.target.id));
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['lab', 'hasil', 'perbandingan', 'belajar', 'misi'].forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });
  };

  /* ---------- Sinkronisasi tampilan ---------- */
  P.syncState = function (app) {
    var el = this.el, st = app.machine.state, S = ns.STATES;
    var ready = app.grid.hasPieces();
    el.stateChip.dataset.state = st;
    el.stateChip.textContent = STATE_TEXT[st];

    el.run.disabled = !ready || st === S.RUNNING || app.busy;
    el.run.querySelector('span').textContent = st === S.DONE ? 'Jalankan lagi' : (st === S.PAUSED ? 'Lanjut' : 'Jalankan');
    // Saat dijeda, tombol utama berubah jadi "Lanjut", jadi tombol Jeda cukup aktif saat berjalan.
    el.pause.disabled = st !== S.RUNNING;
    el.step.disabled = !ready || st === S.DONE || app.busy;
    el.finish.disabled = !ready || st === S.DONE || app.busy;

    this.syncCoach(app, st);
  };

  /* Panduan 3 langkah untuk pengguna baru: kurir -> tujuan -> Jalankan.
   * Selama bidak belum lengkap, kontrol lain disembunyikan supaya fokus. */
  P.syncCoach = function (app, st) {
    var el = this.el, g = app.grid, S = ns.STATES;
    var need = !g.start ? 'start' : (!g.goal ? 'goal' : null);
    var firstRun = !app.hasRun && !app.game.history.length;

    el.coach.hidden = !need;
    el.playbar.hidden = !!need;
    el.results.classList.toggle('is-empty', st === S.IDLE || st === S.READY);
    el.run.classList.toggle('is-nudge', !need && st === S.READY && firstRun);

    if (need) {
      var isStart = need === 'start';
      el.coachStep.textContent = 'Langkah ' + (isStart ? 1 : 2) + ' dari 3';
      el.coachTitle.textContent = isStart ? 'Seret kurir ke peta' : 'Sekarang seret alamat tujuan';
      el.coachDesc.textContent = isStart
        ? 'Tarik ikon kurir ke sel mana saja di peta. Di HP: ketuk ikonnya, lalu ketuk peta.'
        : 'Taruh pin tujuan agak jauh dari kurir supaya pencariannya seru.';
      el.coachPiece.dataset.piece = need;
      el.coachPiece.querySelector('use').setAttribute('href', isStart ? '#i-courier' : '#i-pin');
      el.coachPiece.setAttribute('aria-label', 'Seret ' + (isStart ? 'kurir' : 'alamat tujuan') + ' ke peta');
      el.hint.textContent = 'Ikuti langkah di bawah untuk memulai.';
    } else {
      el.hint.textContent = 'Tekan dan geser di peta untuk menambah gedung. Bidak di peta bisa digeser.';
    }
    $$('.pieces .piece').forEach(function (p) { p.classList.toggle('is-next', p.dataset.piece === need); });

    el.runHint.textContent = (!need && st === S.READY && firstRun)
      ? 'Langkah 3 dari 3: tekan Jalankan dan lihat bagaimana algoritma mencari jalan.' : '';
  };

  P.syncPieces = function (grid) {
    var count = 0;
    ['start', 'goal'].forEach(function (k) {
      var p = grid[k], small = $('[data-pos="' + k + '"]'), card = $('.pieces .piece[data-piece="' + k + '"]');
      if (p) count++;
      small.textContent = p ? 'Baris ' + (p.r + 1) + ', kolom ' + (p.c + 1) : 'Belum di peta';
      card.classList.toggle('is-placed', !!p);
    });
    this.el.piecesMeta.textContent = count + '/2';
  };

  P.syncSize = function (grid) {
    var el = this.el;
    el.rowsRange.value = el.rowsNum.value = grid.rows;
    el.colsRange.value = el.colsNum.value = grid.cols;
    el.cellTotal.value = fmtNum(grid.rows * grid.cols);
    el.sizeMeta.textContent = grid.rows + ' × ' + grid.cols;
    this.fillRange(el.rowsRange);
    this.fillRange(el.colsRange);
  };

  P.syncSpeed = function (v) {
    var label = v < 15 ? 'Siput' : v < 40 ? 'Pelan' : v < 70 ? 'Sedang' : v < 90 ? 'Cepat' : 'Kilat';
    this.el.speedOut.value = label;
    this.el.speed.setAttribute('aria-valuetext', label);
  };

  P.syncAlgo = function (id) {
    var algo = ns.algorithms[id];
    $$('input[name="algo"]').forEach(function (r) { r.checked = r.value === id; });
    this.el.algoPill.dataset.algo = id;
    this.el.algoPill.textContent = algo.name;
    this.el.algoMeta.textContent = algo.name;
    this.el.driverName.textContent = 'Kurir ' + algo.name;
    this.el.driverSub.textContent = algo.structure;
    this.el.dsName.textContent = algo.structure;
    // Panel belajar: buka & sorot algoritma terpilih
    $$('.algo-card').forEach(function (d) {
      var on = d.dataset.algo === id;
      d.classList.toggle('is-selected', on);
      d.open = on;
    });
  };

  P.syncDiagonal = function (on) {
    this.el.diagonal.checked = on;
    this.el.heuristic.value = on ? 'Octile' : 'Manhattan';
  };

  /* ---------- Status & hasil ---------- */
  P.setStatus = function (text, tone) {
    var s = this.el.status;
    s.textContent = text;
    s.dataset.tone = tone || 'info';
    s.style.animation = 'none';
    void s.offsetWidth;
    s.style.animation = '';
  };

  // Chip status hasil opsional (tracker sudah menampilkan tahap pengantaran).
  P.setResultChip = function (text, tone) {
    if (!this.el.resultChip) return;
    this.el.resultChip.textContent = text;
    this.el.resultChip.dataset.tone = tone;
  };

  // step: search | route | deliver | done ; fail = tidak ada jalur
  P.setTracker = function (step, fail) {
    var order = ['search', 'route', 'deliver', 'done'];
    var idx = step ? order.indexOf(step) : -1;
    $$('#tracker li').forEach(function (li, i) {
      li.classList.toggle('is-done', i < idx || (step === 'done' && i === idx && !fail));
      li.classList.toggle('is-active', i === idx && step !== 'done' && !fail);
      li.classList.toggle('is-fail', !!fail && i === idx);
    });
  };

  P.resetResult = function () {
    var el = this.el;
    ['time', 'visited', 'length', 'cost', 'steps', 'frontier'].forEach(function (k) { el[k].value = '–'; el[k].dataset.num = 0; });
    el.fare.value = 'Rp0';
    el.rating.hidden = true;
    el.insight.hidden = true;
    document.getElementById('hasil').classList.remove('has-result');
    el.dsItems.textContent = '';
    this.setTracker(null);
    this.setResultChip('Belum jalan', 'idle');
  };

  P.startRun = function (algoId, timeMs) {
    this.resetResult();
    this.el.time.value = fmtNum(timeMs, 3);
    this.flash(this.el.time);
    this.setTracker('search');
    this.setResultChip('Mencari rute', 'run');
    this.setStatus('Kurir ' + ns.algorithms[algoId].name + ' sedang mencari rute…', 'run');
  };

  P.progress = function (anim, app) {
    var el = this.el;
    el.visited.value = fmtNum(anim.expanded);
    el.steps.value = fmtNum(anim.played);
    el.frontier.value = fmtNum(anim.frontier);
    var now = performance.now();
    if (now - this._lastDs > 90 || anim.phase !== 'search') {
      this._lastDs = now;
      this.renderDs(anim, app);
    }
  };

  // Cuplikan isi struktur data: queue dari depan, stack dari atas, PQ urut kunci.
  P.renderDs = function (anim, app) {
    var ol = this.el.dsItems, grid = app.grid, id = app.run_algo || app.settings.algo;
    var items = anim.fr.slice();
    if (id === 'dfs') items.reverse();
    else if (id !== 'bfs' && app.keyOf) {
      items.sort(function (a, b) { return app.keyOf(a) - app.keyOf(b); });
    }
    ol.textContent = '';
    var max = 7;
    items.slice(0, max).forEach(function (i) {
      var li = document.createElement('li');
      var r = (i / grid.cols) | 0, c = i - r * grid.cols;
      li.textContent = (r + 1) + ',' + (c + 1);
      ol.appendChild(li);
    });
    if (items.length > max) {
      var more = document.createElement('li');
      more.className = 'more';
      more.textContent = '+' + (items.length - max);
      ol.appendChild(more);
    }
  };

  P.showResult = function (m) {
    var el = this.el;
    var up = ns.motion.countUp, sec = document.getElementById('hasil');
    sec.classList.remove('has-result');
    void sec.offsetWidth;            // restart animasi kartu statistik
    sec.classList.add('has-result');
    el.time.value = fmtNum(m.time, 3);
    up(el.visited, m.visited, function (n) { return fmtNum(Math.round(n)); });
    if (m.found) {
      up(el.length, m.length, function (n) { return fmtNum(Math.round(n)); });
      up(el.cost, m.cost, function (n) { return ns.Stats.fmtCost(n === m.cost ? n : Math.round(n)); });
    } else {
      el.length.value = 'tidak ada';
      el.cost.value = ns.Stats.fmtCost(m.cost);
    }
    [el.visited, el.length, el.cost].forEach(this.flash);
    if (m.found) {
      // Ongkir main-main: Rp4.000 + Rp1.000 per satuan biaya, dibulatkan ke Rp500.
      var fare = Math.round((4000 + m.cost * 1000) / 500) * 500;
      el.fare.value = 'Rp' + fare.toLocaleString('id-ID');
      this.setTracker('done');
      this.setResultChip('Terkirim', 'ok');
      this.setStatus('Jalur ditemukan! Panjang ' + m.length + ' sel, total biaya ' + ns.Stats.fmtCost(m.cost) + '.', 'ok');
    } else {
      el.fare.value = 'Rp0';
      this.setTracker('search', true);
      this.setResultChip('Gagal antar', 'bad');
      this.setStatus('Tidak ada jalur. Alamat tujuan terkurung gedung, kurir tidak bisa masuk.', 'bad');
    }
    el.dsItems.textContent = '';
  };

  P.showRating = function (stars, note) {
    var el = this.el;
    el.stars.textContent = '';
    for (var i = 0; i < 5; i++) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#i-star');
      svg.appendChild(use);
      if (i < stars) svg.setAttribute('class', 'on');
      el.stars.appendChild(svg);
    }
    el.stars.setAttribute('aria-label', stars + ' dari 5 bintang');
    el.ratingNote.textContent = note;
    el.rating.hidden = false;
  };

  P.setInsight = function (node, text) {
    node.textContent = text;
    node.hidden = !text;
  };

  P.flash = function (o) {
    o.classList.remove('flash');
    void o.offsetWidth;
    o.classList.add('flash');
  };

  /* ---------- Toast & confetti ---------- */
  P.toast = function (text, tone) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.dataset.tone = tone || 'info';
    t.textContent = text;
    var box = this.el.toasts;
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 2600);
  };

  P.confetti = function () {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#00AA13', '#FFB400', '#6CC24A', '#F52713', '#0E7FD8', '#ffffff'];
    for (var i = 0; i < 60; i++) {
      var c = document.createElement('span');
      c.className = 'confetti';
      c.style.left = (Math.random() * 100) + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      c.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      c.style.setProperty('--dur', (1.4 + Math.random() * 1.2) + 's');
      c.style.animationDelay = (Math.random() * 0.3) + 's';
      document.body.appendChild(c);
      setTimeout((function (n) { return function () { n.remove(); }; })(c), 3000);
    }
  };

  /* ---------- Dialog kuis ---------- */
  P.showQuiz = function (q, contextText, onAnswer) {
    var dlg = $('#dlg-quiz'), opts = $('#quiz-options'), fb = $('#quiz-feedback'), submit = $('#quiz-submit');
    $('#quiz-question').textContent = q.q;
    $('#quiz-context').textContent = contextText;
    opts.textContent = '';
    fb.hidden = true;
    q.options.forEach(function (o, i) {
      var label = document.createElement('label');
      label.className = 'quiz__option';
      label.innerHTML = '<input type="radio" name="quiz"><span></span>';
      label.querySelector('input').value = o.value;
      label.querySelector('input').id = 'quiz-opt-' + i;
      label.querySelector('span').textContent = o.label;
      opts.appendChild(label);
    });
    submit.textContent = 'Jawab';
    submit.dataset.mode = 'answer';
    submit.onclick = function () {
      if (submit.dataset.mode === 'proof') { dlg.close(); onAnswer(null, true); return; }
      var picked = opts.querySelector('input:checked');
      if (!picked) { fb.hidden = false; fb.dataset.tone = 'bad'; fb.textContent = 'Pilih salah satu jawaban dulu.'; return; }
      var ok = q.correct.indexOf(picked.value) !== -1;
      opts.querySelectorAll('.quiz__option').forEach(function (l) {
        var v = l.querySelector('input').value;
        l.querySelector('input').disabled = true;
        if (q.correct.indexOf(v) !== -1) l.classList.add('is-correct');
        else if (v === picked.value) l.classList.add('is-wrong');
      });
      fb.hidden = false;
      fb.dataset.tone = ok ? 'ok' : 'bad';
      fb.textContent = (ok ? 'Benar! +20 SelPoin. ' : 'Belum tepat. ') + q.explain;
      submit.textContent = 'Lihat buktinya';
      submit.dataset.mode = 'proof';
      onAnswer(ok, false);
    };
    if (!dlg.open) dlg.showModal();
  };

  ns.UI = UI;
})(window.GoSel = window.GoSel || {});
