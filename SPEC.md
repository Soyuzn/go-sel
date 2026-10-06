# Go-Sel: Virtual Lab Pathfinding

> Spesifikasi proyek untuk dikerjakan di Claude Code. Taruh file ini di root repositori, lalu minta Claude Code membacanya dan mengerjakan per milestone (lihat bagian 13).

## 1. Konteks tugas

- Tugas TPB ITB, bobot 10%: media pembelajaran interaktif berupa virtual lab berbasis web.
- Topik: Berpikir Komputasional (algoritma pencarian jalur / pathfinding).
- Teknologi: HTML, CSS, JavaScript murni. Seluruhnya berjalan di browser (frontend only). Tanpa backend, tanpa framework, tanpa build step.
- Kriteria penilaian:
  1. Penggunaan fitur HTML5 secara optimal (semantic elements, canvas, drag and drop, dll).
  2. Kreativitas CSS (warna, tipografi, responsive layout).
  3. Kompleksitas JavaScript (interaktivitas efektif).
- Pengumpulan: link repositori source code dan screenshot lewat Google Drive, plus deskripsi singkat virtual lab.
- Referensi gaya: PhET, LabXchange, Labster (simulasi interaktif dengan panel kontrol dan penjelasan konsep).

### Pemetaan ke permintaan tugas (acuan pengecekan akhir)

| Permintaan tugas | Dipenuhi oleh | Bagian |
|---|---|---|
| Virtual lab / media pembelajaran interaktif berbasis web | Simulasi pathfinding dengan panel belajar dan perbandingan | 2, 6.8, 6.11 |
| Topik mata kuliah TPB | Berpikir Komputasional (algoritma pencarian jalur) | 1, 2 |
| HTML, CSS, JavaScript, sepenuhnya frontend | Vanilla, tanpa backend dan build step | 1, 4 |
| Kriteria 1: fitur HTML5 (semantic, canvas, drag-and-drop) | `header/main/section/aside/figure/footer`, `<canvas>`, Drag and Drop API, `<dialog>`, `<details>`, `<output>`, `<table>` | 5, 6.2, 9 |
| Kriteria 2: kreativitas CSS (warna, tipografi, responsive) | Tema hijau, Plus Jakarta Sans, dark mode, layout responsif 360px ke desktop, animasi | 3, 5, 10 |
| Kriteria 3: kompleksitas JavaScript | 5 algoritma, priority queue, animator, input pointer, state machine, benchmark, maze generator | 6, 7, 8 |
| Pengumpulan: link repo, screenshot, deskripsi singkat | README, deploy Pages, daftar screenshot, teks deskripsi siap pakai | 15 |

Fitur yang kamu minta: ubah ukuran grid (6.1), seret kurir dan tujuan (6.2), gambar tembok (6.3), pilih algoritma (6.4), visualisasi proses berpikir dan jalur (6.5), waktu komputasi dan metrik (6.7), toggle diagonal (6.4), slider kecepatan, reset, hapus gedung (6.6), maze acak (6.9), pesan tidak ada jalur (6.10).

## 2. Konsep

**Go-Sel** adalah virtual lab tempat pengguna menjadi pengatur rute kurir. Kurir harus mengantar paket ke alamat tujuan melewati kota berbentuk grid sel. Gedung atau jalan ditutup menjadi tembok. Pengguna memilih algoritma lalu melihat bagaimana algoritma itu "berpikir" mencari jalan.

Tagline: **"Antar lewat sel, lihat algoritmanya mikir."**

Tujuan pembelajaran:
1. Memahami cara kerja BFS, DFS, Dijkstra, A*, dan Greedy Best-First secara visual.
2. Membandingkan algoritma: apakah jalurnya optimal, berapa sel yang dikunjungi, berapa waktu komputasinya.
3. Memahami peran heuristik pada A* dan Greedy Best-First.
4. Melihat bagaimana bentuk rintangan memengaruhi perilaku tiap algoritma.

Istilah UI diseragamkan ke bahasa "sel": "Sel dikunjungi", "Panjang jalur (sel)", "Gedung", "Kurir", "Alamat tujuan".

## 3. Identitas visual

