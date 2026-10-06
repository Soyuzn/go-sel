/* Gamifikasi: SelPoin, level kurir, misi, rating bintang, riwayat order, kuis.
 * Setiap misi dirancang supaya pemain "menemukan" satu konsep algoritma sendiri. */
(function (ns) {
  'use strict';
  var A = ns.algo;

  var LEVELS = [
    { min: 0, name: 'Kurir Baru', color: '#6B7E73' },
    { min: 150, name: 'Kurir Pemula', color: '#43B02A' },
    { min: 400, name: 'Kurir Andal', color: '#0E7FD8' },
    { min: 800, name: 'Kurir Jagoan', color: '#7B3FE4' },
    { min: 1300, name: 'Kurir Legenda', color: '#E8A100' }
  ];

  // ctx untuk misi: { type, algo, all, diagonal, hasJam, fromMaze, size, stars, quizCorrect, tried }
  var MISSIONS = [
    { id: 'first', title: 'Order pertama', desc: 'Antar paket sampai tujuan dengan algoritma apa pun.', reward: 50,
      check: function (c) { return c.type === 'run' && c.all[c.algo].found; } },
    { id: 'all-algos', title: 'Coba semua layanan', desc: 'Jalankan kelima algoritma (dengan animasi).', reward: 100,
      check: function (c) { return c.tried.length >= 5; } },
    { id: 'compare', title: 'Analis rute', desc: 'Pakai tombol Bandingkan semua.', reward: 40,
      check: function (c) { return c.type === 'compare'; } },
    { id: 'no-path', title: 'Alamat tak terjangkau', desc: 'Jalankan algoritma di peta yang tidak punya jalur.', reward: 40,
      check: function (c) { return c.type === 'run' && !c.all[c.algo].found; } },
    { id: 'astar-half', title: 'Kompas A*', desc: 'A* mengunjungi paling banyak separuh sel yang dikunjungi Dijkstra.', reward: 60,
      check: function (c) { return c.type === 'run' && c.algo === 'astar' && c.all.astar.found && c.all.astar.visitedCount * 2 <= c.all.dijkstra.visitedCount; } },
    { id: 'bfs-jam', title: 'Terjebak macet', desc: 'Buat BFS tidak optimal memakai sel macet, lalu jalankan BFS.', reward: 80,
      check: function (c) { return c.type === 'run' && c.algo === 'bfs' && c.hasJam && c.all.bfs.found && c.all.bfs.cost > c.all.dijkstra.cost + 1e-9; } },
    { id: 'greedy-trap', title: 'Jebak si Greedy', desc: 'Jalankan Greedy di peta yang membuat jalurnya tidak optimal.', reward: 80,
      check: function (c) { return c.type === 'run' && c.algo === 'greedy' && c.all.greedy.found && c.all.greedy.cost > c.all.dijkstra.cost + 1e-9; } },
    { id: 'dfs-wander', title: 'DFS nyasar', desc: 'Jalur DFS minimal 3× lebih mahal dari jalur optimal.', reward: 60,
      check: function (c) { return c.type === 'run' && c.algo === 'dfs' && c.all.dfs.found && c.all.dfs.cost >= 3 * c.all.dijkstra.cost; } },
    { id: 'diagonal', title: 'Jalan pintas diagonal', desc: 'Antar paket dengan gerakan diagonal aktif.', reward: 30,
      check: function (c) { return c.type === 'run' && c.diagonal && c.all[c.algo].found; } },
    { id: 'maze', title: 'Penakluk labirin', desc: 'Selesaikan maze acak berukuran minimal 20 × 30 dengan A*.', reward: 50,
      check: function (c) { return c.type === 'run' && c.algo === 'astar' && c.fromMaze && c.size >= 600 && c.all.astar.found; } },
    { id: 'long', title: 'Rute antarkota', desc: 'Antar paket lewat jalur optimal sepanjang minimal 80 langkah.', reward: 60,
      check: function (c) { return c.type === 'run' && c.all.dijkstra.found && c.all.dijkstra.path.length - 1 >= 80 && c.all[c.algo].found; } },
    { id: 'quiz', title: 'Otak algoritma', desc: 'Jawab 3 soal kuis dengan benar.', reward: 60,
      check: function (c) { return c.quizCorrect >= 3; } },
    { id: 'five-stars', title: 'Bintang lima', desc: 'Dapatkan rating pengantaran ★★★★★.', reward: 40,
      check: function (c) { return c.stars === 5; } },
    { id: 'architect', title: 'Arsitek kota', desc: 'Simpan atau ekspor peta buatanmu.', reward: 20,
      check: function (c) { return c.type === 'save'; } }
  ];

  function Game(els, hooks) {
    this.els = els;
    this.hooks = hooks || {};
    var saved = ns.store.get('game', null) || {};
    this.points = saved.points | 0;
    this.done = saved.done || {};
    this.tried = saved.tried || [];
    this.quizCorrect = saved.quizCorrect | 0;
    this.history = saved.history || [];
    this.rewarded = {};               // kunci versiPeta:algoritma, cegah farming poin
    this.renderAll();
  }

  var P = Game.prototype;

  P.save = function () {
    ns.store.set('game', {
      points: this.points, done: this.done, tried: this.tried,
      quizCorrect: this.quizCorrect, history: this.history.slice(0, 8)
    });
  };

  P.level = function () {
    var cur = LEVELS[0], next = null;
    for (var i = 0; i < LEVELS.length; i++) {
      if (this.points >= LEVELS[i].min) { cur = LEVELS[i]; next = LEVELS[i + 1] || null; }
    }
    return { cur: cur, next: next };
  };

  P.addPoints = function (n, reason) {
    if (n <= 0) return;
    var before = this.level().cur;
    this.points += n;
    var after = this.level().cur;
    this.renderWallet(true);
    if (reason && this.hooks.toast) this.hooks.toast('+' + n + ' SelPoin · ' + reason, 'gold');
    if (after !== before) {
      if (this.hooks.toast) this.hooks.toast('Naik level! Kamu sekarang ' + after.name + ' 🎉', 'ok');
      if (this.hooks.confetti) this.hooks.confetti();
      this.renderBadges();
    }
    this.save();
  };

  /* Rating bintang pengantaran: optimal +2, hemat sel (≤ 60% Dijkstra) +1. */
  P.rate = function (algo, all) {
    var m = all[algo], dj = all.dijkstra;
    if (!m.found) return 0;
    var stars = 2;
    if (A.sameCost(m.cost, dj.cost)) stars += 2;
    if (m.visitedCount <= dj.visitedCount * 0.6) stars += 1;
    return Math.min(5, stars);
  };

  P.rateNote = function (algo, all, stars) {
    var m = all[algo], dj = all.dijkstra;
    var parts = [];
    parts.push(A.sameCost(m.cost, dj.cost) ? 'rute optimal ✓' : 'rute bukan yang termurah');
    parts.push(m.visitedCount <= dj.visitedCount * 0.6 ? 'pencarian hemat ✓' : 'pencarian kurang hemat');
    return parts.join(' · ') + (stars < 5 ? '. Coba algoritma lain untuk bintang lima!' : '. Sempurna!');
  };

  /* Dipanggil setelah animasi selesai. Mengembalikan jumlah bintang. */
  P.onRun = function (ctx) {
    if (this.tried.indexOf(ctx.algo) === -1) this.tried.push(ctx.algo);
    var m = ctx.all[ctx.algo];
    var stars = this.rate(ctx.algo, ctx.all);
    var key = ctx.version + ':' + ctx.algo;
    if (m.found) {
      this.history.unshift({
        algo: ctx.algo, stars: stars, cost: m.cost, len: m.path.length - 1,
        visited: m.visitedCount, at: Date.now()
      });
      this.history = this.history.slice(0, 8);
      if (!this.rewarded[key]) {
        this.rewarded[key] = true;
        this.addPoints(stars * 4, 'paket terkirim ' + '★'.repeat(stars));
      }
    }
    ctx.type = 'run';
    ctx.stars = stars;
    this.evaluate(ctx);
    this.renderHistory();
    this.save();
    return stars;
  };

  P.onCompare = function () { this.evaluate({ type: 'compare' }); };
  P.onSave = function () { this.evaluate({ type: 'save' }); };
  P.onQuiz = function (correct) {
    if (correct) {
      this.quizCorrect++;
      this.addPoints(20, 'jawaban kuis benar');
    }
    this.evaluate({ type: 'quiz' });
    this.save();
  };

  P.evaluate = function (ctx) {
    ctx.tried = this.tried;
    ctx.quizCorrect = this.quizCorrect;
    var self = this, newly = [];
    MISSIONS.forEach(function (ms) {
      if (self.done[ms.id]) return;
      var ok = false;
      try { ok = ms.check(ctx); } catch (e) { ok = false; }
      if (ok) { self.done[ms.id] = Date.now(); newly.push(ms); }
    });
    if (newly.length) {
      newly.forEach(function (ms) {
        self.addPoints(ms.reward, 'Misi "' + ms.title + '" selesai');
      });
      if (this.hooks.confetti) this.hooks.confetti();
      this.renderMissions(newly.map(function (m) { return m.id; }));
      this.save();
    }
  };

  P.reset = function () {
    this.points = 0; this.done = {}; this.tried = []; this.quizCorrect = 0; this.history = []; this.rewarded = {};
    ns.store.remove('game');
    this.renderAll();
  };

  /* ---------- Render ---------- */
  P.renderAll = function () {
    this.renderWallet(false);
    this.renderMissions([]);
    this.renderBadges();
    this.renderHistory();
  };

  P.renderWallet = function (bump) {
    var e = this.els, lv = this.level();
    e.points.textContent = this.points.toLocaleString('id-ID');
    if (e.pointsMini) e.pointsMini.textContent = e.points.textContent;
    if (bump) {
      e.points.classList.remove('bump');
      void e.points.offsetWidth;
      e.points.classList.add('bump');
    }
    e.levelName.textContent = lv.cur.name;
    if (lv.next) {
      var span = lv.next.min - lv.cur.min, prog = Math.round(((this.points - lv.cur.min) / span) * 100);
      e.levelProgress.value = prog;
      e.levelProgress.textContent = prog + '%';
      e.levelNext.textContent = (lv.next.min - this.points).toLocaleString('id-ID') + ' poin lagi ke ' + lv.next.name;
    } else {
      e.levelProgress.value = 100;
      e.levelNext.textContent = 'Level tertinggi tercapai!';
    }
  };

  P.renderMissions = function (fresh) {
    var list = this.els.missionList, tpl = this.els.missionTpl, self = this;
    list.textContent = '';
    var count = 0;
    MISSIONS.forEach(function (ms) {
      var node = tpl.content.cloneNode(true), li = node.querySelector('li');
      var isDone = !!self.done[ms.id];
      if (isDone) count++;
      li.classList.toggle('is-done', isDone);
      if (fresh.indexOf(ms.id) !== -1) li.classList.add('is-new');
      li.querySelector('.mission__title').textContent = ms.title;
      li.querySelector('.mission__desc').textContent = ms.desc;
      li.querySelector('.mission__reward').textContent = isDone ? '✓ +' + ms.reward : '+' + ms.reward;
      li.querySelector('use').setAttribute('href', isDone ? '#i-check' : '#i-target');
      li.setAttribute('aria-label', ms.title + (isDone ? ', selesai' : ', belum selesai') + '. ' + ms.desc);
      list.appendChild(node);
    });
    this.els.missionCount.textContent = count + '/' + MISSIONS.length;
    this.els.missionProgress.max = MISSIONS.length;
    this.els.missionProgress.value = count;
  };

  P.renderBadges = function () {
    var ul = this.els.badgeList, pts = this.points;
    ul.textContent = '';
    LEVELS.forEach(function (lv) {
      var on = pts >= lv.min;
      var li = document.createElement('li');
      li.className = 'badge' + (on ? ' is-on' : '');
      li.style.setProperty('--medal', lv.color);
      li.innerHTML = '<span class="badge__medal"><svg class="ico" aria-hidden="true"><use href="' + (on ? '#i-medal' : '#i-lock') +
        '"/></svg></span><span></span>';
      li.lastChild.textContent = lv.name.replace('Kurir ', '');
      li.title = lv.name + (on ? ' (terbuka)' : ' (butuh ' + lv.min + ' poin)');
      ul.appendChild(li);
    });
  };

  P.renderHistory = function () {
    var ol = this.els.history;
    ol.textContent = '';
    if (!this.history.length) {
      var e = document.createElement('li');
      e.className = 'empty';
      e.textContent = 'Belum ada order. Antar paket pertamamu!';
      ol.appendChild(e);
      return;
    }
    this.history.forEach(function (h) {
      var li = document.createElement('li');
      var name = document.createElement('strong');
      name.textContent = ns.algorithms[h.algo] ? ns.algorithms[h.algo].name : h.algo;
      var sub = document.createElement('span');
      sub.className = 'h-sub mono';
      sub.textContent = h.len + ' langkah · biaya ' + ns.Stats.fmtCost(h.cost) + ' · ' + h.visited + ' sel';
      var st = document.createElement('span');
      st.className = 'h-stars';
      st.textContent = '★'.repeat(h.stars) + '☆'.repeat(5 - h.stars);
      st.setAttribute('aria-label', h.stars + ' bintang');
      li.appendChild(name); li.appendChild(sub); li.appendChild(st);
      ol.appendChild(li);
    });
  };

  /* ---------- Kuis berbasis data peta saat ini ---------- */
  function names(ids) { return ids.map(function (id) { return ns.algorithms[id].name; }).join(', '); }

  Game.makeQuestion = function (all, ctx, avoid) {
    var ids = ns.ALGO_ORDER, found = all.dijkstra.found;
    var gens = [];

    // Di peta tanpa jalur semua algoritma menjelajah area yang sama, soal ini jadi tidak bermakna.
    if (found) gens.push(function () {
      var min = Math.min.apply(null, ids.map(function (id) { return all[id].visitedCount; }));
      var ok = ids.filter(function (id) { return all[id].visitedCount === min; });
      return {
        key: 'least',
        q: 'Di peta ini, algoritma mana yang mengunjungi sel PALING SEDIKIT?',
        options: ids.map(function (id) { return { value: id, label: ns.algorithms[id].name }; }),
        correct: ok,
        explain: names(ok) + ' hanya mengunjungi ' + min + ' sel. ' +
          (ok.indexOf('greedy') !== -1 || ok.indexOf('astar') !== -1 ? 'Heuristik menarik pencarian langsung ke arah tujuan.' : 'Urutan arah tetangga kebetulan menguntungkan di peta ini.')
      };
    });

    if (found) {
      gens.push(function () {
        var opt = A.sameCost(all.greedy.cost, all.dijkstra.cost);
        return {
          key: 'greedy-opt',
          q: 'Apakah Greedy Best-First menemukan jalur OPTIMAL (biaya termurah) di peta ini?',
          options: [{ value: 'ya', label: 'Ya, optimal' }, { value: 'tidak', label: 'Tidak, lebih mahal' }],
          correct: [opt ? 'ya' : 'tidak'],
          explain: 'Biaya Greedy ' + ns.Stats.fmtCost(all.greedy.cost) + ', biaya optimal ' + ns.Stats.fmtCost(all.dijkstra.cost) + '. ' +
            (opt ? 'Kali ini Greedy beruntung, tapi ia tidak menjamin optimal.' : 'Greedy mengabaikan biaya yang sudah ditempuh.')
        };
      });

      var costs = ids.map(function (id) { return all[id].cost; });
      var maxC = Math.max.apply(null, costs), minC = Math.min.apply(null, costs);
      if (maxC - minC > 1e-9) {
        gens.push(function () {
          var ok = ids.filter(function (id) { return A.sameCost(all[id].cost, maxC); });
          return {
            key: 'most-cost',
            q: 'Algoritma mana yang menghasilkan jalur PALING MAHAL di peta ini?',
            options: ids.map(function (id) { return { value: id, label: ns.algorithms[id].name }; }),
            correct: ok,
            explain: names(ok) + ' menghasilkan biaya ' + ns.Stats.fmtCost(maxC) + ', padahal yang optimal hanya ' + ns.Stats.fmtCost(minC) + '.'
          };
        });
      }

      gens.push(function () {
        var same = A.sameCost(all.bfs.cost, all.dijkstra.cost);
        return {
          key: 'bfs-dij',
          q: 'Apakah biaya jalur BFS SAMA dengan Dijkstra di peta ini?' + (ctx.diagonal ? ' (diagonal aktif)' : ''),
          options: [{ value: 'ya', label: 'Ya, sama' }, { value: 'tidak', label: 'Tidak, BFS lebih mahal' }],
          correct: [same ? 'ya' : 'tidak'],
          explain: same
            ? 'Sama (' + ns.Stats.fmtCost(all.bfs.cost) + '). Jika semua langkah berbiaya sama, BFS ikut optimal.'
            : 'BFS ' + ns.Stats.fmtCost(all.bfs.cost) + ' vs Dijkstra ' + ns.Stats.fmtCost(all.dijkstra.cost) + '. BFS menghitung langkah, bukan biaya, jadi kalah saat ada ' + (ctx.hasJam ? 'sel macet' : 'diagonal') + '.'
        };
      });

      gens.push(function () {
        var saved = Math.round((1 - all.astar.visitedCount / all.dijkstra.visitedCount) * 100);
        var buckets = [[-Infinity, 20, 'Kurang dari 20%'], [20, 40, '20% – 39%'], [40, 60, '40% – 59%'], [60, Infinity, '60% atau lebih']];
        var ok = buckets.filter(function (b) { return saved >= b[0] && saved < b[1]; })[0];
        return {
          key: 'astar-pct',
          q: 'Dibanding Dijkstra, kira-kira berapa persen sel yang DIHEMAT A* di peta ini?',
          options: buckets.map(function (b) { return { value: b[2], label: b[2] }; }),
          correct: [ok[2]],
          explain: 'A* mengunjungi ' + all.astar.visitedCount + ' sel, Dijkstra ' + all.dijkstra.visitedCount + ' sel: hemat ' + Math.max(0, saved) + '%.'
        };
      });
    }

    gens.push(function () {
      return {
        key: 'exists',
        q: 'Bisakah kurir mencapai alamat tujuan di peta ini?',
        options: [{ value: 'ya', label: 'Bisa' }, { value: 'tidak', label: 'Tidak bisa' }],
        correct: [found ? 'ya' : 'tidak'],
        explain: found ? 'Bisa: jalur optimal berbiaya ' + ns.Stats.fmtCost(all.dijkstra.cost) + '.' : 'Tidak bisa: tujuan atau kurir terkurung gedung.'
      };
    });

    var pool = gens.filter(function (g, i) { return gens.length < 2 || i !== avoid; });
    var pick = Math.floor(Math.random() * pool.length);
    var q = pool[pick]();
    q.index = gens.indexOf(pool[pick]);
    return q;
  };

  Game.LEVELS = LEVELS;
  Game.MISSIONS = MISSIONS;
  ns.Game = Game;
})(window.GoSel = window.GoSel || {});
