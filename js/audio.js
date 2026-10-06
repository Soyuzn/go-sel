/* Suara Go-Sel, semua disintesis dengan Web Audio API (tanpa file audio).
 *  - think(t)  : "suara berpikir" tiap sel diproses. t = 0 (jauh dari tujuan) .. 1 (dekat),
 *                dipetakan ke tangga nada pentatonik supaya tetap enak didengar.
 *  - musik     : pola arpeggio + bass lembut selama algoritma berjalan.
 * Browser hanya mengizinkan audio setelah interaksi pengguna, jadi AudioContext
 * dibuat saat pertama kali dibutuhkan (setelah klik). */
(function (ns) {
  'use strict';

  var ctx = null, master = null, sfxBus = null, musicBus = null;
  var settings = ns.store.get('audio', { sound: true, music: true });
  var lastThink = 0, lastTick = 0;

  // Pentatonik C mayor dalam semitone dari C4
  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

  function hz(semi) { return 261.63 * Math.pow(2, semi / 12); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = settings.sound ? 0.8 : 0;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    return true;
  }

  // Satu nada pendek dengan envelope (attack cepat, decay eksponensial).
  function tone(freq, opts) {
    if (!settings.sound || !init()) return;
    opts = opts || {};
    var t = ctx.currentTime + (opts.delay || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t + (opts.dur || 0.15));
    var vol = opts.vol || 0.3, dur = opts.dur || 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(opts.bus || sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /* ---------- SFX ---------- */
  var sfx = {
    think: function (closeness) {
      var now = performance.now();
      if (now - lastThink < 45) return;          // maksimal ~22 nada per detik
      lastThink = now;
      var c = Math.max(0, Math.min(1, closeness));
      var semi = SCALE[Math.round(c * (SCALE.length - 1))];
      tone(hz(semi), { type: 'triangle', dur: 0.09, vol: 0.12 });
    },
    pop: function () { tone(520, { type: 'sine', dur: 0.12, vol: 0.35, slide: 880 }); },
    tick: function () {
      var now = performance.now();
      if (now - lastTick < 40) return;
      lastTick = now;
      tone(180, { type: 'square', dur: 0.03, vol: 0.05 });
    },
    found: function () {
      [0, 4, 7, 12].forEach(function (s, i) { tone(hz(s + 12), { type: 'triangle', dur: 0.25, vol: 0.25, delay: i * 0.07 }); });
    },
    delivered: function () {
      [7, 12, 16, 19, 24].forEach(function (s, i) { tone(hz(s + 12), { type: 'sine', dur: 0.35, vol: 0.28, delay: i * 0.09 }); });
      tone(hz(0), { type: 'triangle', dur: 0.6, vol: 0.2, delay: 0.36 });
    },
    fail: function () {
      [7, 3, 0, -5].forEach(function (s, i) { tone(hz(s), { type: 'sawtooth', dur: 0.28, vol: 0.09, delay: i * 0.14 }); });
    },
    reward: function () {
      [12, 16, 19, 24, 28].forEach(function (s, i) { tone(hz(s + 12), { type: 'sine', dur: 0.18, vol: 0.18, delay: i * 0.05 }); });
    },
    click: function () { tone(660, { type: 'sine', dur: 0.05, vol: 0.12 }); },
    // Bunyi printer struk: deretan klik cepat lalu "sobek".
    print: function () {
      for (var i = 0; i < 14; i++) tone(1400 + (i % 3) * 120, { type: 'square', dur: 0.02, vol: 0.04, delay: i * 0.055 });
      tone(300, { type: 'sawtooth', dur: 0.12, vol: 0.06, delay: 0.85, slide: 120 });
    }
  };

  /* ---------- Musik generatif ---------- */
  // Progresi I - V - vi - IV (C G Am F), arpeggio 8 ketuk per akor.
  var CHORDS = [[0, 4, 7, 12], [7, 11, 14, 19], [9, 12, 16, 21], [5, 9, 12, 17]];
  var BPM = 112, step = 0, nextTime = 0, timer = 0, playing = false;

  function scheduleNote(time) {
    var chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    var arp = chord[step % 4] + (step % 8 >= 4 ? 12 : 0);
    tone(hz(arp), { type: 'triangle', dur: 0.22, vol: 0.09, bus: musicBus, delay: time - ctx.currentTime });
    if (step % 8 === 0) {
      tone(hz(chord[0] - 24), { type: 'sine', dur: 1.6, vol: 0.22, bus: musicBus, delay: time - ctx.currentTime });
    }
    step++;
  }

  function scheduler() {
    var spb = 60 / BPM / 2;                          // seperdelapan ketuk
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleNote(nextTime);
      nextTime += spb;
    }
  }

  var music = {
    start: function () {
      if (!settings.sound || !settings.music || !init() || playing) return;
      playing = true;
      clearInterval(timer);
      step = 0;
      nextTime = ctx.currentTime + 0.05;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.6);
      timer = setInterval(scheduler, 25);
    },
    stop: function () {
      if (!playing) return;
      playing = false;
      var t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(function () { if (!playing) clearInterval(timer); }, 850);
    }
  };

  /* ---------- Pengaturan ---------- */
  function setSound(on) {
    settings.sound = on;
    ns.store.set('audio', settings);
    if (!on) music.stop();
    if (ctx) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.05);
  }

  function setMusic(on) {
    settings.music = on;
    ns.store.set('audio', settings);
    if (!on) music.stop();
  }

  ns.audio = {
    settings: settings,
    sfx: sfx,
    music: music,
    setSound: setSound,
    setMusic: setMusic,
    isPlaying: function () { return playing; }
  };
})(window.GoSel = window.GoSel || {});
