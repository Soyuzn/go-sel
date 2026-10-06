/* Animasi UI ringan tanpa library:
 *  - reveal   : bagian halaman muncul halus saat di-scroll (IntersectionObserver)
 *  - countUp  : angka statistik & poin naik bertahap (requestAnimationFrame)
 *  - ripple   : efek riak saat tombol ditekan
 *  - tema     : transisi lingkaran saat ganti tema (View Transitions API)
 * Semua mati otomatis jika pengguna memilih prefers-reduced-motion. */
(function (ns) {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Muncul saat masuk layar
  function reveal() {
    var items = document.querySelectorAll('.card, .home > *');
    if (reduced || !window.IntersectionObserver) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08 });
    items.forEach(function (el) {
      // Elemen yang sudah terlihat saat halaman dibuka tidak perlu dianimasikan.
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  // Tampilkan semua bagian sekaligus (dipakai saat lompat langsung lewat link).
  function revealAll() {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  // Angka naik dari nilai lama ke nilai baru. format(n) mengubah angka jadi teks.
  function countUp(el, to, format, duration) {
    if (reduced || !isFinite(to)) { el.textContent = format(to); return; }
    var from = +el.dataset.num || 0;
    var start = performance.now();
    duration = duration || 600;
    el.dataset.num = to;
    (function frame(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(frame);
    })(start);
  }

  // Efek riak di tombol (gaya aplikasi mobile)
  function ripple() {
    if (reduced) return;
    document.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('.btn, .wallet__action, .service, .bottomnav a');
      if (!btn || btn.disabled) return;
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 1.6;
      var dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = (e.clientX - rect.left - size / 2) + 'px';
      dot.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 600);
    });
  }

  // Ganti tema dengan lingkaran yang membesar dari tombol tema.
  function themeSwitch(button, change) {
    if (reduced || !document.startViewTransition) { change(); return; }
    var r = button.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var vt = document.startViewTransition(change);
    vt.ready.then(function () {
      document.documentElement.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 550, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  }

  ns.motion = { reduced: reduced, reveal: reveal, revealAll: revealAll, countUp: countUp, ripple: ripple, themeSwitch: themeSwitch };
})(window.GoSel = window.GoSel || {});
