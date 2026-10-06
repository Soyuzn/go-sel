/* State aplikasi + state machine: IDLE -> READY -> RUNNING <-> PAUSED -> DONE */
(function (ns) {
  'use strict';

  var S = {
    IDLE: 'idle',       // bidak belum lengkap
    READY: 'ready',     // siap dijalankan
    RUNNING: 'running', // animasi berjalan
    PAUSED: 'paused',   // animasi dijeda
    DONE: 'done'        // animasi selesai
  };

  var TRANSITIONS = {
    idle: ['ready'],
    ready: ['idle', 'running', 'paused', 'done'],
    running: ['paused', 'done', 'ready', 'idle'],
    paused: ['running', 'done', 'ready', 'idle'],
    done: ['ready', 'idle']
  };

  function Machine() {
    this.state = S.IDLE;
    this.listeners = [];
  }

  Machine.prototype.is = function () {
    for (var i = 0; i < arguments.length; i++) if (this.state === arguments[i]) return true;
    return false;
  };

  Machine.prototype.can = function (to) {
    return to === this.state || TRANSITIONS[this.state].indexOf(to) !== -1;
  };

  Machine.prototype.go = function (to) {
    if (to === this.state) return true;
    if (!this.can(to)) {
      console.warn('[Go-Sel] transisi ditolak: ' + this.state + ' -> ' + to);
      return false;
    }
    var from = this.state;
    this.state = to;
    for (var i = 0; i < this.listeners.length; i++) this.listeners[i](to, from);
    return true;
  };

  Machine.prototype.onChange = function (fn) { this.listeners.push(fn); };

  /* Pengaturan yang memengaruhi validitas hasil (diagonal, ukuran, peta) menaikkan
   * mapVersion; tabel perbandingan memakai angka ini untuk menandai "kedaluwarsa". */
  ns.STATES = S;
  ns.Machine = Machine;
  ns.settings = {
    algo: 'astar',
    diagonal: false,
    speed: 55,
    tool: 1,
    density: 0.25
  };

  /* Pembungkus localStorage: aplikasi tetap jalan di mode privat. */
  ns.store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem('go-sel:' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem('go-sel:' + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) {
      try { window.localStorage.removeItem('go-sel:' + key); } catch (e) { /* abaikan */ }
    }
  };
})(window.GoSel = window.GoSel || {});
