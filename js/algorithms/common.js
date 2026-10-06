/* Go-Sel — utilitas bersama untuk semua algoritma pencarian jalur.
 * Semua fungsi di sini murni (tanpa DOM) supaya bisa diuji di tests.html. */
(function (ns) {
  'use strict';

  var SQRT2 = Math.SQRT2;
  var JAM_COST = 5;          // pengali biaya untuk sel macet
  var EPS = 1e-9;

  // Urutan tetangga tetap: atas, kanan, bawah, kiri, lalu diagonal
  // kanan-atas, kanan-bawah, kiri-bawah, kiri-atas.
  var DR = [-1, 0, 1, 0, -1, 1, 1, -1];
  var DC = [0, 1, 0, -1, 1, 1, -1, -1];

  /* ---------- PriorityQueue: binary min-heap dengan tie-breaking ----------
   * Urutan: k1 terkecil, lalu k2 terkecil, lalu yang masuk lebih dulu (FIFO).
   * Disimpan sebagai typed array paralel agar cepat untuk grid 60 x 100. */
  function PriorityQueue(capacity) {
    var cap = capacity || 64;
    this.ids = new Int32Array(cap);
    this.k1 = new Float64Array(cap);
    this.k2 = new Float64Array(cap);
    this.seq = new Float64Array(cap);
    this.size = 0;
    this.counter = 0;
  }

  PriorityQueue.prototype._less = function (i, j) {
    var a = this.k1[i], b = this.k1[j];
    if (a - b > EPS) return false;
    if (b - a > EPS) return true;
    a = this.k2[i]; b = this.k2[j];
    if (a - b > EPS) return false;
    if (b - a > EPS) return true;
    return this.seq[i] < this.seq[j];
  };

  PriorityQueue.prototype._swap = function (i, j) {
    var t = this.ids[i]; this.ids[i] = this.ids[j]; this.ids[j] = t;
    var f = this.k1[i]; this.k1[i] = this.k1[j]; this.k1[j] = f;
    f = this.k2[i]; this.k2[i] = this.k2[j]; this.k2[j] = f;
    f = this.seq[i]; this.seq[i] = this.seq[j]; this.seq[j] = f;
  };

  PriorityQueue.prototype._grow = function () {
    var cap = this.ids.length * 2;
    var ids = new Int32Array(cap); ids.set(this.ids); this.ids = ids;
    var k1 = new Float64Array(cap); k1.set(this.k1); this.k1 = k1;
    var k2 = new Float64Array(cap); k2.set(this.k2); this.k2 = k2;
    var sq = new Float64Array(cap); sq.set(this.seq); this.seq = sq;
  };

  PriorityQueue.prototype.push = function (id, k1, k2) {
    if (this.size === this.ids.length) this._grow();
    var i = this.size++;
    this.ids[i] = id; this.k1[i] = k1; this.k2[i] = k2 || 0; this.seq[i] = this.counter++;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (!this._less(i, p)) break;
      this._swap(i, p);
      i = p;
    }
  };

  PriorityQueue.prototype.pop = function () {
    if (this.size === 0) return -1;
    var top = this.ids[0];
    this.size--;
    if (this.size > 0) {
      this._swap(0, this.size);
      var i = 0, n = this.size;
      for (;;) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < n && this._less(l, m)) m = l;
        if (r < n && this._less(r, m)) m = r;
        if (m === i) break;
        this._swap(i, m);
        i = m;
      }
    }
    return top;
  };

  PriorityQueue.prototype.peekIds = function (limit) {
    // Untuk panel struktur data: salinan isi heap, diurutkan.
    var n = Math.min(this.size, limit || this.size), out = [];
    var copy = new PriorityQueue(Math.max(4, this.size));
    for (var i = 0; i < this.size; i++) copy.push(this.ids[i], this.k1[i], this.k2[i]);
    for (var j = 0; j < n; j++) out.push(copy.pop());
    return out;
  };

  /* ---------- Tetangga dan biaya ---------- */

  // Biaya masuk ke sel `to` dengan langkah lurus atau diagonal.
  // Sel macet mengalikan biaya langkah dengan 5 (diagonal ke sel macet = 5 x akar 2).
  function stepCost(cells, to, diagonalMove) {
    var base = diagonalMove ? SQRT2 : 1;
    return cells[to] === 2 ? base * JAM_COST : base;
  }

  /* Mengisi outIdx/outCost dengan tetangga yang bisa dilalui, mengembalikan jumlahnya.
   * Gerakan diagonal ditolak bila salah satu sel ortogonal yang diapit adalah gedung
   * (tanpa corner cutting). Sel macet tetap bisa dilewati. */
  function neighbors(cells, rows, cols, idx, diagonal, outIdx, outCost) {
    var r = (idx / cols) | 0, c = idx - r * cols, k = 0;
    var dirs = diagonal ? 8 : 4;
    for (var d = 0; d < dirs; d++) {
      var nr = r + DR[d], nc = c + DC[d];
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      var ni = nr * cols + nc;
      if (cells[ni] === 1) continue;
      var diag = d >= 4;
      if (diag && (cells[nr * cols + c] === 1 || cells[r * cols + nc] === 1)) continue;
      outIdx[k] = ni;
      outCost[k] = stepCost(cells, ni, diag);
      k++;
    }
    return k;
  }

  // Manhattan untuk 4 arah, Octile untuk 8 arah. Keduanya admissible dan konsisten
  // karena biaya langkah minimum adalah 1 (lurus) dan akar 2 (diagonal).
  function heuristic(a, b, cols, diagonal) {
    var ar = (a / cols) | 0, ac = a - ar * cols;
    var br = (b / cols) | 0, bc = b - br * cols;
    var dx = Math.abs(ac - bc), dy = Math.abs(ar - br);
    if (!diagonal) return dx + dy;
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  }

  function reconstruct(parent, start, goal) {
    var len = 1, cur = goal;
    while (cur !== start) { cur = parent[cur]; len++; if (cur < 0) return null; }
    var path = new Int32Array(len);
    cur = goal;
    for (var i = len - 1; i >= 0; i--) { path[i] = cur; cur = parent[cur]; }
    return path;
  }

  // Satu fungsi biaya untuk semua algoritma, supaya "optimal" dibandingkan secara adil.
  function pathCost(path, cells, cols) {
    if (!path || path.length === 0) return Infinity;
    var total = 0;
    for (var i = 1; i < path.length; i++) {
      var a = path[i - 1], b = path[i];
      var dr = Math.abs(((a / cols) | 0) - ((b / cols) | 0));
      var dc = Math.abs((a % cols) - (b % cols));
      total += stepCost(cells, b, dr === 1 && dc === 1);
    }
    return total;
  }

  /* ---------- Perekam event kompak: pasangan [tipe, indeksSel] ----------
   * 1 = masuk frontier, 2 = sedang diproses, 3 = ditutup.
   * Saat enabled = false tidak ada alokasi sama sekali (mode timing). */
  function EventLog(enabled) {
    this.enabled = enabled;
    this.buf = enabled ? new Int32Array(2048) : null;
    this.len = 0;
  }
  EventLog.prototype.add = function (type, idx) {
    if (!this.enabled) return;
    if (this.len + 2 > this.buf.length) {
      var nb = new Int32Array(this.buf.length * 2);
      nb.set(this.buf);
      this.buf = nb;
    }
    this.buf[this.len++] = type;
    this.buf[this.len++] = idx;
  };
  EventLog.prototype.result = function () {
    return this.enabled ? this.buf.slice(0, this.len) : null;
  };

  function finish(found, parent, start, goal, cells, cols, visitedCount, log, extra) {
    var path = found ? reconstruct(parent, start, goal) : null;
    var res = {
      found: !!path,
      path: path,
      cost: path ? pathCost(path, cells, cols) : Infinity,
      visitedCount: visitedCount,
      events: log.result()
    };
    if (extra) for (var k in extra) res[k] = extra[k];
    return res;
  }

  function sameCost(a, b) {
    if (a === Infinity && b === Infinity) return true;
    return Math.abs(a - b) < EPS;
  }

  ns.algo = {
    SQRT2: SQRT2,
    JAM_COST: JAM_COST,
    DR: DR,
    DC: DC,
    PriorityQueue: PriorityQueue,
    stepCost: stepCost,
    neighbors: neighbors,
    heuristic: heuristic,
    reconstruct: reconstruct,
    pathCost: pathCost,
    EventLog: EventLog,
    finish: finish,
    sameCost: sameCost
  };
  ns.algorithms = ns.algorithms || {};
  ns.ALGO_ORDER = ['bfs', 'dfs', 'dijkstra', 'astar', 'greedy'];
})(window.GoSel = window.GoSel || {});
