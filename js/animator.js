/* Animator: memutar event algoritma lewat requestAnimationFrame.
 * Fase: search (putar event) -> path (gambar jalur sel demi sel)
 *       -> deliver (ikon kurir menyusuri jalur) -> done. */
(function (ns) {
  'use strict';
  var VIS = ns.Renderer.VIS;

  function Animator(renderer, hooks) {
    this.r = renderer;
    this.hooks = hooks || {};
    this.speed = 55;
    this._raf = 0;
    this._tick = this._tick.bind(this);
    this.reset();
  }

  var P = Animator.prototype;

  P.reset = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this.events = null;
    this.ei = 0;
    this.path = null;
    this.found = false;
    this.phase = 'idle';
    this.playing = false;
    this.budget = 0;
    this.pathPos = 0;
    this.deliverT = 0;
    this.expanded = 0;
    this.frontier = 0;
    this.played = 0;
    this.lastCurrent = -1;
    this.fr = [];            // isi frontier sesuai urutan masuk (untuk panel struktur data)
  };

  P.load = function (result) {
    this.reset();
    this.events = result.events || new Int32Array(0);
    this.path = result.found ? result.path : null;
    this.found = result.found;
    this.phase = 'search';
    this.r.ov.path = this.path;
    this.r.ov.pathShown = 0;
  };

  // Kecepatan 1..100 dipetakan eksponensial: ~3 sampai ~7.500 event per detik.
  P.eventsPerSecond = function () {
    return 3 * Math.pow(10, ((this.speed - 1) / 99) * 3.4);
  };

  P.setSpeed = function (v) { this.speed = v; };

  P.play = function () {
    if (this.phase === 'idle' || this.phase === 'done') return;
    this.playing = true;
    this._last = performance.now();
    this._schedule();
  };

  P.pause = function () {
    this.playing = false;
  };

  P._schedule = function () {
    if (!this._raf) this._raf = requestAnimationFrame(this._tick);
  };

  P._apply = function (type, idx) {
    var vis = this.r.vis, prev = vis[idx];
    if (type === 1) {
      if (prev !== VIS.NONE) return;
      this.frontier++;
      this.fr.push(idx);
      this.r.setVis(idx, VIS.FRONTIER);
    } else if (type === 2) {
      if (prev === VIS.FRONTIER) {
        this.frontier--;
        var k = this.fr.indexOf(idx);
        if (k !== -1) this.fr.splice(k, 1);
      }
      this.expanded++;
      this.lastCurrent = idx;
      if (this.hooks.onExpand && this.playing) this.hooks.onExpand(idx);
      this.r.setVis(idx, VIS.CURRENT);
    } else {
      this.r.setVis(idx, VIS.CLOSED);
    }
  };

  // Memutar n event; mengembalikan true jika event sudah habis.
  P._playEvents = function (n) {
    var ev = this.events, end = ev.length;
    while (n > 0 && this.ei < end) {
      this._apply(ev[this.ei], ev[this.ei + 1]);
      this.ei += 2;
      this.played++;
      n--;
    }
    return this.ei >= end;
  };

  P._enterPath = function () {
    if (!this.found) {
      this.phase = 'done';
      this.playing = false;
      if (this.hooks.onDone) this.hooks.onDone(false);
      return;
    }
    this.phase = 'path';
    this.pathPos = 0;
    if (this.hooks.onPhase) this.hooks.onPhase('path');
  };

  P._showPath = function (count) {
    var path = this.path;
    count = Math.min(count, path.length);
    for (var i = Math.floor(this.pathPos); i < count; i++) this.r.setVis(path[i], VIS.PATH);
    this.pathPos = count;
    this.r.ov.pathShown = count;
  };

  P._enterDeliver = function () {
    if (this.r.reducedMotion) { this._finishDeliver(); return; }
    this.phase = 'deliver';
    this.deliverT = 0;
    if (this.hooks.onPhase) this.hooks.onPhase('deliver');
  };

  P._finishDeliver = function () {
    var g = this.r.grid, last = this.path[this.path.length - 1];
    var lr = (last / g.cols) | 0, lc = last - lr * g.cols;
    this.r.ov.courier = { x: lc + 0.5, y: lr + 0.5 };
    this.r.ov.delivered = true;
    this.phase = 'done';
    this.playing = false;
    this.r.burst(lr, lc);
    if (this.hooks.onDone) this.hooks.onDone(true);
  };

  P._courierAt = function (t) {
    var path = this.path, g = this.r.grid;
    var f = t * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), u = f - i;
    if (path.length < 2) { i = 0; u = 0; }
    var a = path[i], b = path[Math.min(i + 1, path.length - 1)];
    var ar = (a / g.cols) | 0, ac = a - ar * g.cols, br = (b / g.cols) | 0, bc = b - br * g.cols;
    return { x: ac + (bc - ac) * u + 0.5, y: ar + (br - ar) * u + 0.5 };
  };

  P._tick = function (now) {
    this._raf = 0;
    var dt = Math.min(100, now - (this._last || now));
    this._last = now;
    if (!this.playing) return;

    if (this.phase === 'search') {
      this.budget += this.eventsPerSecond() * dt / 1000;
      var n = Math.floor(this.budget);
      this.budget -= n;
      if (this._playEvents(n)) this._enterPath();
    } else if (this.phase === 'path') {
      // Jalur digambar dalam ~0,4-1,5 detik tergantung panjangnya.
      var dur = Math.min(1500, Math.max(400, this.path.length * 30));
      var next = this.pathPos + this.path.length * dt / dur;
      this._showPath(Math.max(this.pathPos + 0.0001, next));
      if (this.pathPos >= this.path.length) this._enterDeliver();
    } else if (this.phase === 'deliver') {
      var ddur = Math.min(4000, Math.max(900, this.path.length * 70));
      this.deliverT = Math.min(1, this.deliverT + dt / ddur);
      var e = this.deliverT < 0.5 ? 2 * this.deliverT * this.deliverT : 1 - Math.pow(-2 * this.deliverT + 2, 2) / 2;
      this.r.ov.courier = this._courierAt(e);
      // Turunan easing (0..2) dinormalkan jadi 0..1 untuk suara mesin.
      var velocity = this.deliverT < 0.5 ? 4 * this.deliverT : 4 * (1 - this.deliverT);
      if (this.hooks.onDrive) this.hooks.onDrive(velocity / 2);
      if (this.deliverT >= 1) this._finishDeliver();
    }

    if (this.hooks.onProgress) this.hooks.onProgress(this);
    if (this.playing) this._schedule();
  };

  /* Satu langkah = satu node selesai diproses (sampai event "ditutup" berikutnya). */
  P.step = function () {
    this.playing = false;
    if (this.phase === 'search') {
      var ev = this.events;
      while (this.ei < ev.length) {
        var type = ev[this.ei];
        this._apply(type, ev[this.ei + 1]);
        this.ei += 2;
        this.played++;
        if (type === 3) break;
      }
      if (this.ei >= ev.length) this._enterPath();
    } else if (this.phase === 'path' || this.phase === 'deliver') {
      this._showPath(this.path.length);
      this._finishDeliver();
    }
    if (this.hooks.onProgress) this.hooks.onProgress(this);
  };

  P.finish = function () {
    this.playing = false;
    if (this.phase === 'search') {
      this._playEvents(Infinity);
      if (!this.found) { this._enterPath(); if (this.hooks.onProgress) this.hooks.onProgress(this); return; }
      this.phase = 'path';
    }
    if (this.phase === 'path' || this.phase === 'deliver') {
      this._showPath(this.path.length);
      this._finishDeliver();
    }
    if (this.hooks.onProgress) this.hooks.onProgress(this);
  };

  ns.Animator = Animator;
})(window.GoSel = window.GoSel || {});