Tema hijau terinspirasi Gojek (hijau resmi `#00AA13`). **Jangan memakai logo atau aset asli Gojek.** Buat logo Go-Sel sendiri sebagai SVG (misalnya pin lokasi berbentuk sel/kotak, atau ikon motor sederhana).

### Palet (CSS custom properties)

| Token | Hex | Peran |
|---|---|---|
| `--gs-green-600` | `#00AA13` | warna utama, tombol utama, kurir |
| `--gs-green-700` | `#008C15` | hover, jalur akhir |
| `--gs-green-500` | `#43B02A` | aksen |
| `--gs-green-400` | `#6CC24A` | sel frontier (antrean) |
| `--gs-green-200` | `#BCE194` | sel sudah dikunjungi |
| `--gs-green-50` | `#EEF8EF` | latar halaman (pilihan sendiri) |
| `--gs-ink-900` | `#14201A` | teks utama dan gedung |
| `--gs-amber-500` | `#FFB400` | sel yang sedang diproses, highlight tujuan |
| `--gs-red-500` | `#F52713` | jalan ditutup/macet, pesan "tidak ada jalur" |

Dark mode: latar `#0E1512`, permukaan kartu `#16201B`, teks `#E8F3EA`, hijau tetap sebagai aksen. Ikuti `prefers-color-scheme` dan sediakan tombol toggle manual.

### Tipografi

- Utama: **Plus Jakarta Sans** (Google Fonts), fallback `system-ui, sans-serif`.
- Angka statistik: **JetBrains Mono** atau `ui-monospace`, supaya lebar angka stabil saat berubah.
- Ukuran fluid dengan `clamp()`.

### Gaya

- Kartu putih sudut membulat (16 sampai 24px) di atas latar hijau sangat muda, bayangan lembut.
- Tombol utama hijau tebal, tombol sekunder outline.
- Ikon: kurir (motor, SVG), alamat tujuan (pin), gedung (blok gelap dengan jendela kecil), jalan ditutup/macet (garis strip merah, opsional).
- Animasi halus: denyut (pulse) pada kurir dan tujuan, jalur "tergambar" bertahap, transisi warna sel.
- Hormati `prefers-reduced-motion`.

## 4. Struktur proyek

```
go-sel/
  index.html
  README.md
  SPEC.md
  tests.html                # uji logika algoritma (opsional tapi disarankan)
  css/
    tokens.css              # custom properties, tema terang dan gelap
    base.css                # reset, tipografi
    layout.css              # grid/flex, breakpoint
    components.css          # tombol, kartu, slider, tabel, chip
  js/
    main.js                 # inisialisasi dan wiring
    state.js                # state aplikasi + state machine
    grid.js                 # model grid
    renderer.js             # canvas
    input.js                # pointer events + HTML5 drag and drop
    animator.js             # pemutar langkah (requestAnimationFrame)
    stats.js                # metrik, tabel perbandingan, bar chart
    maze.js                 # generator maze/tembok acak
    ui.js                   # binding kontrol DOM
    algorithms/
      common.js             # PriorityQueue, neighbors, heuristik, rekonstruksi jalur
      bfs.js
      dfs.js
      dijkstra.js
      astar.js
      greedy.js
  assets/
    icons/                  # SVG
    screenshots/
```

Catatan penting: gunakan **classic script dengan namespace global** (`window.GoSel`), bukan ES modules, supaya `index.html` bisa dibuka langsung dengan klik dua kali (ES modules gagal di `file://`). Setiap file dibungkus IIFE: `(function (ns) { ... })(window.GoSel = window.GoSel || {});`. Urutan `<script defer>` di `index.html` harus mengikuti dependensi.

## 5. Layout halaman (semantic HTML)

```
<header>      logo SVG, nama Go-Sel, tagline, tombol "Tentang" (<dialog>), toggle tema
<main>
  <section id="lab">
    <figure>
      <canvas id="peta">
      <figcaption>  legenda warna
    </figure>
  </section>
  <aside id="kontrol">
    <fieldset> Ukuran peta
    <fieldset> Bidak (kurir dan alamat tujuan, draggable)
    <fieldset> Gambar rintangan
    <fieldset> Algoritma
    <fieldset> Kecepatan dan aksi
  </aside>
  <section id="hasil">         statistik (<dl>, <output>), pesan status (role="status")
  <section id="perbandingan">  <table> + canvas bar chart
  <section id="belajar">       <article> per algoritma, dengan <details>/<summary>
</main>
<footer>      kredit: Mishael Gilland, Sistem dan Teknologi Informasi ITB, [NIM], mata kuliah
```

