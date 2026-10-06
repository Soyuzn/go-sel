/* Generator peta: maze recursive backtracker (iteratif) dan gedung acak. */
(function (ns) {
  'use strict';

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* Ruang ada di koordinat ganjil. Mengembalikan sel final dan urutan penggalian
   * (untuk animasi). loopFactor > 0 membuka sebagian tembok agar ada beberapa rute,
   * sehingga perbedaan antar algoritma lebih terlihat. */
  function backtracker(rows, cols, rng, loopFactor) {
    rng = rng || Math.random;
    var cells = new Uint8Array(rows * cols).fill(1);
    var order = [];
    var roomRows = Math.floor((rows - 1) / 2), roomCols = Math.floor((cols - 1) / 2);
    if (roomRows < 1 || roomCols < 1) { cells.fill(0); return { cells: cells, order: order }; }

    function carve(r, c) {
      var i = r * cols + c;
      if (cells[i] !== 0) { cells[i] = 0; order.push(i); }
    }

    var visited = new Uint8Array(roomRows * roomCols);
    var sr = Math.floor(rng() * roomRows), sc = Math.floor(rng() * roomCols);
    var stack = [[sr, sc]];
    visited[sr * roomCols + sc] = 1;
    carve(sr * 2 + 1, sc * 2 + 1);
    var dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];

    while (stack.length) {
      var top = stack[stack.length - 1], r = top[0], c = top[1];
      var opts = [];
      for (var d = 0; d < 4; d++) {
        var nr = r + dirs[d][0], nc = c + dirs[d][1];
        if (nr >= 0 && nc >= 0 && nr < roomRows && nc < roomCols && !visited[nr * roomCols + nc]) opts.push(d);
      }
      if (!opts.length) { stack.pop(); continue; }
      var pick = opts[Math.floor(rng() * opts.length)];
      var tr = r + dirs[pick][0], tc = c + dirs[pick][1];
      visited[tr * roomCols + tc] = 1;
      carve(r * 2 + 1 + dirs[pick][0], c * 2 + 1 + dirs[pick][1]);
      carve(tr * 2 + 1, tc * 2 + 1);
      stack.push([tr, tc]);
    }

    if (loopFactor > 0) {
      // Tembok tipis di antara dua ruang (horizontal atau vertikal) dibuka sebagian.
      var candidates = [];
      for (var rr = 1; rr < rows - 1; rr++) {
        for (var cc = 1; cc < cols - 1; cc++) {
          var i = rr * cols + cc;
          if (cells[i] !== 1) continue;
          var h = cells[i - 1] === 0 && cells[i + 1] === 0 && cells[i - cols] === 1 && cells[i + cols] === 1;
          var v = cells[i - cols] === 0 && cells[i + cols] === 0 && cells[i - 1] === 1 && cells[i + 1] === 1;
          if (h || v) candidates.push(i);
        }
      }
      shuffle(candidates, rng);
      var take = Math.floor(candidates.length * loopFactor);
      for (var k = 0; k < take; k++) { cells[candidates[k]] = 0; order.push(candidates[k]); }
    }
    return { cells: cells, order: order };
  }

  // Gedung acak dengan kepadatan tertentu (tidak menjamin ada jalur).
  function randomBuildings(rows, cols, density, rng) {
    rng = rng || Math.random;
    var cells = new Uint8Array(rows * cols);
    for (var i = 0; i < cells.length; i++) cells[i] = rng() < density ? 1 : 0;
    return cells;
  }

  // PRNG kecil (mulberry32) supaya tantangan bisa direproduksi dari seed.
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  ns.Maze = { backtracker: backtracker, randomBuildings: randomBuildings, seeded: seeded, shuffle: shuffle };
})(window.GoSel = window.GoSel || {});
