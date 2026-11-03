# Temu — Undangan Pernikahan Digital

Aplikasi full-stack berbahasa Indonesia untuk membuat undangan pernikahan. Backend **Node.js 24 + Express**, database **SQLite** untuk lokal atau **PostgreSQL** untuk hosting, pemrosesan foto **Sharp**, antarmuka HTML/CSS/JavaScript tanpa build. Aplikasi ini berdiri sendiri dalam repository `satusatukansaja11-spec/temu-undangan`, terpisah dari proyek monitoring keagamaan siswa.

## Menjalankan

```sh
git clone https://github.com/satusatukansaja11-spec/temu-undangan.git
cd temu-undangan
npm ci
cp .env.example .env
npm start
```

Buka `http://localhost:3000`. Node.js **24 atau lebih baru** diperlukan. `npm run dev` menjalankan mode watch. Tidak ada build frontend. Port dan URL publik ditentukan oleh `PORT` dan `APP_URL`. Pilih **Login → Buat Akun Baru** untuk mendaftar dengan nama, email dan password. Gunakan `DEMO_LOGIN=false` (default) untuk akun pribadi. Mode demo opsional hanya untuk pengujian lokal dan selalu dinonaktifkan saat `NODE_ENV=production`.

## Daftar dan masuk dengan akun pribadi

1. Jalankan aplikasi, buka `http://localhost:3000`, lalu pilih **Login → Buat Akun Baru**.
2. Isi nama, email, dan password 12–128 karakter. Setelah mendaftar, pengguna masuk ke dashboard pribadi.
3. Untuk masuk kembali, gunakan email dan password yang sama. Setiap pengguna hanya dapat mengelola undangannya sendiri.
4. Akun dan password yang sudah di-hash disimpan di SQLite pada `DATA_DIR`. Data tetap tersedia setelah aplikasi dimulai ulang selama direktori ini dipertahankan.

Tidak diperlukan konfigurasi Google OAuth. Tombol, endpoint dan konfigurasi login Google sudah dihapus. Jika `.env` lokal lama masih memuat `GOOGLE_CLIENT_ID` atau `GOOGLE_CLIENT_SECRET`, hapus kedua baris tersebut; aplikasi tidak lagi membacanya. Gunakan `DEMO_LOGIN=false` agar pengguna mendaftar akun pribadi, bukan menggunakan akun demo bersama.

Data pengguna dan undangan lama tidak dihapus. Akun provider tidak ditautkan otomatis ke akun email baru demi menjaga kepemilikan data. Jika sebelumnya pernah memakai login Google, sesi yang sudah aktif tetap mengikuti masa berlaku, tetapi login Google baru tidak tersedia; pemindahan kepemilikan akun lama memerlukan proses terverifikasi terpisah.

## Penyimpanan dan deployment mandiri

`DATA_DIR` (default `./data`) berisi `app.sqlite` dan `uploads/`. Migrasi SQL versioned dijalankan dengan `npm run db:migrate` (otomatis pada localhost jika `AUTO_MIGRATE=true`). Mode lokal tidak memerlukan akun database. Mode PostgreSQL memakai `DATABASE_URL`. Gunakan direktori/volume **persisten**, writable hanya oleh pengguna server. Simpan database dan uploads bersama dalam backup; gunakan SQLite backup API atau hentikan server sebelum menyalin database beserta WAL. Jangan menyajikan direktori data dengan static server.

Untuk hosting: Node 24, `npm ci`, `APP_URL=https://domain-anda`, `NODE_ENV=production`, `DEMO_LOGIN=false`, persistent volume `DATA_DIR`, reverse proxy HTTPS menuju port aplikasi. Mode SQLite menggunakan satu instance. Deployment multi-instance dapat memakai PostgreSQL dan S3-compatible storage yang kini didukung. Pasang rate limit dan batas request yang mencukupi audio (contoh 40 MB) pada reverse proxy untuk endpoint login/upload. Aplikasi membatasi tiap foto 10 MB secara default, galeri 200 foto, total 1.000 file foto per acara dan kuota media 2 GB secara default; semuanya dapat dikonfigurasi.