Responsif (mobile first):
- Mobile: canvas di atas, kontrol dalam accordion di bawahnya, hasil di bawahnya lagi.
- Tablet: kontrol di bawah canvas dalam dua kolom.
- Desktop (di atas sekitar 1024px): canvas di kiri (lebih lebar), panel kontrol dan hasil di kanan.

## 6. Fitur fungsional

### 6.1 Ukuran grid
- Input jumlah baris dan kolom (`<input type="range">` atau `number`, dengan `<output>` yang menampilkan nilai). Minimum 5, maksimum 60 baris dan 100 kolom, default 20 x 30.
- Ukuran sel dihitung otomatis agar grid pas di kontainer (`ResizeObserver`), sel selalu persegi.
- Saat ukuran diubah: tembok yang masih muat dipertahankan, bidak yang keluar batas dipindah ke sel valid terdekat, hasil algoritma dihapus.

### 6.2 Bidak: drag and drop (HTML5 DnD API)
- Dua bidak di panel: **Kurir** (titik awal) dan **Alamat tujuan** (titik akhir), elemen `draggable="true"`.
- Seret ke canvas: `dragstart` (set `dataTransfer`), `dragover` pada canvas (`preventDefault`, tampilkan highlight sel di bawah kursor), `drop` (hitung sel dari `clientX/clientY`, tempatkan bidak).
- Bidak yang sudah ditaruh bisa dipindah dengan menyeretnya lagi dari canvas (gunakan pointer events untuk drag bidak yang sudah di canvas, atau seret dari panel).
- Validasi: tidak boleh di atas tembok (kalau di atas tembok, tembok dihapus atau drop ditolak dengan feedback), kurir dan tujuan tidak boleh di sel yang sama.
- **Fallback sentuh**: DnD HTML5 tidak andal di banyak browser mobile. Sediakan mode "ketuk bidak lalu ketuk sel" sebagai alternatif.

### 6.3 Menggambar rintangan
- Tekan dan tahan pointer di canvas lalu geser: sel yang dilewati terisi sebagai gedung.
- Aturan mode: sel pertama yang disentuh menentukan mode. Kalau sel itu kosong, mode gambar. Kalau sel itu tembok, mode hapus. Sediakan juga tombol alat "Gedung" dan "Penghapus" untuk perangkat sentuh.
- Gunakan **Pointer Events** (`pointerdown/move/up`, `setPointerCapture`) dan interpolasi garis (Bresenham) antar sampel pointer supaya tidak ada sel bolong saat kursor bergerak cepat.
- Tidak boleh menggambar di atas bidak.
- Cegah scroll halaman saat menggambar di perangkat sentuh (`touch-action: none` pada canvas).

### 6.4 Pilihan algoritma
- Lima algoritma: **BFS, DFS, Dijkstra, A\*, Greedy Best-First**, dipilih lewat radio group atau segmented control.
- Toggle **gerakan diagonal** (default mati). Kalau aktif, 8 arah dengan biaya diagonal akar 2. **Tanpa corner cutting**: gerakan diagonal ditolak jika salah satu dari dua sel ortogonal yang diapit adalah tembok.
- Heuristik untuk A* dan Greedy: Manhattan (4 arah) atau Octile (8 arah), otomatis mengikuti toggle diagonal.

### 6.5 Visualisasi proses "berpikir"
Warna sel (lihat legenda di `figcaption`):
- Sel masuk antrean (frontier / open set): `--gs-green-400`
- Sel sudah dikunjungi (closed set): `--gs-green-200`
- Sel yang sedang diproses saat ini: `--gs-amber-500`
- Jalur akhir: `--gs-green-700`, digambar tebal sel demi sel, lalu ikon kurir bergerak menyusuri jalur ("kurir mengantar")
- Gedung: `--gs-ink-900`

