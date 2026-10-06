/* Greedy Best-First: priority queue berdasarkan h saja (abaikan biaya yang sudah ditempuh). */
(function (ns) {
  'use strict';
  var A = ns.algo;

  function solve(cells, rows, cols, start, goal, opts) {
    opts = opts || {};
    var diagonal = !!opts.diagonal, log = new A.EventLog(!!opts.record);
    var n = rows * cols;
    var parent = new Int32Array(n).fill(-1);
    var seen = new Uint8Array(n);
    var closed = new Uint8Array(n);
    var pq = new A.PriorityQueue(256);
    var visited = 0, found = false;
    var nIdx = new Int32Array(8), nCost = new Float64Array(8);

    seen[start] = 1;
    pq.push(start, A.heuristic(start, goal, cols, diagonal), 0);
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
        if (seen[nb]) continue;
        seen[nb] = 1;
        parent[nb] = cur;
        pq.push(nb, A.heuristic(nb, goal, cols, diagonal), 0);
        log.add(1, nb);
      }
      log.add(3, cur);
    }
    return A.finish(found, parent, start, goal, cells, cols, visited, log);
  }

  ns.algorithms.greedy = {
    id: 'greedy', name: 'Greedy', fullName: 'Greedy Best-First Search',
    structure: 'Priority queue (min-heap, kunci h)', usesHeuristic: true, weighted: false,
    solve: solve
  };
})(window.GoSel = window.GoSel || {});