Aplikasi **belum diterbitkan ke internet**. Proyek ini adalah aplikasi Node.js mandiri dan memerlukan hosting yang mendukung proses Node.js serta volume penyimpanan persisten; GitHub Pages tidak menjalankan backend aplikasi ini. Link `/u/:slug` menjadi dapat diakses tamu setelah aplikasi di-host di domain publik. Pada localhost, tautan hanya berguna di mesin yang menjalankan server.

## Fitur dan alur

- Daftar dan login email/password, identitas dasar tersimpan, sesi 7 hari, keluar akun.
- Dashboard milik pengguna, pencarian, filter status, tampilan kosong, tambah/edit/pratinjau/hapus dengan konfirmasi.
- Formulir sembilan bagian: info dan tampilan, kedua mempelai, tanggal/waktu/lokasi, galeri, ucapan, love story, susunan acara tambahan, wedding gift, serta pengaturan/rekap RSVP.
- Wajib publikasi: nama acara; foto sampul, pria dan wanita; nama lengkap dan panggilan kedua mempelai; agama; tanggal; waktu mulai dan selesai; alamat; Maps HTTPS; pembuka dan penutup.
- Draft parsial dapat disimpan ke database. Seluruh isian valid dan lengkap membuat status **Siap Dibagikan**. Mengosongkan data wajib mengembalikan draft dan mencabut akses publik.
- Upload foto dengan pratinjau, multiple upload galeri, hapus dari susunan, pindah kiri/kanan. Foto diunggah langsung ke server; perubahan susunan/isian baru tersimpan setelah menekan **Simpan**. File yang gagal tidak dimasukkan, file berhasil tetap ada jika file berikutnya gagal. Upload sementara yang tidak dipakai tetap private sampai acara dihapus. Batas unggahan 1.000 foto secara default mencakup foto belum dipakai.
- Validasi browser serta decoding isi gambar di backend. Hanya JPEG, PNG, WebP; maksimal 10 MB secara default dan 40 megapiksel; metadata dibuang, dirotasi dan diubah menjadi WebP maksimal 2000×2000. SVG/HTML/gambar rusak ditolak.
- Salam sesuai pilihan agama; template baru diterapkan dengan tindakan pengguna. Perubahan agama tidak menimpa teks buatan pengguna.
- URL unik acak per acara, halaman publik tanpa identitas akun/ID internal, draft dan URL tak ditemukan ditangani.
- Musik `None`, lagu unggahan pribadi, atau **Melodi Temu**, instrumental sintetis orisinal yang dibuat aplikasi tanpa lisensi/layanan eksternal. Kontrol putar/jeda, tanpa autoplay; `None` tidak membuat elemen audio. Lagu pribadi diunggah lewat editor, kemudian dipilih dan disimpan sebelum dibagikan.
- Sebar membuka dialog pesan yang bisa diedit; tautan WhatsApp terisi teks dan URL. Pengguna sendiri membuka WhatsApp dan mengirim. Aplikasi tidak mengirim pesan otomatis.

Versi ini mengelola satu jadwal utama dan maksimal delapan rangkaian tambahan per pernikahan. `end` harus sesudah `start` pada tanggal sama; acara lintas tengah malam belum didukung. Pilih WIB/WITA/WIT untuk countdown dan kalender. Jenis acara lain, pembayaran, AI eksternal dan pengiriman WhatsApp otomatis tidak dibuat.

## Struktur penting

- `server.js`: schema, sesi, CSRF, otorisasi, API CRUD, upload dan halaman publik.
- `public/index.html`: shell halaman dan dialog aksesibel.
- `public/app.js`: dashboard, formulir, pratinjau, halaman undangan dan WhatsApp.
- `public/style.css`: desain sage/ivory, layout desktop/mobile dan reduced motion.
- `test/app.test.js`: pengujian integrasi backend dan keamanan dua akun.
- `.env.example`: daftar konfigurasi tanpa secret.
- `package-lock.json`: versi dependency terkunci.

