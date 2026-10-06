/* Depth-First Search: stack iteratif (bukan rekursi), masuk sedalam mungkin dulu. */
(function (ns) {
  'use strict';
  var A = ns.algo;

  function solve(cells, rows, cols, start, goal, opts) {
    opts = opts || {};
    var diagonal = !!opts.diagonal, log = new A.EventLog(!!opts.record);
    var n = rows * cols;
    var parent = new Int32Array(n).fill(-1);
    var closed = new Uint8Array(n);
    // Tiap sel ditutup sekali dan mendorong paling banyak 8 tetangga.
    var cap = n * 8 + 1;
    var stack = new Int32Array(cap), from = new Int32Array(cap);
    var sp = 0, visited = 0, found = false;
    var nIdx = new Int32Array(8), nCost = new Float64Array(8);

    stack[sp] = start; from[sp] = -1; sp++;
    log.add(1, start);

    while (sp > 0) {
      sp--;
      var cur = stack[sp], p = from[sp];
      if (closed[cur]) continue;
      closed[cur] = 1;
      parent[cur] = p;
      visited++;
      log.add(2, cur);
      if (cur === goal) { found = true; log.add(3, cur); break; }
      var k = A.neighbors(cells, rows, cols, cur, diagonal, nIdx, nCost);
      // Dorong terbalik supaya tetangga pertama (atas) diambil lebih dulu.
      for (var i = k - 1; i >= 0; i--) {
        var nb = nIdx[i];
        if (closed[nb]) continue;
        stack[sp] = nb; from[sp] = cur; sp++;
        log.add(1, nb);
      }
      log.add(3, cur);
    }
    return A.finish(found, parent, start, goal, cells, cols, visited, log);
  }

  ns.algorithms.dfs = {
    id: 'dfs', name: 'DFS', fullName: 'Depth-First Search',
    structure: 'Stack (LIFO)', usesHeuristic: false, weighted: false,
    solve: solve
  };
})(window.GoSel = window.GoSel || {});
