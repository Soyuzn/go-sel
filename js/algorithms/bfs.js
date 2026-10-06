/* Breadth-First Search: antrean FIFO, menjelajah lapis demi lapis. */
(function (ns) {
  'use strict';
  var A = ns.algo;

  function solve(cells, rows, cols, start, goal, opts) {
    opts = opts || {};
    var diagonal = !!opts.diagonal, log = new A.EventLog(!!opts.record);
    var n = rows * cols;
    var parent = new Int32Array(n).fill(-1);
    var seen = new Uint8Array(n);
    var queue = new Int32Array(n);
    var head = 0, tail = 0, visited = 0, found = false;
    var nIdx = new Int32Array(8), nCost = new Float64Array(8);

    queue[tail++] = start; seen[start] = 1; log.add(1, start);

    while (head < tail) {
      var cur = queue[head++];
      visited++;
      log.add(2, cur);
      if (cur === goal) { found = true; log.add(3, cur); break; }
      var k = A.neighbors(cells, rows, cols, cur, diagonal, nIdx, nCost);
      for (var i = 0; i < k; i++) {
        var nb = nIdx[i];
        if (seen[nb]) continue;
        seen[nb] = 1;
        parent[nb] = cur;
        queue[tail++] = nb;
        log.add(1, nb);
      }
      log.add(3, cur);
    }
    return A.finish(found, parent, start, goal, cells, cols, visited, log);
  }

  ns.algorithms.bfs = {
    id: 'bfs', name: 'BFS', fullName: 'Breadth-First Search',
    structure: 'Queue (FIFO)', usesHeuristic: false, weighted: false,
    solve: solve
  };
})(window.GoSel = window.GoSel || {});
