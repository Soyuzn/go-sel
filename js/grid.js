/* Model grid: Uint8Array(rows * cols), indeks r * cols + c.
 * Nilai sel: 0 kosong, 1 gedung, 2 macet. Bidak disimpan sebagai {r, c}. */
(function (ns) {
  'use strict';

  var EMPTY = 0, BUILDING = 1, JAM = 2;

  function Grid(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.cells = new Uint8Array(rows * cols);
    this.start = null;
    this.goal = null;
  }

  Grid.EMPTY = EMPTY;
  Grid.BUILDING = BUILDING;
  Grid.JAM = JAM;
  Grid.MIN_ROWS = 5; Grid.MAX_ROWS = 60;
  Grid.MIN_COLS = 5; Grid.MAX_COLS = 100;

  var P = Grid.prototype;

  P.idx = function (r, c) { return r * this.cols + c; };
  P.rc = function (i) { var r = (i / this.cols) | 0; return { r: r, c: i - r * this.cols }; };
  P.inBounds = function (r, c) { return r >= 0 && c >= 0 && r < this.rows && c < this.cols; };
  P.get = function (r, c) { return this.cells[r * this.cols + c]; };

  P.set = function (r, c, v) {
    var i = r * this.cols + c;
    if (this.cells[i] === v) return false;
    this.cells[i] = v;
    return true;
  };

  P.pieceAt = function (r, c) {
    if (this.start && this.start.r === r && this.start.c === c) return 'start';
    if (this.goal && this.goal.r === r && this.goal.c === c) return 'goal';
    return null;
  };

  P.hasPieces = function () { return !!(this.start && this.goal); };
  P.startIndex = function () { return this.start ? this.idx(this.start.r, this.start.c) : -1; };
  P.goalIndex = function () { return this.goal ? this.idx(this.goal.r, this.goal.c) : -1; };

  /* Sel kosong terdekat (BFS 8 arah, mengabaikan gedung) yang bukan `exclude`.
   * Kalau grid penuh gedung, sel asal dikosongkan. */
  P.nearestFree = function (r, c, exclude) {
    r = Math.max(0, Math.min(this.rows - 1, r));
    c = Math.max(0, Math.min(this.cols - 1, c));
    var n = this.rows * this.cols, seen = new Uint8Array(n), q = new Int32Array(n);
    var head = 0, tail = 0, s = this.idx(r, c);
    var ex = exclude ? this.idx(exclude.r, exclude.c) : -1;
    q[tail++] = s; seen[s] = 1;
    while (head < tail) {
      var i = q[head++];
      if (this.cells[i] !== BUILDING && i !== ex) return this.rc(i);
      var ir = (i / this.cols) | 0, ic = i - ir * this.cols;
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          var nr = ir + dr, nc = ic + dc;
          if (!this.inBounds(nr, nc)) continue;
          var ni = nr * this.cols + nc;
          if (!seen[ni]) { seen[ni] = 1; q[tail++] = ni; }
        }
      }
    }
    this.cells[s] = EMPTY;
    return { r: r, c: c };
  };

  /* Ubah ukuran: gedung yang masih muat dipertahankan, bidak di luar batas dipindah. */
  P.resize = function (rows, cols) {
    rows = Math.max(Grid.MIN_ROWS, Math.min(Grid.MAX_ROWS, rows | 0));
    cols = Math.max(Grid.MIN_COLS, Math.min(Grid.MAX_COLS, cols | 0));
    if (rows === this.rows && cols === this.cols) return [];
    var next = new Uint8Array(rows * cols);
    var rr = Math.min(rows, this.rows), cc = Math.min(cols, this.cols);
    for (var r = 0; r < rr; r++) {
      for (var c = 0; c < cc; c++) next[r * cols + c] = this.cells[r * this.cols + c];
    }
    this.rows = rows; this.cols = cols; this.cells = next;
    var moved = [];
    var self = this;
    ['start', 'goal'].forEach(function (k) {
      var p = self[k];
      if (!p) return;
      if (!self.inBounds(p.r, p.c)) {
        var other = k === 'start' ? self.goal : self.start;
        if (other && !self.inBounds(other.r, other.c)) other = null;
        self[k] = self.nearestFree(p.r, p.c, other);
        moved.push(k);
      }
    });
    if (this.start && this.goal && this.start.r === this.goal.r && this.start.c === this.goal.c) {
      this.goal = this.nearestFree(this.goal.r, this.goal.c, this.start);
    }
    return moved;
  };

  P.clearObstacles = function () { this.cells.fill(EMPTY); };
  P.clearAll = function () { this.cells.fill(EMPTY); this.start = null; this.goal = null; };

  P.count = function (value) {
    var n = 0;
    for (var i = 0; i < this.cells.length; i++) if (this.cells[i] === value) n++;
    return n;
  };

  P.clone = function () {
    var g = new Grid(this.rows, this.cols);
    g.cells.set(this.cells);
    g.start = this.start ? { r: this.start.r, c: this.start.c } : null;
    g.goal = this.goal ? { r: this.goal.r, c: this.goal.c } : null;
    return g;
  };

  P.copyFrom = function (g) {
    this.rows = g.rows; this.cols = g.cols;
    this.cells = new Uint8Array(g.cells);
    this.start = g.start ? { r: g.start.r, c: g.start.c } : null;
    this.goal = g.goal ? { r: g.goal.r, c: g.goal.c } : null;
  };

  /* ---------- Serialisasi (localStorage dan file JSON) ---------- */
  P.toJSON = function () {
    var s = '';
    for (var i = 0; i < this.cells.length; i++) s += this.cells[i];
    return {
      app: 'go-sel', version: 1,
      rows: this.rows, cols: this.cols, cells: s,
      start: this.start ? [this.start.r, this.start.c] : null,
      goal: this.goal ? [this.goal.r, this.goal.c] : null
    };
  };

  Grid.fromJSON = function (o) {
    if (!o || o.app !== 'go-sel') throw new Error('Bukan file peta Go-Sel.');
    var rows = o.rows | 0, cols = o.cols | 0;
    if (rows < Grid.MIN_ROWS || rows > Grid.MAX_ROWS || cols < Grid.MIN_COLS || cols > Grid.MAX_COLS) {
      throw new Error('Ukuran peta di luar batas.');
    }
    if (typeof o.cells !== 'string' || o.cells.length !== rows * cols || /[^012]/.test(o.cells)) {
      throw new Error('Data sel rusak.');
    }
    var g = new Grid(rows, cols);
    for (var i = 0; i < o.cells.length; i++) g.cells[i] = o.cells.charCodeAt(i) - 48;
    function piece(p) {
      if (!Array.isArray(p) || p.length !== 2) return null;
      var r = p[0] | 0, c = p[1] | 0;
      if (!g.inBounds(r, c)) return null;
      g.cells[r * cols + c] = EMPTY;
      return { r: r, c: c };
    }
    g.start = piece(o.start);
    g.goal = piece(o.goal);
    if (g.start && g.goal && g.start.r === g.goal.r && g.start.c === g.goal.c) g.goal = null;
    return g;
  };

  ns.Grid = Grid;
})(window.GoSel = window.GoSel || {});