Tabel `events` berelasi dengan `users`; `photos` berelasi dengan acara dengan cascade delete. Pasangan, jadwal, ucapan dan urutan galeri adalah dokumen JSON tervalidasi pada record acara agar penyimpanan perubahan undangan atomik. File gambar disimpan sebagai berkas, bukan base64 database. Model saat ini hanya pernikahan; tipe acara mendatang dapat ditambahkan melalui kolom jenis dan validator terpisah, tanpa mengekspos fitur acara lain sekarang.

## Pengujian

```sh
npm test
```

Pengujian menggunakan database dan direktori sementara, tanpa kredensial provider eksternal. Memeriksa akses anonim, CSRF/origin, pemilik palsu, akses silang dua pengguna (baca/ubah/hapus/upload), draft tersembunyi, foto palsu dan terlalu besar, rollback logis saat validasi gagal, URL foto tidak sah, publikasi lengkap, pencabutan publikasi, respons halaman/audio dan penghapusan relasi/file.

Alur manual:

1. Pilih Login → Buat Akun Baru, daftar dengan email/password, lalu buat acara.
2. Isi nama saja, Simpan; muat ulang, pastikan draft tetap tersimpan. Coba URL `/u/<slug>` dari browser tanpa sesi: harus ditolak.
3. Isi seluruh bagian wajib, upload foto, tambah/urutkan/hapus galeri, pilih agama, terapkan/edit salam, pilih musik, Simpan.
4. Buka Pratinjau, kembali dashboard, klik Sebar, ubah pesan; buka URL undangan pada browser privat. Foto dan Maps tampil, musik diam sebelum tombol putar ditekan.
5. Pilih None lalu Simpan: pemutar tidak ditampilkan.
6. Kosongkan data wajib, Simpan: link publik tidak lagi tersedia. Hapus acara dengan konfirmasi.
7. Daftar dan masuk dengan akun email kedua: daftar acara akun pertama tidak terlihat, endpoint milik akun pertama ditolak.
8. Periksa desktop, tablet dan layar ponsel, serta navigasi keyboard.

Hasil pengujian otomatis dan browser selama pengerjaan dirangkum dalam `VALIDATION.md`. Pendaftaran email tidak memerlukan konfigurasi provider eksternal.

## Halaman awal dan akun (pembaruan 24 Oktober 2026)

Halaman `/` kini merupakan beranda publik. Menu: **Beranda, Tema, Fitur, Harga, Download, Layar Tamu, Login**. Menu section memakai anchor; Login menuju `/login`, Buat Akun Baru menuju `/daftar`, dan dashboard ada di `/dashboard`. Identitas Temu dipertahankan, dengan tampilan publik putih/magenta dan kartu login mengikuti referensi pengguna. Dashboard dan undangan yang sudah ada tetap tersedia.

- Tema menampilkan contoh **Temu Klasik**, tema undangan yang saat ini tersedia. Contoh memakai data ilustrasi, bukan acara pelanggan.
- Harga belum ditentukan; halaman menjelaskan bahwa paket belum diumumkan, tanpa pembayaran atau checkout.
- Download mengunduh ZIP kode aplikasi dari repository GitHub. Ini bukan aplikasi Android/iOS.
- Layar Tamu (`/layar-tamu`) menampilkan nama yang diketik petugas dan dapat dibuka layar penuh. Nama hanya berada dalam memori halaman perangkat, tanpa database tamu, RSVP atau sinkronisasi.
- Form login email, toggle tampil/sembunyikan password, Apple, dan tautan pendaftaran akun.
- Pendaftaran email menggunakan nama, email, password 12–128 karakter. Password menggunakan scrypt asinkron dengan salt acak per akun. Tabel `credentials` dan `auth_limits` ditambahkan secara idempoten pada database yang sama. Password tidak disimpan sebagai plaintext.
- Pembatasan login/daftar: 10 percobaan per email dan 30 per alamat socket IP dalam 15 menit; pasang juga rate limit di reverse proxy. Semua pengguna di belakang reverse proxy dapat berbagi alamat socket IP yang sama; pertimbangkan konfigurasi pembatasan ingress untuk deployment Anda.
- Email/password dan akun Apple tidak ditautkan otomatis berdasarkan email. Menggunakan metode berbeda dapat menghasilkan akun terpisah. Gunakan metode login yang sama untuk mengakses undangan sebelumnya.
- Pendaftaran email belum memverifikasi kepemilikan alamat email melalui email konfirmasi. Pemulihan password melalui email belum tersedia; tombol Lupa password menjelaskan batasan ini. Jangan mengasumsikan email dari pendaftaran lokal sudah terverifikasi.

