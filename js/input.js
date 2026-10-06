/* Input peta:
 *  - Pointer Events : gambar/hapus gedung, geser bidak yang sudah di peta.
 *  - HTML5 DnD      : seret bidak dari panel ke peta, atau seret file .json.
 *  - Keyboard       : panah memilih sel, Enter/Spasi gambar, K kurir, T tujuan.
 *  - Ketuk-ketuk    : fallback layar sentuh (ketuk bidak di panel, lalu ketuk sel). */
(function (ns) {
  'use strict';

  // Garis Bresenham: semua sel di antara dua titik, supaya goresan cepat tidak bolong.
  function lineCells(r0, c0, r1, c1) {
    var cells = [];
    var dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
    var sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
    var err = dc - dr;
    while (true) {
      cells.push({ r: r0, c: c0 });
      if (r0 === r1 && c0 === c1) break;
      var e2 = 2 * err;
      if (e2 > -dr) { err -= dr; c0 += sc; }
      if (e2 < dc) { err += dc; r0 += sr; }
    }
    return cells;
  }

  function Input(app) {
    this.app = app;
    this.canvas = app.renderer.base;
    this.stroke = null;     // { mode: 'paint'|'move', value, last, piece }
    this.armed = null;      // bidak yang dipilih lewat ketukan
    this.dragKind = null;   // bidak yang sedang diseret lewat DnD
    this.cursor = { r: 0, c: 0 };
    this.bindPointer();
    this.bindDnD();
    this.bindKeyboard();
  }

  var P = Input.prototype;

  /* ---------- Pointer: gambar & geser bidak ---------- */
  P.bindPointer = function () {
    var self = this, cv = this.canvas, app = this.app;

    cv.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || app.busy) return;
      var cell = app.renderer.cellAt(e.clientX, e.clientY);
      if (!cell) return;
      e.preventDefault();
      self.cursor = cell;

      // Mode ketuk-ketuk: bidak sudah dipilih, ketukan ini menaruhnya.
      if (self.armed) {
        app.placePiece(self.armed, cell.r, cell.c);
        self.setArmed(null);
        return;
      }

      var piece = app.grid.pieceAt(cell.r, cell.c);
      cv.setPointerCapture(e.pointerId);
      if (piece) {
        self.stroke = { mode: 'move', piece: piece };
        app.renderer.ov.dragging = piece;
        cv.classList.add('is-grabbing');
        self.showHover(cell, piece);
        return;
      }

      // Sel pertama menentukan mode: sel kosong -> gambar, sel terisi -> hapus.
      var tool = app.settings.tool;
      var current = app.grid.get(cell.r, cell.c);
      var value = (tool === 0 || current === tool) ? 0 : tool;
      self.stroke = { mode: 'paint', value: value, last: cell };
      app.beginEdit();
      app.paint(cell.r, cell.c, value);
    });

    cv.addEventListener('pointermove', function (e) {
      var cell = app.renderer.cellAt(e.clientX, e.clientY, !!self.stroke);
      var s = self.stroke;
      if (!s) {
        // Kursor kontekstual: tangan saat di atas bidak, crosshair saat menggambar.
        var onPiece = cell && app.grid.pieceAt(cell.r, cell.c);
        cv.classList.toggle('is-grab', !!onPiece && !self.armed);
        cv.classList.toggle('is-place', !!self.armed);
        return;
      }
      if (!cell) return;
      if (s.mode === 'move') {
        self.showHover(cell, s.piece);
      } else if (cell.r !== s.last.r || cell.c !== s.last.c) {
        lineCells(s.last.r, s.last.c, cell.r, cell.c).forEach(function (p) {
          app.paint(p.r, p.c, s.value);
        });
        s.last = cell;
      }
    });

    function end(e, cancelled) {
      var s = self.stroke;
      if (!s) return;
      self.stroke = null;
      cv.classList.remove('is-grabbing');
      app.renderer.ov.dragging = null;
      app.renderer.ov.hover = null;
      if (s.mode === 'move' && !cancelled) {
        var cell = app.renderer.cellAt(e.clientX, e.clientY);
        if (cell) app.placePiece(s.piece, cell.r, cell.c);
      } else if (s.mode === 'paint') {
        app.endEdit();
      }
    }

    cv.addEventListener('pointerup', function (e) { end(e, false); });
    cv.addEventListener('pointercancel', function (e) { end(e, true); });
    cv.addEventListener('lostpointercapture', function (e) { if (self.stroke) end(e, self.stroke.mode === 'move'); });
    cv.addEventListener('pointerleave', function () {
      if (!self.stroke) cv.classList.remove('is-grab');
    });
  };

  P.showHover = function (cell, kind) {
    var ok = this.app.canPlace(kind, cell.r, cell.c);
    this.app.renderer.ov.hover = { r: cell.r, c: cell.c, ok: ok, kind: kind };
  };

  /* ---------- HTML5 Drag and Drop ---------- */
  P.bindDnD = function () {
    var self = this, cv = this.canvas, app = this.app;
    var stage = document.getElementById('stage');
    var pieces = document.querySelectorAll('.piece[data-piece]');

    pieces.forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        var kind = el.dataset.piece;
        self.dragKind = kind;
        e.dataTransfer.setData('text/plain', 'go-sel:' + kind);  // wajib untuk Firefox/Safari
        e.dataTransfer.effectAllowed = 'move';
        var icon = el.querySelector('.piece__icon');
        if (icon && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(icon, 18, 18);
        el.classList.add('is-dragging');
        self.setArmed(null);
      });
      el.addEventListener('dragend', function () {
        self.dragKind = null;
        el.classList.remove('is-dragging');
        stage.classList.remove('is-dragover');
        app.renderer.ov.hover = null;
      });
      // Klik / Enter = mode ketuk-ketuk (fallback sentuh & keyboard)
      el.addEventListener('click', function () {
        self.setArmed(self.armed === el.dataset.piece ? null : el.dataset.piece);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          self.setArmed(self.armed === el.dataset.piece ? null : el.dataset.piece);
          if (self.armed) cv.focus();
        }
      });
    });

    function isFile(e) {
      return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1;
    }

    cv.addEventListener('dragover', function (e) {
      if (!self.dragKind && !isFile(e)) return;
      e.preventDefault();   // tanpa ini drop tidak akan terjadi
      e.dataTransfer.dropEffect = isFile(e) ? 'copy' : 'move';
      stage.classList.add('is-dragover');
      if (self.dragKind) {
        var cell = app.renderer.cellAt(e.clientX, e.clientY);
        if (cell) self.showHover(cell, self.dragKind);
        else app.renderer.ov.hover = null;
      }
    });

    cv.addEventListener('dragleave', function () {
      stage.classList.remove('is-dragover');
      app.renderer.ov.hover = null;
    });

    cv.addEventListener('drop', function (e) {
      e.preventDefault();
      stage.classList.remove('is-dragover');
      app.renderer.ov.hover = null;
      if (isFile(e) && e.dataTransfer.files.length) {
        app.importFile(e.dataTransfer.files[0]);
        return;
      }
      var data = e.dataTransfer.getData('text/plain') || '';
      var kind = data.indexOf('go-sel:') === 0 ? data.slice(7) : self.dragKind;
      var cell = app.renderer.cellAt(e.clientX, e.clientY);
      if ((kind === 'start' || kind === 'goal') && cell) app.placePiece(kind, cell.r, cell.c);
      self.dragKind = null;
    });

    // Cegah browser membuka file json yang dijatuhkan di luar peta.
    window.addEventListener('dragover', function (e) { if (isFile(e)) e.preventDefault(); });
    window.addEventListener('drop', function (e) { if (isFile(e)) e.preventDefault(); });
  };

  P.setArmed = function (kind) {
    this.armed = kind;
    document.querySelectorAll('.piece[data-piece]').forEach(function (el) {
      el.setAttribute('aria-pressed', String(el.dataset.piece === kind));
    });
    this.canvas.classList.toggle('is-place', !!kind);
    if (kind) {
      var label = kind === 'start' ? 'Kurir' : 'Alamat tujuan';
      this.app.ui.toast('Ketuk sel di peta untuk menaruh ' + label + '.', 'info');
    }
  };

  /* ---------- Keyboard di canvas ---------- */
  P.bindKeyboard = function () {
    var self = this, cv = this.canvas, app = this.app;
    var live = document.getElementById('cursor-live');

    cv.addEventListener('focus', function () {
      var g = app.grid;
      self.cursor.r = Math.min(self.cursor.r, g.rows - 1);
      self.cursor.c = Math.min(self.cursor.c, g.cols - 1);
      app.renderer.ov.cursor = self.cursor;
    });
    cv.addEventListener('blur', function () { app.renderer.ov.cursor = null; });

    cv.addEventListener('keydown', function (e) {
      if (app.busy) return;
      var g = app.grid, cur = self.cursor, key = e.key;
      var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[key]) {
        e.preventDefault();
        cur.r = Math.max(0, Math.min(g.rows - 1, cur.r + moves[key][0]));
        cur.c = Math.max(0, Math.min(g.cols - 1, cur.c + moves[key][1]));
        app.renderer.ov.cursor = cur;
        var what = g.pieceAt(cur.r, cur.c) || ['kosong', 'gedung', 'macet'][g.get(cur.r, cur.c)];
        live.textContent = 'Baris ' + (cur.r + 1) + ', kolom ' + (cur.c + 1) + ': ' +
          (what === 'start' ? 'kurir' : what === 'goal' ? 'tujuan' : what);
        return;
      }
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (self.armed) { app.placePiece(self.armed, cur.r, cur.c); self.setArmed(null); return; }
        if (g.pieceAt(cur.r, cur.c)) return;
        var tool = app.settings.tool, now = g.get(cur.r, cur.c);
        app.beginEdit();
        app.paint(cur.r, cur.c, (tool === 0 || now === tool) ? 0 : tool);
        app.endEdit();
        return;
      }
      if (key === 'k' || key === 'K') { e.stopPropagation(); app.placePiece('start', cur.r, cur.c); }
      if (key === 't' || key === 'T') { e.stopPropagation(); app.placePiece('goal', cur.r, cur.c); }
      if (key === 'Escape') self.setArmed(null);
    });
  };

  Input.lineCells = lineCells;
  ns.Input = Input;
})(window.GoSel = window.GoSel || {});
