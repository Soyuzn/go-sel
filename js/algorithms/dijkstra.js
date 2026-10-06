/* Dijkstra: priority queue berdasarkan biaya g terkecil, lazy deletion. */
(function (ns) {
  'use strict';
  var A = ns.algo;

  function solve(cells, rows, cols, start, goal, opts) {
    opts = opts || {};
    var diagonal = !!opts.diagonal, log = new A.EventLog(!!opts.record);
    var n = rows * cols;
    var parent = new Int32Array(n).fill(-1);
    var dist = new Float64Array(n).fill(Infinity);
    var closed = new Uint8Array(n);
    var pq = new A.PriorityQueue(256);
    var visited = 0, found = false;
    var nIdx = new Int32Array(8), nCost = new Float64Array(8);

    dist[start] = 0;
    pq.push(start, 0, 0);
    log.add(1, start);

    while (pq.size > 0) {
      var cur = pq.pop();
      if (closed[cur]) continue;           // entri basi (lazy deletion)
      closed[cur] = 1;
      visited++;
      log.add(2, cur);
      if (cur === goal) { found = true; log.add(3, cur); break; }
      var k = A.neighbors(cells, rows, cols, cur, diagonal, nIdx, nCost);
      for (var i = 0; i < k; i++) {
        var nb = nIdx[i];
        if (closed[nb]) continue;
        var nd = dist[cur] + nCost[i];
        if (nd < dist[nb] - 1e-12) {
          dist[nb] = nd;
          parent[nb] = cur;
          pq.push(nb, nd, 0);
          log.add(1, nb);
        }
      }
      log.add(3, cur);
    }
    return A.finish(found, parent, start, goal, cells, cols, visited, log,
      opts.record ? { g: dist } : null);
  }

  ns.algorithms.dijkstra = {
    id: 'dijkstra', name: 'Dijkstra', fullName: "Dijkstra's Algorithm",
    structure: 'Priority queue (min-heap, kunci g)', usesHeuristic: false, weighted: true,
    solve: solve
  };
})(window.GoSel = window.GoSel || {});