### Mengaktifkan Masuk dengan Apple

Tombol sudah terhubung ke endpoint OAuth backend. Untuk login nyata diperlukan keanggotaan dan konfigurasi **Apple Developer**, serta domain HTTPS; Apple tidak menerima localhost sebagai return URL web.

1. Siapkan primary App ID dengan capability **Sign in with Apple**, lalu buat **Services ID** untuk website dan kaitkan dengan primary App ID.
2. Dalam konfigurasi web Sign in with Apple, daftarkan domain aplikasi dan return URL persis `https://domain-anda/auth/apple/callback`.
3. Buat key Sign in with Apple dan simpan berkas `.p8` secara aman. Isi di server: `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, dan `APPLE_PRIVATE_KEY` (isi private key PEM, mendukung karakter literal `\n` sebagai pemisah baris). Jangan mengunggah `.p8` atau nilai key ke GitHub.
4. Isi `APP_URL=https://domain-anda` tanpa slash akhir, mulai ulang server, lalu uji dari `/login`.

Backend membuat client secret ES256 berumur singkat, menukar authorization code, serta memverifikasi signature RS256 terhadap JWKS Apple, issuer, audience, masa berlaku, nonce dan email terverifikasi. State sekali pakai diikat pada cookie HttpOnly Secure SameSite=None untuk callback `form_post`. Dibutuhkan akses keluar server ke `https://appleid.apple.com`. Apple yang belum dikonfigurasi kembali ke halaman login dengan penjelasan; tidak ada login provider palsu.

File tambahan: `auth.js` (akun email dan Apple), `public/website.js` (beranda/login/daftar/layar tamu), `test/auth.test.js` (akun email dan verifikasi token Apple).

### Pratinjau tampilan

Beranda publik:

![Beranda Temu](docs/images/beranda.png)

Halaman login pada ponsel:

![Login Temu](docs/images/login.png)


## Undangan lengkap dan tampilan HP — 3 November 2026

Halaman publik `/u/:slug` kini memiliki cover, **countdown + Save the Date**, profil masing-masing mempelai, **love story**, **susunan acara**, **Maps**, **photo gallery**, **wedding gift**, dan **RSVP**. Navigasi tetap di bawah layar, target sentuh sekitar 44 px, form 16 px untuk menghindari zoom otomatis di HP, gambar galeri lazy-loaded, serta kontrol musik tidak menutup navigasi. Animasi menghormati reduced motion; musik tetap tanpa autoplay.

### Pengisian dari dashboard

1. **Waktu & tempat**: pilih zona waktu acara (WIB/Jakarta, WITA/Makassar, WIT/Jayapura). Countdown dan kalender mengikuti zona tersebut, bukan zona browser tamu. Acara lama tanpa pilihan memakai WIB; sesuaikan jika lokasinya WITA/WIT.
2. **Love story**: maksimal 12 cerita dengan judul, tanggal opsional dan narasi. Teks seluruhnya dari pemilik acara; tidak ada kisah pribadi buatan otomatis.
3. **Susunan acara**: jadwal utama tetap dari Waktu & tempat. Tambahkan maksimal 8 rangkaian dengan nama, tanggal, waktu, lokasi dan link HTTPS Maps. Seluruh rangkaian memakai zona waktu acara yang dipilih.
4. **Wedding gift**: maksimal 3 rekening/e-wallet (nama bank, nomor, nama penerima) dan alamat pengiriman opsional. Informasi ini **ditampilkan kepada publik** jika diisi. Nomor dapat disalin dengan tombol; fallback memilih teks jika clipboard browser tidak tersedia. Tidak ada pembayaran, transfer otomatis, validasi rekening bank, atau penyimpanan data kartu.
5. **RSVP**: aktifkan/nonaktifkan formulir dan lihat rekap privat (hadir, tidak hadir, belum pasti, jumlah orang). Rekap memiliki paginasi 20 respons per halaman dan tombol muat ulang.
6. Simpan perubahan. Bagian tambahan bersifat opsional; jika menambahkan baris cerita/rangkaian/rekening yang belum lengkap, draft tetap bisa disimpan tetapi undangan belum siap dibagikan sampai baris dilengkapi atau dihapus. Bagian love story, galeri atau gift yang kosong tidak ditampilkan ke publik.

