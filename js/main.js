/* Go-Sel — inisialisasi dan pengendali utama aplikasi. */
(function (ns) {
  'use strict';
  var S = ns.STATES;

  var app = {
    settings: ns.settings,
    version: 0,          // naik setiap kali peta/pengaturan berubah
    busy: false,         // true saat animasi pembuatan maze
    fromMaze: false,
    run_algo: null,
    allCache: null,

    init: function () {
      var self = this;
      this.grid = new ns.Grid(20, 30);
      this.machine = new ns.Machine();
      this.ui = new ns.UI();
      this.renderer = new ns.Renderer(
        document.getElementById('stage'),
        document.getElementById('peta'),
        document.getElementById('peta-overlay')
      );
      this.renderer.setGrid(this.grid);

      this.animator = new ns.Animator(this.renderer, {
        onProgress: function (anim) { self.ui.progress(anim, self); },
        onPhase: function (phase) {
          if (phase === 'path') { self.ui.setTracker('route'); self.ui.setStatus('Rute ketemu! Menggambar jalur…', 'run'); }
          if (phase === 'deliver') { self.ui.setTracker('deliver'); self.ui.setResultChip('Mengantar', 'run'); self.ui.setStatus('Kurir sedang mengantar paket…', 'run'); }
        },
        onDone: function () { self.onRunDone(); }
      });
      this.animator.setSpeed(this.settings.speed);

      this.stats = new ns.Stats({
        body: document.getElementById('cmp-body'),
        rowTpl: document.getElementById('tpl-row'),
        table: document.getElementById('cmp-table'),
        stale: document.getElementById('stale'),
        chart: document.getElementById('grafik')
      });

      this.game = new ns.Game({
        points: document.getElementById('points'),
        pointsMini: document.getElementById('points-mini'),
        levelName: document.getElementById('level-name'),
        levelProgress: document.getElementById('level-progress'),
        levelNext: document.getElementById('level-next'),
        missionList: document.getElementById('mission-list'),
        missionTpl: document.getElementById('tpl-mission'),
        missionCount: document.getElementById('mission-count'),
        missionProgress: document.getElementById('mission-progress'),
        badgeList: document.getElementById('badge-list'),
        history: document.getElementById('history')
      }, {
        toast: function (m, t) { self.ui.toast(m, t); },
        confetti: function () { self.ui.confetti(); }
      });

      this.ui.bind(this);
      this.input = new ns.Input(this);
      this.machine.onChange(function () { self.ui.syncState(self); });

      this.ui.syncAlgo(this.settings.algo);
      this.ui.syncDiagonal(this.settings.diagonal);
      this.ui.syncSpeed(this.settings.speed);
      this.ui.syncSize(this.grid);
      this.ui.syncPieces(this.grid);
      this.ui.syncState(this);
      this.ui.resetResult();
      this.stats.drawChart(true);

      // Canvas menyesuaikan ukuran kontainer.
      if (window.ResizeObserver) {
        new ResizeObserver(function () { self.renderer.layout(); }).observe(this.renderer.stage);
      }
      window.addEventListener('resize', function () { self.renderer.layout(); });

      // Lapisan overlay (bidak, jalur, partikel) digambar setiap frame.
      (function loop(now) {
        self.renderer.drawOverlay(now);
        requestAnimationFrame(loop);
      })(performance.now());

      this.bindShortcuts();
      this.watchTheme();
      document.getElementById('kontrol').scrollTop = 0;
      this.openFromLink();
    },

    /* Link skenario, misalnya index.html?skenario=trap&algo=astar&selesai
     *   skenario : id skenario      algo  : algoritma yang dipilih
     *   langkah  : jalankan N langkah lalu jeda      selesai : langsung ke hasil
     *   banding  : isi tabel perbandingan */
    openFromLink: function () {
      var q = new URLSearchParams(location.search);
      if (q.get('tema') === 'gelap' || q.get('tema') === 'terang') {
        document.documentElement.dataset.theme = q.get('tema') === 'gelap' ? 'dark' : 'light';
        this.onThemeChange();
      }
      var sc = ns.Scenarios.filter(function (s) { return s.id === q.get('skenario'); })[0];
      if (!sc) return;
      this.loadScenario(sc);
      if (ns.algorithms[q.get('algo')]) this.setAlgo(q.get('algo'));
      if (q.has('langkah')) {
        for (var i = 0; i < (+q.get('langkah') || 1); i++) this.step();
      } else if (q.has('selesai')) {
        this.finish();
      }
      if (q.has('banding')) this.compareAll();

      var fromLink = /skenario=/.test(location.search);
      if (!fromLink && !ns.store.get('seen-help', false)) {
        ns.store.set('seen-help', true);
        setTimeout(function () { document.getElementById('dlg-help').showModal(); }, 400);
      }
    },

    /* ---------- Perubahan peta ---------- */
    mapChanged: function () {
      this.version++;
      this.allCache = null;
      this.stats.markStale(this.version);
    },

    // Edit apa pun saat ada visualisasi akan menghentikan animasi dan menghapusnya.
    beginEdit: function () {
      if (this.machine.is(S.RUNNING, S.PAUSED, S.DONE)) this.clearVis();
    },

    endEdit: function () {
      this.mapChanged();
    },

    paint: function (r, c, value) {
      if (this.grid.pieceAt(r, c)) return;
      if (this.grid.set(r, c, value)) {
        this.renderer.drawCell(this.grid.idx(r, c));
        this.fromMaze = false;
      }
    },

    refreshState: function () {
      if (this.machine.is(S.IDLE, S.READY)) {
        this.machine.go(this.grid.hasPieces() ? S.READY : S.IDLE);
      }
      this.ui.syncState(this);
    },

    canPlace: function (kind, r, c) {
      var other = kind === 'start' ? this.grid.goal : this.grid.start;
      return this.grid.inBounds(r, c) && !(other && other.r === r && other.c === c);
    },

    placePiece: function (kind, r, c) {
      if (this.busy || !this.grid.inBounds(r, c)) return false;
      if (!this.canPlace(kind, r, c)) {
        this.ui.toast('Kurir dan alamat tujuan tidak boleh di sel yang sama.', 'bad');
        return false;
      }
      this.beginEdit();
      if (this.grid.get(r, c) !== 0) {
        this.grid.set(r, c, 0);
        this.renderer.drawCell(this.grid.idx(r, c));
        this.ui.toast('Gedung di sel itu dibongkar untuk ' + (kind === 'start' ? 'kurir.' : 'alamat tujuan.'), 'info');
      }
      this.grid[kind] = { r: r, c: c };
      this.mapChanged();
      this.ui.syncPieces(this.grid);
      this.refreshState();
      return true;
    },

    autoPlace: function () {
      var g = this.grid, mid = Math.floor(g.rows / 2);
      if (g.hasPieces()) { this.ui.toast('Kurir dan tujuan sudah ada di peta.', 'info'); return; }
      this.beginEdit();
      if (!g.start) g.start = g.nearestFree(mid, Math.min(2, g.cols - 1), g.goal);
      if (!g.goal) g.goal = g.nearestFree(mid, Math.max(0, g.cols - 3), g.start);
      this.renderer.fullRedraw();
      this.mapChanged();
      this.ui.syncPieces(g);
      this.refreshState();
    },

    resize: function (rows, cols) {
      if (this.busy) return;
      this.beginEdit();
      this.grid.resize(rows, cols);
      this.renderer.setGrid(this.grid);
      this.fromMaze = false;
      this.mapChanged();
      this.ui.syncSize(this.grid);
      this.ui.syncPieces(this.grid);
      this.refreshState();
    },

    applyGrid: function (g) {
      this.beginEdit();
      this.grid.copyFrom(g);
      this.renderer.setGrid(this.grid);
      this.fromMaze = false;
      this.mapChanged();
      this.ui.syncSize(this.grid);
      this.ui.syncPieces(this.grid);
      this.refreshState();
    },

    clearWalls: function () {
      if (this.busy) return;
      this.beginEdit();
      this.grid.clearObstacles();
      this.renderer.fullRedraw();
      this.fromMaze = false;
      this.mapChanged();
      this.ui.toast('Semua gedung dan jalan macet dihapus.', 'info');
    },

    resetAll: function () {
      if (this.busy) return;
      if (this.grid.count(1) + this.grid.count(2) > 0 && !window.confirm('Reset peta, bidak, dan tabel perbandingan?')) return;
      this.beginEdit();
      this.grid.clearAll();
      this.grid.resize(20, 30);
      this.renderer.setGrid(this.grid);
      this.mapChanged();
      this.stats.clear();
      this.ui.setInsight(this.ui.el.cmpInsight, '');
      this.ui.syncSize(this.grid);
      this.ui.syncPieces(this.grid);
      this.machine.go(S.IDLE);
      this.refreshState();
      this.ui.setStatus('Peta direset. Tempatkan kurir dan alamat tujuan untuk mulai.', 'info');
    },

    randomBuildings: function () {
      if (this.busy) return;
      this.beginEdit();
      var g = this.grid;
      g.cells.set(ns.Maze.randomBuildings(g.rows, g.cols, this.settings.density));
      if (g.start) g.cells[g.startIndex()] = 0;
      if (g.goal) g.cells[g.goalIndex()] = 0;
      this.renderer.fullRedraw();
      this.fromMaze = false;
      this.mapChanged();
      this.ui.toast('Gedung acak ' + Math.round(this.settings.density * 100) + '% dibuat. Belum tentu ada jalur!', 'info');
    },

    // Maze acak dengan animasi penggalian sel demi sel.
    generateMaze: function () {
      if (this.busy) return;
      var self = this, g = this.grid, r = this.renderer;
      this.beginEdit();
      var maze = ns.Maze.backtracker(g.rows, g.cols, Math.random, 0.06);
      g.cells.fill(1);

      function done() {
        g.cells.set(maze.cells);
        g.start = g.nearestFree(g.start ? g.start.r : 1, g.start ? g.start.c : 1, null);
        g.goal = g.nearestFree(g.goal ? g.goal.r : g.rows - 2, g.goal ? g.goal.c : g.cols - 2, g.start);
        r.ov.hidePieces = false;
        r.fullRedraw();
        self.busy = false;
        self.fromMaze = true;
        self.mapChanged();
        self.ui.syncPieces(g);
        self.machine.go(S.READY);
        self.refreshState();
        self.ui.toast('Maze siap. Coba bandingkan DFS dengan A*!', 'ok');
      }

      if (r.reducedMotion) { done(); return; }
      this.busy = true;
      r.ov.hidePieces = true;
      r.fullRedraw();
      this.ui.syncState(this);
      var order = maze.order, i = 0, perFrame = Math.max(4, Math.ceil(order.length / 45));
      (function dig() {
        for (var k = 0; k < perFrame && i < order.length; k++, i++) {
          g.cells[order[i]] = 0;
          r.drawCell(order[i]);
        }
        if (i < order.length) requestAnimationFrame(dig); else done();
      })();
    },

    loadScenario: function (sc) {
      if (this.busy) return;
      var built = sc.build();
      this.applyGrid(built.grid);
      this.setDiagonal(built.diagonal);
      this.setAlgo(sc.algo);
      this.fromMaze = sc.id === 'maze';
      this.ui.toast('Skenario "' + sc.title + '" dimuat. Tekan Jalankan!', 'ok');
      document.getElementById('lab').scrollIntoView({ block: 'start' });
    },

    /* ---------- Pengaturan ---------- */
    setAlgo: function (id) {
      if (!ns.algorithms[id]) return;
      this.settings.algo = id;
      this.ui.syncAlgo(id);
      if (this.machine.is(S.RUNNING, S.PAUSED, S.DONE)) this.clearVis();
    },

    setDiagonal: function (on) {
      if (this.settings.diagonal === on) { this.ui.syncDiagonal(on); return; }
      this.beginEdit();
      this.settings.diagonal = on;
      this.ui.syncDiagonal(on);
      this.mapChanged();
    },

    setSpeed: function (v) {
      this.settings.speed = v;
      this.animator.setSpeed(v);
    },

    /* ---------- Menjalankan algoritma ---------- */
    clearVis: function () {
      this.animator.reset();
      this.renderer.resetVis();
      this.run_algo = null;
      if (!this.machine.is(S.IDLE, S.READY)) this.machine.go(this.grid.hasPieces() ? S.READY : S.IDLE);
      this.ui.resetResult();
      this.ui.setStatus(this.grid.hasPieces() ? 'Siap. Pilih algoritma lalu tekan Jalankan.' : 'Tempatkan kurir dan alamat tujuan, lalu tekan Jalankan.', 'info');
      this.refreshState();
    },

    startRun: function (autoplay) {
      var g = this.grid, id = this.settings.algo, algo = ns.algorithms[id];
      var timing = ns.Stats.timeSolve(algo, g, this.settings.diagonal);
      var res = algo.solve(g.cells, g.rows, g.cols, g.startIndex(), g.goalIndex(),
        { diagonal: this.settings.diagonal, record: true });

      this.run_algo = id;
      this.current = { id: id, res: res, time: timing.median, version: this.version };
      this.renderer.resetVis();
      // Nilai g (dan h untuk A*) ditampilkan di sel yang cukup besar.
      this.renderer.values = res.g ? { g: res.g, goal: g.goalIndex(), diagonal: this.settings.diagonal, mode: id === 'astar' ? 'f' : 'g' } : null;
      this.keyOf = this.makeKeyFn(id, res);
      this.animator.load(res);
      this.ui.startRun(id, timing.median);
      this.machine.go(autoplay ? S.RUNNING : S.PAUSED);
      if (autoplay) this.animator.play();
    },

    // Kunci prioritas untuk menampilkan isi priority queue secara berurutan.
    makeKeyFn: function (id, res) {
      var g = this.grid, goal = g.goalIndex(), diag = this.settings.diagonal, H = ns.algo.heuristic;
      if (id === 'dijkstra') return function (i) { return res.g[i]; };
      if (id === 'astar') return function (i) { return res.g[i] + H(i, goal, g.cols, diag); };
      return function (i) { return H(i, goal, g.cols, diag); };
    },

    run: function () {
      if (!this.grid.hasPieces()) { this.ui.toast('Tempatkan kurir dan alamat tujuan dulu.', 'bad'); return; }
      if (this.busy || this.machine.is(S.RUNNING)) return;   // abaikan klik berulang
      if (this.machine.is(S.PAUSED)) { this.togglePause(); return; }
      if (this.machine.is(S.DONE)) this.clearVis();
      this.startRun(true);
    },

    togglePause: function () {
      if (this.machine.is(S.RUNNING)) {
        this.animator.pause();
        this.machine.go(S.PAUSED);
        this.ui.setStatus('Dijeda. Tekan Langkah untuk maju satu node, atau Lanjut.', 'info');
      } else if (this.machine.is(S.PAUSED)) {
        this.machine.go(S.RUNNING);
        this.animator.play();
        this.ui.setStatus('Kurir ' + ns.algorithms[this.run_algo].name + ' melanjutkan pencarian…', 'run');
      }
    },

    step: function () {
      if (!this.grid.hasPieces() || this.busy || this.machine.is(S.DONE)) return;
      if (this.machine.is(S.READY, S.IDLE)) this.startRun(false);
      if (this.machine.is(S.RUNNING)) this.machine.go(S.PAUSED);
      this.animator.step();
      if (this.machine.is(S.PAUSED) && this.animator.phase !== 'done') {
        var cur = this.animator.lastCurrent, g = this.grid;
        if (cur >= 0) {
          var r = (cur / g.cols) | 0;
          this.ui.setStatus('Langkah ' + this.animator.expanded + ': memproses sel baris ' + (r + 1) + ', kolom ' + (cur - r * g.cols + 1) + '.', 'run');
        }
      }
    },

    finish: function () {
      if (!this.grid.hasPieces() || this.busy || this.machine.is(S.DONE)) return;
      if (this.machine.is(S.READY, S.IDLE)) this.startRun(false);
      this.animator.finish();
    },

    // Hasil kelima algoritma tanpa perekaman, dipakai untuk insight, misi, dan kuis.
    computeAll: function () {
      if (this.allCache && this.allCache.version === this.version) return this.allCache.all;
      var g = this.grid, all = {}, diag = this.settings.diagonal;
      ns.ALGO_ORDER.forEach(function (id) {
        all[id] = ns.algorithms[id].solve(g.cells, g.rows, g.cols, g.startIndex(), g.goalIndex(), { diagonal: diag, record: false });
      });
      this.allCache = { version: this.version, all: all };
      return all;
    },

    onRunDone: function () {
      var cur = this.current;
      if (!cur) return;
      var all = this.computeAll();
      var m = ns.Stats.metricsFrom(cur.id, cur.res, cur.time, all.dijkstra.cost);
      this.stats.record(m, cur.version);
      this.ui.showResult(m);
      this.ui.el.steps.value = ns.Stats.fmtNum(this.animator.played);
      this.ui.el.frontier.value = ns.Stats.fmtNum(this.animator.frontier);

      var ctx = {
        algo: cur.id, all: all, version: cur.version, diagonal: this.settings.diagonal,
        hasJam: this.grid.count(2) > 0, fromMaze: this.fromMaze, size: this.grid.rows * this.grid.cols
      };
      this.ui.setInsight(this.ui.el.insight, ns.Stats.insightFor(cur.id, all, ctx));
      var stars = this.game.onRun(ctx);
      if (m.found) this.ui.showRating(stars, this.game.rateNote(cur.id, all, stars));
      this.machine.go(S.DONE);
    },

    compareAll: function () {
      var self = this, btn = document.getElementById('btn-compare');
      if (!this.grid.hasPieces()) { this.ui.toast('Tempatkan kurir dan alamat tujuan dulu.', 'bad'); return; }
      if (btn.disabled) return;
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Menghitung…';
      var all = this.computeAll(), version = this.version, ids = ns.ALGO_ORDER.slice(), list = [];

      // Satu algoritma per tick supaya UI tetap responsif di grid besar.
      (function next() {
        var id = ids.shift();
        if (!id) {
          btn.disabled = false;
          btn.querySelector('span').textContent = 'Bandingkan semua';
          self.ui.setInsight(self.ui.el.cmpInsight, ns.Stats.compareInsight(list));
          self.game.onCompare();
          self.ui.toast('Perbandingan selesai.', 'ok');
          return;
        }
        var t = ns.Stats.timeSolve(ns.algorithms[id], self.grid, self.settings.diagonal);
        var m = ns.Stats.metricsFrom(id, all[id], t.median, all.dijkstra.cost);
        list.push(m);
        self.stats.record(m, version);
        setTimeout(next, 0);
      })();
    },

    /* ---------- Kuis ---------- */
    openQuiz: function () {
      var self = this;
      if (!this.grid.hasPieces()) {
        // Peta kosong: muat skenario acak supaya kuis tetap bisa dimainkan.
        var list = ns.Scenarios, sc = list[Math.floor(Math.random() * list.length)];
        this.loadScenario(sc);
      }
      var all = this.computeAll();
      var ctx = { diagonal: this.settings.diagonal, hasJam: this.grid.count(2) > 0 };
      var q = ns.Game.makeQuestion(all, ctx, this.lastQuiz);
      this.lastQuiz = q.index;
      var info = 'Berdasarkan peta saat ini: ' + this.grid.rows + ' × ' + this.grid.cols + ' sel, ' +
        (ctx.diagonal ? 'diagonal aktif' : '4 arah') + (ctx.hasJam ? ', ada sel macet' : '') + '.';
      this.ui.showQuiz(q, info, function (correct, proof) {
        if (proof) { self.compareAll(); document.getElementById('perbandingan').scrollIntoView(); return; }
        self.game.onQuiz(correct);
      });
      document.getElementById('quiz-next').onclick = function () { self.openQuiz(); };
    },

    /* ---------- Simpan / muat ---------- */
    saveMap: function () {
      if (ns.store.set('map', { grid: this.grid.toJSON(), diagonal: this.settings.diagonal })) {
        this.ui.toast('Peta disimpan di browser ini.', 'ok');
        this.game.onSave();
      } else {
        this.ui.toast('Penyimpanan browser tidak tersedia (mode privat?). Pakai Ekspor JSON.', 'bad');
      }
    },

    loadMap: function () {
      var saved = ns.store.get('map', null);
      if (!saved) { this.ui.toast('Belum ada peta tersimpan.', 'bad'); return; }
      try {
        this.applyGrid(ns.Grid.fromJSON(saved.grid));
        this.setDiagonal(!!saved.diagonal);
        this.ui.toast('Peta tersimpan dimuat.', 'ok');
      } catch (e) {
        this.ui.toast('Peta tersimpan rusak: ' + e.message, 'bad');
      }
    },

    exportMap: function () {
      var data = this.grid.toJSON();
      data.diagonal = this.settings.diagonal;
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'go-sel-peta-' + this.grid.rows + 'x' + this.grid.cols + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      this.game.onSave();
    },

    importFile: function (file) {
      var self = this, reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          self.applyGrid(ns.Grid.fromJSON(data));
          self.setDiagonal(!!data.diagonal);
          self.ui.toast('Peta "' + file.name + '" dimuat.', 'ok');
        } catch (e) {
          self.ui.toast('Gagal memuat file: ' + e.message, 'bad');
        }
      };
      reader.readAsText(file);
    },

    /* ---------- Tema ---------- */
    toggleTheme: function () {
      var root = document.documentElement;
      var dark = root.dataset.theme ? root.dataset.theme === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('go-sel:theme', root.dataset.theme); } catch (e) { /* abaikan */ }
      this.onThemeChange();
    },

    onThemeChange: function () {
      this.renderer.readTheme();
      this.renderer.fullRedraw();
      this.stats.drawChart(true);
      this.ui.drawThumbs();
    },

    watchTheme: function () {
      var self = this, mq = window.matchMedia('(prefers-color-scheme: dark)');
      var fn = function () { if (!document.documentElement.dataset.theme) self.onThemeChange(); };
      if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn);
    },

    /* ---------- Pintasan keyboard ---------- */
    bindShortcuts: function () {
      var self = this;
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.querySelector('dialog[open]')) return;
        var t = e.target, tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
        var onControl = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || t.getAttribute('role') === 'button';
        var k = e.key.toLowerCase();

        if (k === ' ' && !onControl && t !== self.renderer.base) {
          e.preventDefault();
          if (self.machine.is(S.RUNNING, S.PAUSED)) self.togglePause(); else self.run();
        } else if (k === 's') self.step();
        else if (k === 'f') self.finish();
        else if (k === 'r') self.clearVis();
        else if (k === 'c') self.clearWalls();
        else if (k === 'd') self.setDiagonal(!self.settings.diagonal);
        else if (k >= '1' && k <= '5') self.setAlgo(ns.ALGO_ORDER[+k - 1]);
      });
    }
  };

  ns.app = app;
  document.addEventListener('DOMContentLoaded', function () { app.init(); });
})(window.GoSel = window.GoSel || {});