Opsional (nilai tambah): tampilkan nilai g/h/f kecil di dalam sel untuk A* dan Dijkstra saat ukuran sel cukup besar, dan tampilkan isi struktur data aktif (queue, stack, priority queue) di panel samping.

### 6.6 Kontrol animasi
- Tombol: **Jalankan**, **Jeda/Lanjut**, **Langkah** (satu langkah), **Selesaikan** (loncat ke akhir), **Ulangi visualisasi** (hapus hasil, tembok tetap), **Hapus gedung**, **Reset semua**.
- Slider kecepatan: memetakan ke jumlah langkah per frame (misalnya 1 sampai 500) atau jeda per langkah. Perubahan kecepatan berlaku langsung saat animasi berjalan.
- Tombol Jalankan nonaktif (dengan petunjuk teks) kalau bidak belum lengkap.

### 6.7 Metrik hasil
Setelah tiap eksekusi tampilkan:
- **Waktu komputasi (ms)** dengan 3 desimal. Diukur dengan `performance.now()` hanya pada komputasi murni (tanpa render dan tanpa perekaman event). Jalankan beberapa kali (misalnya 20 kali, ambil median) agar angka stabil di grid kecil.
- **Sel dikunjungi** (jumlah node yang di-expand).
- **Panjang jalur (sel)** dan **total biaya** (berbeda jika ada diagonal atau sel macet).
- **Jumlah langkah** animasi.
- **Status**: "Jalur ditemukan" atau "Tidak ada jalur".

### 6.8 Perbandingan algoritma
- Tombol **Bandingkan semua**: menjalankan kelima algoritma pada peta yang sama (tanpa animasi) dan mengisi tabel.
- Tabel `<table>` dengan `<caption>`, `<thead>`, `<tbody>`: algoritma, waktu (ms), sel dikunjungi, panjang jalur, total biaya, optimal atau tidak. Sorot hasil terbaik per kolom (waktu tercepat, jalur terpendek, sel dikunjungi paling sedikit).
- Hasil juga disimpan otomatis setiap kali satu algoritma dijalankan sendiri. Tabel dikosongkan jika peta atau pengaturan berubah (tandai "kedaluwarsa").
- Bar chart sederhana digambar di `<canvas>` kedua (tanpa library) untuk membandingkan sel dikunjungi dan waktu.

### 6.9 Generator peta
- **Maze acak**: recursive backtracker atau randomized Prim (pastikan kurir dan tujuan tetap di sel kosong dan tersambung).
- **Gedung acak**: slider kepadatan 0 sampai 40% (tidak menjamin ada jalur, bagus untuk menguji pesan "tidak ada jalur").
- Opsional: animasi pembuatan maze langkah demi langkah.

### 6.10 Pesan "tidak ada jalur"
- Banner dengan `role="status"` / `aria-live="polite"`, warna `--gs-red-500`: "Tidak ada jalur. Alamat tujuan terkurung gedung, kurir tidak bisa masuk."
- Animasi tetap memperlihatkan seluruh area yang berhasil dijelajahi algoritma sebelum berhenti.
- Statistik menampilkan waktu dan sel dikunjungi, panjang jalur diisi "tidak ada".

### 6.11 Panel belajar (wajib, karena tugasnya media pembelajaran)
- Satu `<article>` per algoritma di dalam `<details>`/`<summary>`, berisi: cara kerja dalam 2 sampai 3 kalimat, struktur data yang dipakai, kompleksitas waktu dan memori, menjamin jalur terpendek atau tidak, dan kapan cocok dipakai (misalnya A* untuk navigasi peta).
- Algoritma yang sedang dipilih otomatis terbuka dan disorot.
- Setelah eksekusi, tampilkan satu kalimat insight yang dihasilkan dari data, misalnya "A* mengunjungi 62% lebih sedikit sel daripada Dijkstra pada peta ini". Kalimat dibuat dari hasil perbandingan, bukan teks statis.
- Sertakan legenda warna yang selalu terlihat dan tombol "Cara pakai" (dialog) yang menjelaskan 4 langkah: atur peta, tempatkan kurir dan tujuan, gambar gedung, pilih algoritma lalu jalankan.

