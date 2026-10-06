/* Renderer Canvas 2D dua lapis:
 *  - base    : sel (latar, status kunjungan, gedung, macet, garis grid). Digambar
 *              bertahap per sel saat animasi, penuh saat resize/tema berubah.
 *  - overlay : bidak, jalur "jalan", sorotan hover/kursor, partikel. Digambar ulang
 *              setiap frame (murah, hanya beberapa objek). */
(function (ns) {
  'use strict';

  var VIS = { NONE: 0, FRONTIER: 1, CURRENT: 2, CLOSED: 3, PATH: 4 };
  var MAX_CELL = 56;

  function svgImage(symbolId) {
    var sym = document.getElementById(symbolId);
    var img = new Image();
    if (!sym) return img;
    var markup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + sym.getAttribute('viewBox') +
      '" width="96" height="96">' + sym.innerHTML + '</svg>';
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
    return img;
  }

  function Renderer(stage, base, overlay) {
    this.stage = stage;
    this.base = base;
    this.overlay = overlay;
    this.bctx = base.getContext('2d', { alpha: false });
    this.octx = overlay.getContext('2d');
    this.grid = null;
    this.vis = null;
    this.cell = 16;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.colors = {};
    this.values = null;          // { g: Float64Array, goal, diagonal, mode: 'g'|'f' }
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.images = { start: svgImage('i-courier'), goal: svgImage('i-pin') };
    this.ov = {
      hover: null,        // { r, c, ok, kind }
      cursor: null,       // { r, c } kursor keyboard
      path: null,         // Int32Array jalur
      pathShown: 0,       // jumlah sel jalur yang sudah tampil
      courier: null,      // { x, y } posisi pecahan (satuan sel) saat mengantar
      delivered: false,
      dragging: null,     // bidak yang sedang dipindah di canvas
      hidePieces: false,
      particles: []
    };
    this.readTheme();
  }

  var P = Renderer.prototype;

  P.readTheme = function () {
    var cs = getComputedStyle(document.documentElement);
    var get = function (n) { return cs.getPropertyValue(n).trim(); };
    this.colors = {
      empty: get('--cell-empty') || '#fff',
      line: get('--cell-line'),
      frontier: get('--cell-frontier'),
      visited: get('--cell-visited'),
      current: get('--cell-current'),
      path: get('--cell-path'),
      wall: get('--cell-wall'),
      window: get('--cell-window'),
      jam: get('--cell-jam'),
      jamBg: get('--cell-jam-bg'),
      text: get('--cell-text'),
      road: get('--road-mark'),
      hoverOk: get('--hover-ok'),
      hoverBad: get('--hover-bad'),
      accent: get('--gs-green-600'),
      amber: get('--gs-amber-500'),
      red: get('--gs-red-500')
    };
  };

  P.setGrid = function (grid) {
    this.grid = grid;
    this.vis = new Uint8Array(grid.rows * grid.cols);
    this.values = null;
    this.layout(true);
  };

  /* Ukuran sel dihitung agar seluruh grid muat di lebar stage dan tinggi viewport,
   * sel selalu persegi, canvas di-skala devicePixelRatio supaya tajam. */
  P.layout = function (force) {
    if (!this.grid) return;
    var rows = this.grid.rows, cols = this.grid.cols;
    var cs = getComputedStyle(this.stage);
    var avail = this.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var maxH = Math.max(240, Math.min(window.innerHeight * 0.68, 780));
    var cell = Math.floor(Math.min(avail / cols, maxH / rows, MAX_CELL));
    cell = Math.max(3, cell);
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (!force && cell === this.cell && dpr === this.dpr &&
        this.width === cell * cols && this.height === cell * rows) return;
    this.cell = cell;
    this.dpr = dpr;
    this.width = cell * cols;
    this.height = cell * rows;
    var self = this;
    [this.base, this.overlay].forEach(function (cv) {
      cv.width = Math.round(self.width * dpr);
      cv.height = Math.round(self.height * dpr);
      cv.style.width = self.width + 'px';
      cv.style.height = self.height + 'px';
    });
    this.bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.fullRedraw();
  };

  P.resetVis = function () {
    if (this.vis) this.vis.fill(0);
    this.values = null;
    this.ov.path = null;
    this.ov.pathShown = 0;
    this.ov.courier = null;
    this.ov.delivered = false;
    this.fullRedraw();
  };

  P.fullRedraw = function () {
    if (!this.grid) return;
    var ctx = this.bctx;
    ctx.fillStyle = this.colors.empty;
    ctx.fillRect(0, 0, this.width, this.height);
    var n = this.grid.rows * this.grid.cols;
    for (var i = 0; i < n; i++) this.drawCell(i);
  };

  P.drawCell = function (i) {
    var g = this.grid, C = this.colors, ctx = this.bctx, s = this.cell;
    var r = (i / g.cols) | 0, c = i - r * g.cols;
    var x = c * s, y = r * s, v = g.cells[i], st = this.vis[i];

    if (v === 1) {
      ctx.fillStyle = C.wall;
      ctx.fillRect(x, y, s, s);
      if (s >= 12) {
        // Jendela kecil supaya blok gelap terbaca sebagai gedung
        var w = Math.max(2, Math.round(s * 0.16)), gap = s * 0.2;
        ctx.fillStyle = C.window;
        for (var wy = 0; wy < 2; wy++) {
          for (var wx = 0; wx < 2; wx++) {
            if ((r * 7 + c * 3 + wx + wy * 2) % 5 === 0) continue; // sebagian lampu mati
            ctx.fillRect(Math.round(x + gap + wx * (s - 2 * gap - w)), Math.round(y + gap + wy * (s - 2 * gap - w)), w, w);
          }
        }
      }
      return;
    }

    var fill = C.empty;
    if (st === VIS.FRONTIER) fill = C.frontier;
    else if (st === VIS.CURRENT) fill = C.current;
    else if (st === VIS.CLOSED) fill = C.visited;
    else if (st === VIS.PATH) fill = C.path;
    else if (v === 2) fill = C.jamBg;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, s, s);

    if (v === 2) {
      // Pola garis miring merah untuk jalan macet
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, s, s);
      ctx.clip();
      ctx.strokeStyle = C.jam;
      ctx.globalAlpha = st ? 0.55 : 0.9;
      ctx.lineWidth = Math.max(1, s * 0.14);
      ctx.beginPath();
      var step = Math.max(3, s * 0.36);
      for (var k = -s; k < s * 2; k += step) {
        ctx.moveTo(x + k, y + s);
        ctx.lineTo(x + k + s, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (this.values && s >= 30 && (st === VIS.CLOSED || st === VIS.PATH)) {
      var gv = this.values.g[i];
      if (isFinite(gv)) {
        ctx.fillStyle = st === VIS.PATH ? '#fff' : C.text;
        ctx.globalAlpha = 0.85;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var label;
        if (this.values.mode === 'f') {
          var h = ns.algo.heuristic(i, this.values.goal, g.cols, this.values.diagonal);
          ctx.font = '600 ' + Math.round(s * 0.22) + 'px "JetBrains Mono", monospace';
          ctx.fillText('g' + fmt(gv), x + s / 2, y + s * 0.3);
          ctx.fillText('h' + fmt(h), x + s / 2, y + s * 0.7);
        } else {
          label = fmt(gv);
          ctx.font = '700 ' + Math.round(s * 0.28) + 'px "JetBrains Mono", monospace';
          ctx.fillText(label, x + s / 2, y + s / 2);
        }
        ctx.globalAlpha = 1;
      }
    }

    if (s >= 6) {
      ctx.fillStyle = C.line;
      ctx.fillRect(x + s - 1, y, 1, s);
      ctx.fillRect(x, y + s - 1, s, 1);
    }
  };

  function fmt(v) { return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1); }

  P.setVis = function (i, state) {
    this.vis[i] = state;
    this.drawCell(i);
  };

  /* ---------- Konversi koordinat ---------- */
  P.cellAt = function (clientX, clientY, clamp) {
    if (!this.grid) return null;
    var rect = this.base.getBoundingClientRect();
    if (!rect.width) return null;
    var x = (clientX - rect.left) * (this.width / rect.width);
    var y = (clientY - rect.top) * (this.height / rect.height);
    var c = Math.floor(x / this.cell), r = Math.floor(y / this.cell);
    if (clamp) {
      r = Math.max(0, Math.min(this.grid.rows - 1, r));
      c = Math.max(0, Math.min(this.grid.cols - 1, c));
    }
    return this.grid.inBounds(r, c) ? { r: r, c: c } : null;
  };

  /* ---------- Partikel (perayaan paket terkirim) ---------- */
  P.burst = function (r, c) {
    if (this.reducedMotion) return;
    var s = this.cell, cx = (c + 0.5) * s, cy = (r + 0.5) * s;
    var colors = [this.colors.accent, this.colors.amber, '#ffffff', this.colors.red, '#6CC24A'];
    for (var i = 0; i < 46; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 4.5;
      this.ov.particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5,
        life: 1, size: 3 + Math.random() * 4,
        color: colors[i % colors.length], rot: Math.random() * 6
      });
    }
  };

  /* ---------- Overlay ---------- */
  P.drawOverlay = function (now) {
    if (!this.grid) return;
    var ctx = this.octx, s = this.cell, g = this.grid, ov = this.ov, C = this.colors;
    ctx.clearRect(0, 0, this.width, this.height);

    // Marka jalan putus-putus di atas sel jalur
    if (ov.path && ov.pathShown > 1) {
      ctx.save();
      ctx.strokeStyle = C.road;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = Math.max(1, s * 0.1);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s >= 8) ctx.setLineDash([Math.max(2, s * 0.28), Math.max(2, s * 0.22)]);
      ctx.beginPath();
      for (var i = 0; i < ov.pathShown; i++) {
        var p = ov.path[i], pr = (p / g.cols) | 0, pc = p - pr * g.cols;
        var px = (pc + 0.5) * s, py = (pr + 0.5) * s;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Sorotan sel di bawah kursor saat drag
    if (ov.hover) {
      ctx.save();
      ctx.fillStyle = ov.hover.ok ? C.hoverOk : C.hoverBad;
      ctx.strokeStyle = ov.hover.ok ? C.accent : C.red;
      ctx.lineWidth = 2;
      var hx = ov.hover.c * s, hy = ov.hover.r * s;
      ctx.fillRect(hx, hy, s, s);
      ctx.strokeRect(hx + 1, hy + 1, s - 2, s - 2);
      if (ov.hover.kind) {
        ctx.globalAlpha = 0.65;
        this._drawPiece(ov.hover.kind, ov.hover.c + 0.5, ov.hover.r + 0.5, now, false);
      }
      ctx.restore();
    }

    // Kursor keyboard
    if (ov.cursor && document.activeElement === this.base) {
      ctx.save();
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(ov.cursor.c * s + 1.5, ov.cursor.r * s + 1.5, s - 3, s - 3);
      ctx.restore();
    }

    if (!ov.hidePieces) {
      if (g.goal && ov.dragging !== 'goal') this._drawPiece('goal', g.goal.c + 0.5, g.goal.r + 0.5, now, true);
      if (g.start && ov.dragging !== 'start') {
        var cx = ov.courier ? ov.courier.x : g.start.c + 0.5;
        var cy = ov.courier ? ov.courier.y : g.start.r + 0.5;
        if (ov.courier && g.start) {
          // Penanda titik awal yang ditinggalkan kurir
          ctx.save();
          ctx.fillStyle = C.accent;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc((g.start.c + 0.5) * s, (g.start.r + 0.5) * s, Math.max(2, s * 0.22), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        this._drawPiece('start', cx, cy, now, !ov.courier);
      }
    }

    // Partikel
    if (ov.particles.length) {
      var alive = [];
      for (var k = 0; k < ov.particles.length; k++) {
        var pt = ov.particles[k];
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.18; pt.vx *= 0.98; pt.life -= 0.016; pt.rot += 0.2;
        if (pt.life <= 0) continue;
        alive.push(pt);
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.fillStyle = pt.color;
        ctx.fillRect(-pt.size / 2, -pt.size / 4, pt.size, pt.size / 2);
        ctx.restore();
      }
      ov.particles = alive;
    }
  };

  // Bidak minimal 18px agar tetap terlihat walau sel sangat kecil.
  P._drawPiece = function (kind, x, y, now, pulse) {
    var ctx = this.octx, s = this.cell;
    var size = Math.max(18, s * 1.05);
    var px = x * s, py = y * s;
    var img = this.images[kind];

    if (pulse && !this.reducedMotion) {
      var t = (now % 1600) / 1600;
      ctx.save();
      ctx.strokeStyle = kind === 'start' ? this.colors.accent : this.colors.amber;
      ctx.globalAlpha = 0.6 * (1 - t);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, size * (0.45 + t * 0.55), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (img && img.complete && img.naturalWidth) {
      if (kind === 'goal') {
        var bob = (pulse && !this.reducedMotion) ? Math.sin(now / 300) * size * 0.05 : 0;
        ctx.drawImage(img, px - size / 2, py - size * 0.82 + bob, size, size);
      } else {
        ctx.drawImage(img, px - size / 2, py - size / 2, size, size);
      }
    } else {
      ctx.fillStyle = kind === 'start' ? this.colors.accent : this.colors.amber;
      ctx.beginPath();
      ctx.arc(px, py, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  Renderer.VIS = VIS;
  ns.Renderer = Renderer;
})(window.GoSel = window.GoSel || {});