**Save the Date** mengunduh `.ics` untuk jadwal utama, dengan waktu UTC hasil konversi zona acara. Pengguna membuka/mengimpor berkas tersebut ke aplikasi kalender; aplikasi tidak menulis langsung ke akun kalender dan tidak memerlukan kredensial Google. Teks kalender di-escape dan baris panjang dilipat sesuai batas UTF-8. Kalender draft hanya tersedia bagi pemilik melalui pratinjau.

### RSVP, privasi dan penyimpanan

- Respons tersimpan di tabel SQLite baru `rsvps`, berelasi ke acara dengan cascade delete. `rsvp_limits` menyimpan pembatasan pengiriman. Schema ditambah secara idempoten; tabel/data acara lama tidak dihapus. Backup `DATA_DIR` sebelum memperbarui deployment yang memiliki data nyata.
- Tamu mengisi nama, kehadiran, jumlah tamu (1–10 termasuk dirinya jika hadir; 0 untuk tidak hadir/belum pasti) serta ucapan opsional. Tidak memerlukan akun tamu.
- Nama, ucapan dan rekap tidak diterbitkan dalam API data undangan; hanya pemilik terautentikasi dapat membaca daftar. API tamu hanya membaca responsnya sendiri dengan cookie rahasia HttpOnly, SameSite=Lax, Secure pada HTTPS; yang disimpan di database adalah hash token.
- Pada browser yang sama selama cookie masih tersedia (maksimal 180 hari), pengiriman berikutnya memperbarui respons. Cookie hilang, browser lain, atau perangkat lain dapat menghasilkan respons tambahan. Ini konfirmasi tamu anonim, **bukan verifikasi identitas/undangan individual**.
- Penulisan memeriksa Origin dan membatasi 60 pengiriman valid per IP socket per acara per jam, maksimal 10.000 respons per acara. Tambahkan proteksi ingress/anti-spam sesuai kebutuhan hosting; beberapa tamu di jaringan/proxy yang sama dapat berbagi pembatasan IP.
- Draft/tidak ditemukan menolak RSVP dan file kalender publik. RSVP yang dimatikan menolak pengiriman. Form di halaman pratinjau tidak mengirim data. Tidak ada email/WhatsApp otomatis saat RSVP.
- Cerita, rangkaian, gift, zona waktu dan pengaturan RSVP disimpan bersama dokumen acara tervalidasi; foto tetap berupa file di uploads.

File tambahan: `wedding.js` (validasi, kalender dan API RSVP), `public/wedding.js` (editor tambahan, undangan, countdown, galeri dan RSVP), `test/wedding.test.js` (integrasi dan keamanan).

### Pengujian alur baru

Jalankan `npm test`. Dari dashboard, lengkapi undangan, isi contoh cerita/rangkaian/gift, lalu simpan. Buka URL publik di browser tanpa login, unduh kalender, perbesar galeri, salin nomor dan kirim RSVP. Muat ulang dan ubah kehadiran: respons yang sama diperbarui. Kembali ke pemilik, buka tab RSVP untuk melihat rekap. Coba dari akun pemilik lain: akses rekap harus ditolak. Nonaktifkan RSVP atau ubah undangan menjadi draft dan pastikan akses publik ditolak sesuai status.