### 6.12 Fitur bonus (kerjakan setelah semua inti selesai)
- **Sel macet** (biaya 5): alat ketiga, ditampilkan dengan pola garis merah. Ini membuat BFS berbeda dari Dijkstra dan A*, sehingga analogi kurir di dunia nyata lebih kuat. BFS, DFS, dan Greedy mengabaikan biaya (jelaskan di panel belajar).
- Simpan dan muat peta lewat `localStorage` (dibungkus `try/catch`), ekspor dan impor peta sebagai file JSON.
- Pintasan keyboard: spasi (jalan/jeda), `S` (langkah), `R` (reset), `C` (hapus gedung).

## 7. Spesifikasi algoritma

| Algoritma | Struktur data | Urutan pilih node | Optimal? | Heuristik |
|---|---|---|---|---|
| BFS | Queue (FIFO) | Terdekat berdasarkan jumlah langkah | Ya, jika biaya seragam (4 arah) | Tidak |
| DFS | Stack (iteratif, bukan rekursi) | Terdalam dulu | Tidak | Tidak |
| Dijkstra | Priority queue (binary heap) | g terkecil | Ya | Tidak |
| A* | Priority queue (binary heap) | f = g + h terkecil | Ya, jika h admissible | Ya |
| Greedy Best-First | Priority queue (binary heap) | h terkecil | Tidak | Ya |

Aturan umum:
- Urutan tetangga **tetap dan deterministik**: atas, kanan, bawah, kiri, lalu (jika diagonal aktif) kanan-atas, kanan-bawah, kiri-bawah, kiri-atas. Ini membuat hasil bisa direproduksi dan mudah diuji.
- Biaya lurus = 1, diagonal = akar 2, sel macet (bonus) = 5.
- A*: tie-breaking dengan memilih h yang lebih kecil saat f sama. Gunakan lazy deletion atau decrease-key yang benar pada heap.
- BFS dengan diagonal tidak menjamin biaya Euclid terkecil (hanya langkah paling sedikit). Tampilkan catatan ini di panel belajar dan jangan menandai "optimal" secara keliru di tabel (hitung "optimal" dengan membandingkan total biaya terhadap Dijkstra).
- Rekonstruksi jalur lewat array `parent`.
- Semua algoritma harus aman untuk grid sampai 60 x 100 tanpa membekukan UI.

## 8. Arsitektur JavaScript

- **Model grid**: `Uint8Array(rows * cols)`, indeks `r * cols + c`. Nilai: 0 kosong, 1 gedung, 2 macet (bonus).
- **Antarmuka algoritma**: fungsi murni tanpa DOM.
  ```
  solve(grid, rows, cols, start, goal, { diagonal, record }) ->
    { found, path: Int32Array|null, cost, visitedCount, events: Int32Array|null }
  ```
  `events` adalah daftar kompak pasangan `[tipe, indeksSel]` dengan tipe: 1 = masuk frontier, 2 = sedang diproses, 3 = ditutup (selesai). Saat `record: false` (mode timing), tidak ada perekaman agar pengukuran adil.
- **Animator**: loop `requestAnimationFrame`. Setiap frame memutar N event sesuai kecepatan, mendukung play, pause, step, finish. Setelah event habis, animasikan jalur akhir dan pergerakan ikon kurir.
- **Renderer**: Canvas 2D. Skala dengan `devicePixelRatio` agar tajam di layar retina. Gambar bertahap saat animasi (hanya sel yang berubah), gambar ulang penuh saat resize atau perubahan besar. Lapisan: latar, sel status, gedung, garis grid, jalur, bidak.
- **Input**: pointer events untuk menggambar, HTML5 DnD untuk bidak, konversi koordinat piksel ke sel dengan memperhitungkan `getBoundingClientRect` dan skala canvas.
- **State machine**: `IDLE -> READY -> RUNNING <-> PAUSED -> DONE`. Edit peta saat RUNNING otomatis menghentikan animasi dan menghapus visualisasi.
- **Struktur data**: implementasikan `PriorityQueue` (binary min-heap) sendiri di `common.js`.

## 9. Checklist fitur HTML5

