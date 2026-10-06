/* A*: priority queue berdasarkan f = g + h, tie-breaking memilih h terkecil. */
(function (ns) {
  'use strict';
  var A = ns.algo;

  function solve(cells, rows, cols, start, goal, opts) {
    opts = opts || {};
    var diagonal = !!opts.diagonal, log = new A.EventLog(!!opts.record);
    var n = rows * cols;
    var parent = new Int32Array(n).fill(-1);
    var g = new Float64Array(n).fill(Infinity);
    var closed = new Uint8Array(n);
    var pq = new A.PriorityQueue(256);
    var visited = 0, found = false;
    var nIdx = new Int32Array(8), nCost = new Float64Array(8);

    g[start] = 0;
    var h0 = A.heuristic(start, goal, cols, diagonal);
    pq.push(start, h0, h0);
    log.add(1, start);

    while (pq.size > 0) {
      var cur = pq.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      visited++;
      log.add(2, cur);
      if (cur === goal) { found = true; log.add(3, cur); break; }
      var k = A.neighbors(cells, rows, cols, cur, diagonal, nIdx, nCost);
      for (var i = 0; i < k; i++) {
        var nb = nIdx[i];
        if (closed[nb]) continue;
        var ng = g[cur] + nCost[i];
        if (ng < g[nb] - 1e-12) {
          g[nb] = ng;
          parent[nb] = cur;
          var h = A.heuristic(nb, goal, cols, diagonal);
          pq.push(nb, ng + h, h);
          log.add(1, nb);
        }
      }
      log.add(3, cur);
    }
    return A.finish(found, parent, start, goal, cells, cols, visited, log,
      opts.record ? { g: g } : null);
  }

  ns.algorithms.astar = {
    id: 'astar', name: 'A*', fullName: 'A* Search',
    structure: 'Priority queue (min-heap, kunci f = g + h)', usesHeuristic: true, weighted: true,
    solve: solve
  };
})(window.GoSel = window.GoSel || {});
