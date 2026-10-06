/* Skenario siap coba: tiap peta dirancang untuk memperlihatkan sifat satu algoritma. */
(function (ns) {
  'use strict';

  function blank(rows, cols) {
    var g = new ns.Grid(rows, cols);
    return g;
  }

  function rect(g, r0, c0, r1, c1, v) {
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (g.inBounds(r, c)) g.cells[g.idx(r, c)] = v;
  }

  var list = [
    {
      id: 'open',
      tag: 'A*',
      tone: 'var(--svc-astar)',
      algo: 'astar',
      title: 'Kota lengang',
      desc: 'Peta kosong. Lihat A* melesat lurus, sementara Dijkstra menyebar seperti riak.',
      build: function () {
        var g = blank(20, 30);
        g.start = { r: 10, c: 3 }; g.goal = { r: 9, c: 26 };
        return { grid: g, diagonal: false };
      }
    },
    {
      id: 'jam',
      tag: 'Bobot',
      tone: 'var(--svc-dijkstra)',
      algo: 'bfs',
      title: 'Jalan macet',
      desc: 'Jalan pintas penuh macet. BFS nekat menerobos, Dijkstra dan A* memilih memutar.',
      build: function () {
        var g = blank(17, 30);
        rect(g, 3, 4, 3, 25, 1);
        rect(g, 13, 4, 13, 25, 1);
        rect(g, 4, 4, 12, 4, 1);
        rect(g, 4, 25, 12, 25, 1);
        rect(g, 7, 4, 9, 25, 2);         // koridor tengah macet
        rect(g, 7, 4, 9, 4, 2);
        rect(g, 7, 25, 9, 25, 2);
        g.start = { r: 8, c: 1 }; g.goal = { r: 8, c: 28 };
        return { grid: g, diagonal: false };
      }
    },
    {
      id: 'trap',
      tag: 'Greedy',
      tone: 'var(--svc-greedy)',
      algo: 'greedy',
      title: 'Kantong buntu',
      desc: 'Tembok U menghadap kurir. Greedy masuk kantong dulu lalu memutar, A* tetap optimal.',
      build: function () {
        var g = blank(21, 31);
        rect(g, 4, 18, 16, 18, 1);   // sisi belakang U
        rect(g, 4, 8, 4, 18, 1);     // sisi atas
        rect(g, 16, 8, 16, 18, 1);   // sisi bawah
        g.start = { r: 10, c: 3 }; g.goal = { r: 10, c: 27 };
        return { grid: g, diagonal: true };
      }
    },
    {
      id: 'maze',
      tag: 'DFS',
      tone: 'var(--svc-dfs)',
      algo: 'dfs',
      title: 'Labirin gang sempit',
      desc: 'Maze dengan beberapa jalan pintas. DFS sering berkelok jauh dari jalur terpendek.',
      build: function () {
        var g = blank(25, 41);
        var m = ns.Maze.backtracker(25, 41, ns.Maze.seeded(22), 0.12);
        g.cells.set(m.cells);
        g.start = g.nearestFree(1, 1, null);
        g.goal = g.nearestFree(23, 39, g.start);
        return { grid: g, diagonal: false };
      }
    },
    {
      id: 'diag',
      tag: 'Diagonal',
      tone: 'var(--svc-bfs)',
      algo: 'astar',
      title: 'Pojok bersilangan',
      desc: 'Diagonal aktif. Perhatikan kurir tidak menyelip di antara gedung yang bersentuhan sudut.',
      build: function () {
        var g = blank(18, 28);
        // Garis gedung diagonal setebal satu sel: tampak "bocor" di setiap sudut,
        // tapi tanpa corner cutting kurir tetap harus memutar lewat ujungnya.
        for (var i = 0; i <= 12; i++) g.cells[g.idx(2 + i, 6 + i)] = 1;
        g.start = { r: 14, c: 4 }; g.goal = { r: 3, c: 22 };
        return { grid: g, diagonal: true };
      }
    },
    {
      id: 'boxed',
      tag: 'Tanpa jalur',
      tone: 'var(--gs-red-500)',
      algo: 'bfs',
      title: 'Alamat terkurung',
      desc: 'Rumah tujuan dikelilingi gedung. Lihat algoritma menjelajah semua sel sebelum menyerah.',
      build: function () {
        var g = blank(16, 26);
        rect(g, 5, 15, 11, 21, 1);
        rect(g, 6, 16, 10, 20, 0);
        rect(g, 4, 3, 4, 10, 1);
        rect(g, 11, 3, 11, 10, 1);
        g.start = { r: 8, c: 4 }; g.goal = { r: 8, c: 18 };
        return { grid: g, diagonal: false };
      }
    }
  ];

  ns.Scenarios = list;
})(window.GoSel = window.GoSel || {});