- Semantic elements: `header`, `nav` (jika ada), `main`, `section`, `aside`, `article`, `figure`, `figcaption`, `footer`.
- `<canvas>` untuk peta dan untuk bar chart perbandingan.
- **Drag and Drop API** untuk bidak (`draggable`, `dragstart`, `dragover`, `drop`, `dataTransfer`).
- `<dialog>` untuk "Tentang" dan petunjuk penggunaan.
- `<details>` / `<summary>` untuk penjelasan tiap algoritma.
- Form controls: `<input type="range">`, `<input type="number">`, `<input type="radio">`, `<input type="checkbox">`, `<fieldset>` + `<legend>`, `<output>`.
- `<table>` lengkap dengan `<caption>`, `<thead>`, `<tbody>`, `scope`.
- `<template>` untuk baris tabel atau kartu algoritma yang dibuat dari JS.
- `data-*` attributes, ARIA (`aria-live`, `aria-label`, `role="status"`), `<meta name="viewport">`, `<meta name="theme-color">` hijau.
- Web Storage (`localStorage`), `requestAnimationFrame`, `ResizeObserver`, Pointer Events.
- SVG inline untuk logo dan ikon.

## 10. Checklist kreativitas CSS

- Design tokens lewat custom properties, tema terang dan gelap.
- Layout dengan CSS Grid dan Flexbox, responsif dari 360px sampai desktop lebar, tanpa scroll horizontal.
- `clamp()` untuk tipografi dan jarak fluid, `aspect-ratio`, `gap`, `min()/max()`.
- Komponen kustom: slider berwarna hijau (`accent-color` atau styling `::-webkit-slider-thumb`), segmented control untuk algoritma, chip status, tombol dengan state hover/active/focus-visible/disabled.
- Animasi dan transisi: denyut bidak, transisi warna sel, jalur tergambar, kartu hasil muncul (fade/slide), semuanya dinonaktifkan atau dikurangi pada `prefers-reduced-motion`.
- Kontras warna memenuhi WCAG AA, state fokus terlihat jelas.
- Cursor kontekstual di canvas (crosshair saat menggambar, grab saat memindah bidak).
- Gaya cetak sederhana (`@media print`) agar screenshot atau cetak laporan rapi (opsional).

## 11. Aksesibilitas dan UX

- Semua kontrol bisa dioperasikan keyboard, urutan tab logis, label jelas.
- Perubahan status penting diumumkan lewat `aria-live`.
- Petunjuk singkat di atas canvas: "Seret kurir dan tujuan ke peta, lalu tekan dan geser untuk membuat gedung."
- Tooltip atau teks bantu pada kontrol yang tidak jelas.
- Keadaan kosong yang ramah: kalau belum ada bidak, tampilkan ajakan, bukan error.

## 12. Edge case yang harus ditangani

- Kurir dan tujuan belum ditempatkan: tombol Jalankan nonaktif dengan petunjuk.
- Kurir dan tujuan bersebelahan, atau sama sekali tidak ada sel di antara.
- Tujuan terkurung (tidak ada jalur) dan kurir terkurung.
- Resize grid saat ada tembok dan bidak.
- Mengubah pengaturan (diagonal, ukuran) saat animasi berjalan.
- Menekan Jalankan berulang kali atau saat animasi masih berjalan.
- Pointer keluar dari canvas saat menggambar (`pointercancel`, `pointerleave`).
- Layar dengan `devicePixelRatio` berbeda, zoom browser, rotasi layar mobile.
- Grid sangat besar: UI tetap responsif.
- `localStorage` tidak tersedia (mode privat): aplikasi tetap jalan.

## 13. Milestone untuk Claude Code

Kerjakan berurutan. Setelah tiap milestone, jalankan di browser (`python3 -m http.server 8000` lalu buka `http://localhost:8000`), cek tidak ada error di console, dan commit.

