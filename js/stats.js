/* Metrik: timing median, penyimpanan hasil per algoritma, tabel perbandingan,
 * bar chart canvas (tanpa library), dan kalimat insight dari data. */
(function (ns) {
  'use strict';
  var A = ns.algo;

  var COLORS = {
    bfs: '--svc-bfs', dfs: '--svc-dfs', dijkstra: '--svc-dijkstra', astar: '--svc-astar', greedy: '--svc-greedy'
  };

  /* Waktu komputasi murni (tanpa render dan tanpa perekaman event).
   * performance.now() di browser dibulatkan (5-100 µs), jadi tiap sampel menjalankan
   * algoritma berulang sampai >= 2 ms lalu dibagi. Diambil median dari maksimal 21
   * sampel, dengan anggaran sekitar 60 ms supaya UI tidak membeku. */
  function timeSolve(algo, grid, diagonal) {
    var opts = { diagonal: diagonal, record: false };
    function once() { algo.solve(grid.cells, grid.rows, grid.cols, grid.startIndex(), grid.goalIndex(), opts); }
    once(); // pemanasan
    var times = [], deadline = performance.now() + 60;
    for (var k = 0; k < 21; k++) {
      var n = 0, start = performance.now(), elapsed;
      do { once(); n++; elapsed = performance.now() - start; } while (elapsed < 2 && n < 2000);
      times.push(elapsed / n);
      if (k >= 4 && performance.now() > deadline) break;
    }
    times.sort(function (x, y) { return x - y; });
    return { median: times[times.length >> 1], samples: times.length };
  }

  function metricsFrom(id, res, timeMs, refCost) {
    return {
      id: id,
      name: ns.algorithms[id].name,
      found: res.found,
      time: timeMs,
      visited: res.visitedCount,
      length: res.found ? res.path.length - 1 : null,
      cost: res.found ? res.cost : Infinity,
      optimal: res.found ? A.sameCost(res.cost, refCost) : null
    };
  }

  function fmtNum(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '–';
    return n.toLocaleString('id-ID', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function fmtCost(c) {
    if (!isFinite(c)) return 'tidak ada';
    return Math.abs(c - Math.round(c)) < 1e-9 ? fmtNum(c, 0) : fmtNum(c, 2);
  }

  /* ---------- Penyimpanan & tabel ---------- */
  function Stats(els) {
    this.els = els;
    this.version = 0;
    this.results = {};      // id -> metrics untuk version saat ini
    this.stale = false;
    this.current = null;
    this.chartAnim = 0;
    this.chartFrom = {};
    this._drawChart = this._drawChart.bind(this);
    var self = this;
    if (window.ResizeObserver) {
      new ResizeObserver(function () { self.drawChart(true); }).observe(els.chart.parentElement);
    }
  }

  var P = Stats.prototype;

  P.markStale = function (version) {
    if (version === this.version) return;
    if (Object.keys(this.results).length) {
      this.stale = true;
      this.els.stale.hidden = false;
      this.els.table.classList.add('is-stale');
    }
  };

  P.record = function (metrics, version) {
    if (version !== this.version) {
      this.version = version;
      this.results = {};
      this.stale = false;
      this.els.stale.hidden = true;
      this.els.table.classList.remove('is-stale');
    }
    this.results[metrics.id] = metrics;
    this.current = metrics.id;
    this.renderTable();
    this.drawChart();
  };

  P.clear = function () {
    this.results = {};
    this.stale = false;
    this.els.stale.hidden = true;
    this.els.table.classList.remove('is-stale');
    this.renderTable();
    this.drawChart();
  };

  P.list = function () {
    var self = this;
    return ns.ALGO_ORDER.filter(function (id) { return self.results[id]; }).map(function (id) { return self.results[id]; });
  };

  P.renderTable = function () {
    var body = this.els.body, tpl = this.els.rowTpl, rows = this.list();
    body.textContent = '';
    if (!rows.length) {
      var tr = document.createElement('tr');
      tr.className = 'cmp-empty';
      tr.innerHTML = '<td colspan="6">Belum ada data. Jalankan satu algoritma atau tekan <b>Bandingkan semua</b>.</td>';
      body.appendChild(tr);
      return;
    }
    var found = rows.filter(function (m) { return m.found; });
    var best = {
      time: Math.min.apply(null, rows.map(function (m) { return m.time; })),
      visited: Math.min.apply(null, rows.map(function (m) { return m.visited; })),
      length: found.length ? Math.min.apply(null, found.map(function (m) { return m.length; })) : null,
      cost: found.length ? Math.min.apply(null, found.map(function (m) { return m.cost; })) : null
    };
    var multi = rows.length > 1;
    var self = this;
    rows.forEach(function (m, i) {
      var node = tpl.content.cloneNode(true);
      var row = node.querySelector('tr');
      row.style.animationDelay = (i * 40) + 'ms';
      row.dataset.algo = m.id;
      if (m.id === self.current) row.classList.add('is-current');
      row.querySelector('.algo-dot').style.setProperty('--svc', 'var(' + COLORS[m.id] + ')');
      row.querySelector('.algo-name').textContent = m.name;
      var cell = function (col, text, isBest) {
        var td = row.querySelector('[data-col="' + col + '"]');
        td.textContent = text;
        if (isBest && multi) td.classList.add('best');
      };
      cell('time', fmtNum(m.time, 3), Math.abs(m.time - best.time) < 1e-12);
      cell('visited', fmtNum(m.visited), m.visited === best.visited);
      cell('length', m.found ? fmtNum(m.length) : 'tidak ada', m.found && m.length === best.length);
      cell('cost', fmtCost(m.cost), m.found && A.sameCost(m.cost, best.cost));
      var opt = row.querySelector('[data-col="optimal"]');
      var badge = document.createElement('span');
      if (!m.found) { badge.className = 'opt opt--na'; badge.textContent = 'tanpa jalur'; }
      else if (m.optimal) { badge.className = 'opt opt--yes'; badge.textContent = '✓ optimal'; }
      else { badge.className = 'opt opt--no'; badge.textContent = '✗ lebih mahal'; }
      opt.appendChild(badge);
      body.appendChild(node);
    });
  };

  /* ---------- Bar chart di canvas kedua ---------- */
  P.drawChart = function (instant) {
    var self = this;
    var target = {};
    ns.ALGO_ORDER.forEach(function (id) {
      var m = self.results[id];
      target[id] = m ? { v: m.visited, t: m.time } : { v: 0, t: 0 };
    });
    this.chartTarget = target;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduced) { this.chartProgress = 1; this._drawChart(); return; }
    this.chartProgress = 0;
    this.chartStart = performance.now();
    if (!this.chartAnim) this.chartAnim = requestAnimationFrame(this._drawChart);
  };

  P._drawChart = function (now) {
    this.chartAnim = 0;
    var cv = this.els.chart, wrap = cv.parentElement;
    var W = Math.max(240, wrap.clientWidth - 24);
    var narrow = W < 460;
    var rowH = 26, top = 34, pad = 12;
    var panelH = top + ns.ALGO_ORDER.length * rowH + 8;
    var H = narrow ? panelH * 2 + 10 : panelH;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (this.chartProgress < 1 && now) {
      this.chartProgress = Math.min(1, (now - this.chartStart) / 600);
    }
    var p = 1 - Math.pow(1 - this.chartProgress, 3);
    var cs = getComputedStyle(document.documentElement);
    var text = cs.getPropertyValue('--text').trim(), muted = cs.getPropertyValue('--text-muted').trim();
    var track = cs.getPropertyValue('--surface-3').trim();
    var self = this, T = this.chartTarget || {};
    var ids = ns.ALGO_ORDER;
    var panelW = narrow ? W : (W - 16) / 2;
    var panels = [
      { key: 'v', title: 'Sel dikunjungi', fmt: function (x) { return fmtNum(x); } },
      { key: 't', title: 'Waktu komputasi (ms)', fmt: function (x) { return fmtNum(x, 3); } }
    ];

    panels.forEach(function (panel, pi) {
      var ox = narrow ? 0 : pi * (panelW + 16), oy = narrow ? pi * (panelH + 10) : 0;
      ctx.fillStyle = text;
      ctx.font = '700 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText(panel.title, ox + 2, oy + 18);
      var vals = ids.map(function (id) { return T[id] ? T[id][panel.key] : 0; });
      var max = Math.max.apply(null, vals) || 1;
      var present = ids.filter(function (id) { return self.results[id]; });
      var bestVal = present.length > 1 ? Math.min.apply(null, present.map(function (id) { return T[id][panel.key]; })) : null;
      var labelW = 70, valW = 64, barW = panelW - labelW - valW - 8;
      ids.forEach(function (id, i) {
        var y = oy + top + i * rowH;
        ctx.fillStyle = muted;
        ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(ns.algorithms[id].name, ox + 2, y + 9);
        ctx.fillStyle = track;
        roundRect(ctx, ox + labelW, y + 2, barW, 14, 7);
        ctx.fill();
        var has = !!self.results[id];
        if (has) {
          var v = T[id][panel.key], w = Math.max(4, (v / max) * barW * p);
          var color = cs.getPropertyValue(COLORS[id]).trim();
          ctx.fillStyle = color;
          roundRect(ctx, ox + labelW, y + 2, w, 14, 7);
          ctx.fill();
          if (bestVal !== null && Math.abs(v - bestVal) < 1e-12) {
            // Pola garis untuk hasil terbaik (tidak hanya mengandalkan warna)
            ctx.save();
            roundRect(ctx, ox + labelW, y + 2, w, 14, 7);
            ctx.clip();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 3;
            for (var k = -14; k < w; k += 8) {
              ctx.beginPath();
              ctx.moveTo(ox + labelW + k, y + 16);
              ctx.lineTo(ox + labelW + k + 14, y + 2);
              ctx.stroke();
            }
            ctx.restore();
          }
          ctx.fillStyle = text;
          ctx.font = '700 11.5px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(panel.fmt(v), ox + panelW - 2, y + 9);
        } else {
          ctx.fillStyle = muted;
          ctx.font = '600 11.5px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = 'right';
          ctx.fillText('–', ox + panelW - 2, y + 9);
        }
      });
    });

    if (this.chartProgress < 1) this.chartAnim = requestAnimationFrame(this._drawChart);
  };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- Insight: kalimat yang dihasilkan dari angka, bukan teks statis ---------- */
  function pct(a, b) { return Math.round((1 - a / b) * 100); }

  // all: hasil kelima algoritma (record:false) pada peta yang sama.
  function insightFor(id, all, ctx) {
    var m = all[id], dj = all.dijkstra, as = all.astar, bfs = all.bfs;
    var name = ns.algorithms[id].name;
    if (!m.found) {
      return 'Tidak ada jalur. ' + name + ' sudah memeriksa ' + fmtNum(m.visitedCount) +
        ' sel yang bisa dijangkau sebelum menyerah. Semua algoritma pasti gagal di peta ini karena tujuan memang tidak tersambung.';
    }
    var extra = m.cost - dj.cost;
    switch (id) {
      case 'astar':
        if (as.visitedCount < dj.visitedCount) {
          return 'A* mengunjungi ' + pct(as.visitedCount, dj.visitedCount) + '% lebih sedikit sel daripada Dijkstra (' +
            fmtNum(as.visitedCount) + ' vs ' + fmtNum(dj.visitedCount) + ') dengan biaya jalur yang sama, berkat heuristik ' +
            (ctx.diagonal ? 'Octile' : 'Manhattan') + '.';
        }
        return 'Di peta ini heuristik A* kurang membantu: ia mengunjungi ' + fmtNum(as.visitedCount) +
          ' sel, hampir sama dengan Dijkstra (' + fmtNum(dj.visitedCount) + '). Rintangan memaksa pencarian memutar.';
      case 'dijkstra':
        return 'Dijkstra menyebar ke segala arah dan memeriksa ' + fmtNum(dj.visitedCount) + ' sel. A* mencapai biaya yang sama (' +
          fmtCost(dj.cost) + ') hanya dengan ' + fmtNum(as.visitedCount) + ' sel.';
      case 'bfs':
        if (A.sameCost(m.cost, dj.cost)) {
          return 'BFS menemukan jalur optimal (biaya ' + fmtCost(m.cost) + ') karena tiap langkah di peta ini berbiaya sama. Tapi ia memeriksa ' +
            fmtNum(m.visitedCount) + ' sel, ' + (m.visitedCount > as.visitedCount ? fmtNum(m.visitedCount - as.visitedCount) + ' lebih banyak dari A*.' : 'setara dengan A*.');
        }
        return 'BFS memilih jalur dengan langkah paling sedikit (' + fmtNum(m.path.length - 1) + ' langkah), tapi biayanya ' +
          fmtCost(m.cost) + ', lebih mahal ' + fmtCost(extra) + ' dari jalur optimal Dijkstra (' + fmtCost(dj.cost) +
          '). BFS mengabaikan bobot ' + (ctx.hasJam ? 'sel macet' : 'diagonal') + '.';
      case 'dfs':
        var ratio = m.cost / dj.cost;
        if (A.sameCost(m.cost, dj.cost)) {
          return 'Kebetulan DFS menemukan jalur optimal di peta ini, tapi itu keberuntungan urutan arah (atas, kanan, bawah, kiri), bukan jaminan.';
        }
        return 'Jalur DFS ' + (ratio >= 1.95 ? ratio.toFixed(1) + '× lebih mahal' : Math.round((ratio - 1) * 100) + '% lebih mahal') +
          ' dari jalur optimal (' + fmtCost(m.cost) + ' vs ' + fmtCost(dj.cost) + '). DFS terus masuk lebih dalam tanpa peduli jarak.';
      case 'greedy':
        if (A.sameCost(m.cost, dj.cost)) {
          return 'Greedy hanya mengunjungi ' + fmtNum(m.visitedCount) + ' sel (' + Math.round(m.visitedCount / as.visitedCount * 100) +
            '% dari A*) dan kebetulan tetap optimal. Coba skenario Kantong buntu untuk menjebaknya.';
        }
        return 'Greedy mengunjungi ' + fmtNum(m.visitedCount) + ' sel, tapi jalurnya ' + Math.round((m.cost / dj.cost - 1) * 100) +
          '% lebih mahal dari optimal (' + fmtCost(m.cost) + ' vs ' + fmtCost(dj.cost) + '). Ia mengejar yang terdekat ke tujuan tanpa menghitung biaya yang sudah ditempuh.';
    }
    return '';
  }

  function compareInsight(list) {
    var found = list.filter(function (m) { return m.found; });
    if (!found.length) return 'Kelima algoritma sepakat: tidak ada jalur. Perhatikan jumlah sel dikunjungi tetap berbeda karena urutan penjelajahan berbeda.';
    var leastVisited = list.reduce(function (a, b) { return b.visited < a.visited ? b : a; });
    var fastest = list.reduce(function (a, b) { return b.time < a.time ? b : a; });
    var nonOpt = found.filter(function (m) { return !m.optimal; }).map(function (m) { return m.name; });
    var s = leastVisited.name + ' paling hemat (' + fmtNum(leastVisited.visited) + ' sel dikunjungi) dan ' +
      fastest.name + ' paling cepat (' + fmtNum(fastest.time, 3) + ' ms). ';
    s += nonOpt.length
      ? 'Yang tidak optimal di peta ini: ' + nonOpt.join(', ') + '.'
      : 'Semua algoritma kebetulan menemukan jalur optimal di peta ini.';
    return s;
  }

  Stats.timeSolve = timeSolve;
  Stats.metricsFrom = metricsFrom;
  Stats.insightFor = insightFor;
  Stats.compareInsight = compareInsight;
  Stats.fmtNum = fmtNum;
  Stats.fmtCost = fmtCost;
  ns.Stats = Stats;
})(window.GoSel = window.GoSel || {});