Pratinjau undangan (seluruh konten adalah data ilustrasi pengujian):

- [Tampilan HP](docs/images/undangan-mobile.png)
- [Tampilan desktop](docs/images/undangan-desktop.png)


## PostgreSQL, unggah lagu dan kapasitas foto — 3 November 2026

- **SQL hosting:** PostgreSQL dengan connection pool, migrasi SQL dan alat impor dari SQLite. Mode SQLite lokal tetap tersedia; akun/hash password/ID undangan dapat dipindahkan tanpa membuat ulang akun.
- **Penyimpanan:** disk lokal persisten atau bucket S3-compatible privat. Media tetap file, bukan base64 database. Akses publik hanya untuk media terpilih pada undangan siap dibagikan.
- **Musik pribadi:** unggah MP3/M4A/OGG/WAV maksimal 30 MB/30 menit, pilih lagu, Simpan. Musik tetap membutuhkan tindakan putar dari tamu. Audio mendukung streaming/seek.
- **Foto banyak:** default 200 foto galeri, 1.000 unggahan per acara, 10 MB/foto dan total media 2 GB/acara, semuanya dapat dikonfigurasi. Pustaka dapat memakai ulang dan menghapus file yang tidak dipakai.
- **Hosting:** Dockerfile, Docker Compose PostgreSQL, healthcheck, contoh reverse proxy dan panduan HTTPS. Dukungan hosting sudah disiapkan; ini bukan konfirmasi website sudah terbit.

Baca [panduan hosting dan pemindahan data](docs/DEPLOYMENT.md) sebelum mengubah database atau penyimpanan. File SQL tersedia di [migrasi PostgreSQL](db/migrations/postgres) dan [migrasi SQLite](db/migrations/sqlite).

Lokal:

```sh
npm ci
npm run db:migrate
npm start
```

Untuk PostgreSQL, isi `DATABASE_URL` di `.env`, jalankan `npm run db:migrate`, lalu `npm start`. Untuk S3, buat bucket privat dan isi konfigurasi server sesuai panduan. Jangan menghapus data lokal lama sebelum hasil pemindahan diverifikasi.

[Pratinjau pustaka lagu di HP](docs/images/media-mobile.png) menggunakan data sintetis pengujian.

## Menu Sebar dan penerima personal

Klik **Sebar** pada undangan yang sudah siap dibagikan. Halaman menampilkan sampul, nama acara, pilihan template Universal/Formal/Custom dan template sesuai agama acara. Pesan dapat diedit menggunakan `{nama}`, `{acara}` dan `{link}`, lalu disimpan ke database.

Tambahkan nama penerima satu per satu atau import JSON berupa array nama (contoh `["Ummi Mahmud", "Bapak Arif & keluarga"]`, maksimal 500 nama per import, 200 KB/file, 1.000 penerima per acara). Export menghasilkan JSON nama. Nama dan pesan hanya dapat dikelola pemilik acara; penghapusan acara ikut menghapusnya melalui foreign key.

Setiap penerima mendapat tautan `/u/:slug?to=...` yang menampilkan sapaan pada sampul. Nama di URL adalah personalisasi, bukan identitas terverifikasi atau kode akses RSVP. URL dapat diedit/dibagikan ulang. Jangan memasukkan informasi rahasia ke nama penerima.

Tombol **Salin pesan**, **Kirim WA** dan **Bagikan tautan** tersedia per nama. Kirim WA membuka dialog pratinjau editable, lalu tautan berbagi WhatsApp. Pengguna memilih tujuan dan menekan Kirim di WhatsApp sendiri; aplikasi tidak mengirim otomatis/massal, tidak memilih nomor kontak dan tidak mengklaim pesan sudah terkirim. Browser tanpa Web Share memakai clipboard; bila clipboard ditolak, salin manual dari pratinjau.

SQL baru: `003_sharing.sql` untuk SQLite/PostgreSQL. Untuk server dengan `AUTO_MIGRATE=false`, jalankan `npm run db:migrate` sebelum memulai versi baru. Impor SQLite juga mencakup daftar penerima dan pengaturan pesan.