1. **Kerangka**: `index.html` semantik, token CSS, tema terang/gelap, layout responsif kosong, logo SVG, footer kredit.
2. **Grid dan canvas**: model grid, renderer, resize otomatis, input ukuran grid, menggambar dan menghapus gedung dengan pointer events.
3. **Bidak**: drag and drop kurir dan tujuan, validasi, fallback sentuh, tombol Hapus gedung dan Reset.
4. **Algoritma**: `PriorityQueue`, lima algoritma dengan antarmuka `solve`, toggle diagonal, `tests.html` untuk memverifikasi hasil.
5. **Animator dan visualisasi**: pemutaran event, jeda/langkah/selesaikan, slider kecepatan, animasi jalur dan pergerakan kurir, pesan "tidak ada jalur".
6. **Metrik dan perbandingan**: waktu (median beberapa kali), sel dikunjungi, panjang jalur, tabel perbandingan, bar chart canvas.
7. **Generator dan polish**: maze acak, gedung acak, panel belajar per algoritma, dialog "Tentang", animasi CSS, dark mode, aksesibilitas.
8. **Bonus** (jika waktu cukup): sel macet, simpan/muat peta, pintasan keyboard.
9. **Penutup**: README, screenshot, deploy ke GitHub Pages.

## 14. Pengujian

Skenario manual:
1. Peta kosong 20 x 30, semua algoritma menemukan jalur. BFS dan Dijkstra sama panjang pada 4 arah.
2. Maze acak, bandingkan DFS (jalur panjang berkelok) dengan A* (sel dikunjungi sedikit).
3. Kurung tujuan dengan gedung, semua algoritma menampilkan "Tidak ada jalur".
4. Aktifkan diagonal, pastikan jalur tidak menembus sudut dua gedung yang bersilangan.
5. Ubah ukuran grid saat ada gedung dan bidak.
6. Uji di lebar 360px dan di layar sentuh.

Otomatis di `tests.html` (assertion sederhana, tampil hijau/merah):
- Biaya BFS = biaya Dijkstra pada grid 4 arah tanpa bobot.
- Biaya A* = biaya Dijkstra.
- Kasus tanpa jalur mengembalikan `found: false` untuk kelima algoritma.
- Kasus start bersebelahan dengan goal.
- Tidak ada corner cutting pada mode diagonal.

## 15. Deliverables

### Repositori
- Kode lengkap dengan commit rapi.
- `README.md`: nama, deskripsi singkat, cara menjalankan (buka `index.html` atau `python3 -m http.server`), daftar fitur, penjelasan algoritma, struktur folder, kredit (nama, NIM, mata kuliah, dosen), link demo.
- Deploy: `git init`, buat repo di GitHub, push, lalu Settings > Pages > Deploy from branch (`main`, folder root). Pastikan tidak ada path absolut yang merusak di Pages.

### Screenshot (simpan di `assets/screenshots/` dan upload ke Google Drive)
1. Tampilan awal (desktop).
2. Peta dengan gedung dan bidak sudah ditempatkan.
3. Visualisasi mid-run untuk tiap algoritma (BFS, DFS, Dijkstra, A*, Greedy).
4. Hasil akhir dengan jalur dan statistik.
5. Pesan "Tidak ada jalur".
6. Tabel dan bar chart perbandingan.
7. Tampilan mobile.
8. Dark mode.

### Deskripsi singkat (siap dipakai, sesuaikan)

> **Go-Sel** adalah virtual lab berbasis web untuk mempelajari algoritma pencarian jalur (pathfinding) pada mata kuliah Berpikir Komputasional. Pengguna mengatur ukuran grid, menyeret ikon kurir dan alamat tujuan ke peta, menggambar gedung atau jalan tertutup sebagai rintangan, lalu memilih algoritma (BFS, DFS, Dijkstra, A*, atau Greedy Best-First). Proses "berpikir" algoritma divisualisasikan langkah demi langkah di atas canvas: sel yang masuk antrean, sel yang sudah dikunjungi, dan jalur akhir yang ditemukan. Setiap eksekusi menampilkan waktu komputasi (ms), jumlah sel dikunjungi, dan panjang jalur, sehingga pengguna dapat membandingkan efisiensi dan optimalitas tiap algoritma. Dibangun dengan HTML5 (semantic elements, canvas, Drag and Drop API, dialog), CSS3 (custom properties, grid/flexbox, responsive, dark mode), dan JavaScript murni tanpa library.

Link repositori: [isi setelah push]
Link demo: [isi setelah deploy]

## 16. Placeholder yang perlu diisi manual

- NIM dan nama dosen/kelas di footer dan README.
- Nama mata kuliah persis seperti di silabus (misalnya "Berpikir Komputasional").
- Link repo dan link demo setelah dipublikasikan.
