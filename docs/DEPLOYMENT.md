# Hosting, PostgreSQL, lagu dan penyimpanan foto

Temu membutuhkan **Node.js 24+**. Aplikasi tidak berjalan sepenuhnya di GitHub Pages atau hosting yang hanya menyediakan PHP/static. Perubahan ini menyiapkan dukungan hosting; tidak membuat akun hosting, database, bucket, domain atau sertifikat atas nama Anda.

## 1. Pilih susunan layanan

| Kebutuhan | Konfigurasi |
|---|---|
| Laptop / localhost | SQLite + file lokal; tidak perlu akun database/cloud |
| Satu VPS | PostgreSQL + volume media lokal persisten + reverse proxy HTTPS |
| Hosting Node dengan disk sementara / beberapa instance | PostgreSQL + bucket S3-compatible privat; direktori lokal hanya untuk file upload sementara |

File foto dan lagu **bukan base64 di database**. PostgreSQL menyimpan akun, hash password, acara, kepemilikan, metadata foto/lagu, RSVP dan sesi. File berada di disk persisten atau bucket. Besarnya penyimpanan sungguhan mengikuti disk/bucket yang Anda sewa; kuota aplikasi tidak menyediakan kapasitas gratis tanpa batas.

Database MySQL tidak termasuk driver versi ini. Jika hosting Anda hanya menyediakan MySQL/PHP, gunakan hosting Node/PostgreSQL terpisah atau rencanakan integrasi driver MySQL tersendiri.

## 2. Tetap mencoba di localhost

```sh
npm ci
cp .env.example .env
npm run db:migrate
npm start
```

Biarkan `DATABASE_URL=` kosong, `STORAGE_DRIVER=local`, `AUTO_MIGRATE=true`, `DEMO_LOGIN=false`. Buka `http://localhost:3000`, buat akun pribadi. SQLite tetap ada di `DATA_DIR/app.sqlite`; foto di `DATA_DIR/uploads`, lagu di `DATA_DIR/audio`. Jangan hapus folder data saat memperbarui kode.

Windows: jika perintah `cp` tidak tersedia, salin `.env.example` melalui File Explorer dan ubah nama salinannya menjadi `.env`.

## 3. PostgreSQL untuk hosting Node

Buat database dan pengguna melalui penyedia PostgreSQL Anda terlebih dahulu. Isi `.env` server (contoh nilai berikut adalah placeholder, bukan kredensial):

```dotenv
NODE_ENV=production
PORT=3000
APP_URL=https://domain-anda
DATABASE_URL=postgresql://USER:PASSWORD_URL_ENCODED@HOST:5432/DATABASE
REQUIRE_POSTGRES=true
PG_SSL=true
AUTO_MIGRATE=false
DATA_DIR=/path/volume/persisten/temu
STORAGE_DRIVER=local
DEMO_LOGIN=false
```

- Gunakan URL koneksi yang diberikan penyedia. Karakter khusus password harus di-URL-encode.
- Untuk database remote, TLS tetap memverifikasi sertifikat. Jika penyedia memakai CA privat, mount sertifikat CA ke server dan isi `PG_CA_FILE`. Jangan mematikan verifikasi sertifikat.
- `PG_SSL=false` hanya sesuai untuk koneksi internal terpercaya, misalnya jaringan privat Docker Compose pada VPS yang sama. `sslmode=require`, `verify-ca`, atau `verify-full` pada URL juga mengaktifkan TLS yang diverifikasi aplikasi.
- Aplikasi menggunakan connection pool, default `DB_POOL_SIZE=10`; sesuaikan kapasitas koneksi dengan jumlah instance.
- `REQUIRE_POSTGRES=true` mencegah server tanpa sengaja memakai SQLite jika URL terlewat.

Jalankan sebelum memulai aplikasi:

```sh
npm ci --omit=dev
npm run db:migrate
npm start
```

Migrasi tersedia sebagai SQL di `db/migrations/postgres/`. Runner menandai versi pada `schema_migrations`, menjalankan dalam transaksi, dan memakai advisory lock PostgreSQL. Jalankan runner, bukan mengimpor SQL satu per satu lalu menjalankannya lagi tanpa pencatatan versi. Pengguna migrasi membutuhkan izin membuat/mengubah tabel; pengguna runtime dapat dibatasi setelah migrasi jika memakai role terpisah.

`GET /healthz` memeriksa koneksi database dan mengembalikan status tanpa kredensial. Gunakan process manager/container dengan restart policy. `SIGTERM`/`SIGINT` menghentikan listener dan connection pool secara tertib.

## 4. Penyimpanan foto dan lagu di S3-compatible

Buat **bucket privat** pada AWS S3 atau penyedia S3-compatible. Pastikan akses publik bucket dimatikan; aplikasi tidak membuat bucket dan tidak mengubah kebijakan akses bucket Anda.

```dotenv
STORAGE_DRIVER=s3
S3_REGION=region-dari-penyedia
S3_BUCKET=nama-bucket
S3_ENDPOINT=https://endpoint-penyedia
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
```

- AWS S3 standar: `S3_ENDPOINT` dapat kosong. Endpoint khusus mengikuti dokumentasi penyedia, termasuk `S3_FORCE_PATH_STYLE=true` jika dibutuhkan.
- Isi access key/secret **hanya di environment server**. AWS dengan instance/task role dapat memakai credential provider chain SDK tanpa kedua nilai key tersebut; jangan isi salah satu saja.
- Izin minimum bucket mencakup GetObject, PutObject, DeleteObject dan HeadObject (Head memakai izin baca objek) pada prefix `photos/` dan `audio/`. Aplikasi tidak perlu bucket publik. Batasi IAM sesuai bucket/prefix tersebut.
- Endpoint S3 produksi harus HTTPS. File dibaca melalui API Temu yang memeriksa pemilik/status acara; URL bucket/presigned URL tidak diberikan ke frontend.
- Audio mendukung HTTP Range untuk streaming/seek. Foto yang tidak dipakai dan lagu yang tidak dipilih tidak terbuka ke publik, walaupun acaranya sudah siap dibagikan.
- `DATA_DIR` tetap diperlukan dan writable untuk file sementara `.tmp`; ini dapat memakai disk sementara pada deployment S3. Pastikan tersedia ruang cukup untuk dua unggahan yang sedang diproses.
- Backup PostgreSQL dan bucket adalah dua hal berbeda. Gunakan backup/versioning yang sesuai. Jangan memasang lifecycle penghapusan otomatis yang menghapus media undangan aktif.

## 5. Memindahkan SQLite lama ke PostgreSQL

**Hentikan server lama dan backup seluruh folder data terlebih dahulu.** Proses ini hanya mengisi database target yang tabel datanya masih kosong; tidak menggabungkan/menimpa data target.

1. Pertahankan `app.sqlite` dan folder `uploads/`/`audio/` lama dalam satu direktori.
2. Isi `DATABASE_URL` target PostgreSQL pada `.env` dan `SQLITE_SOURCE=/path/data-lama/app.sqlite`.
3. Jalankan:

   ```sh
   npm run db:import-sqlite
   ```

4. Akun, hash password, ID pemilik, acara, metadata foto/lagu serta RSVP dipertahankan. Sesi login, state OAuth dan pembatasan percobaan tidak dipindahkan; pengguna masuk kembali. Sumber SQLite dibuka read-only dalam transaksi pembacaan. Target diisi dalam satu transaksi; konflik membatalkan impor.
5. Jika tetap memakai file lokal, salin folder `uploads`/`audio` ke `DATA_DIR` server baru. Mengimpor metadata saja **tidak menyalin file**.
6. Jika pindah ke S3, isi konfigurasi bucket lalu set `DATA_DIR` ke direktori yang berisi file lama dan jalankan:

   ```sh
   npm run storage:sync
   ```

   Skrip mengunggah file ke prefix yang sama dengan metadata, tidak menghapus sumber, dan melewati objek yang sudah ada dengan ukuran sama. Objek dengan ukuran berbeda tidak ditimpa; periksa kegagalan sebelum melanjutkan. Pemeriksaan ukuran bukan verifikasi checksum penuh.
7. Jalankan pemeriksaan ukuran foto lama:

   ```sh
   npm run media:backfill
   ```

   Foto lama yang belum diukur dihitung konservatif sebesar batas maksimal file untuk pemeriksaan kuota sampai backfill selesai. Jika file hilang atau bucket tidak dapat dibaca, perintah mengembalikan kode gagal agar tidak menyiratkan pemindahan selesai.
8. Buka akun lama, pratinjau beberapa undangan, foto dan lagu; periksa akses publik dan RSVP. Baru arahkan domain ke server baru. Simpan backup sumber agar pemulihan tetap mungkin.

Perintah impor dijalankan sekali ke target kosong. Jangan menjalankannya pada produksi yang sudah menerima pendaftaran baru. Jika perlu menggabungkan dua database berisi data, diperlukan proses migrasi terpisah dengan pemetaan ID dan kepemilikan.

## 6. Docker Compose di VPS

Tersedia `Dockerfile`, `compose.yaml`, serta contoh reverse proxy `deploy/nginx.conf.example`.

1. Salin `.env.example` menjadi `.env`.
2. Set `POSTGRES_PASSWORD` ke nilai acak kuat berbentuk hex, misalnya hasil generator password lokal; jangan gunakan contoh password tetap. Pilih nama database/user melalui `POSTGRES_DB` dan `POSTGRES_USER` sebelum volume pertama dibuat. Nilai hex menghindari masalah karakter khusus pada URL Compose.
3. Set `APP_URL=https://domain-anda`, `DEMO_LOGIN=false`; pilih local/S3 dan isi konfigurasi yang diperlukan.
4. Bangun dan jalankan:

   ```sh
   docker compose up -d --build
   ```

Compose menunggu PostgreSQL sehat, menjalankan migrasi, lalu memulai Node. Database tidak diekspos ke internet. Port Node hanya bind `127.0.0.1` agar reverse proxy menangani akses publik. Volume `postgres-data` dan `media-data` persisten; **jangan memakai `docker compose down -v` pada data nyata** kecuali memang ingin menghapus volumenya.

Konfigurasikan reverse proxy dan sertifikat HTTPS domain Anda. Contoh Nginx masih memakai domain placeholder dan port 80 untuk konfigurasi awal; terbitkan sertifikat domain lalu aktifkan HTTPS sebelum digunakan publik. Setelah benar-benar berada di belakang satu reverse proxy terpercaya, isi `TRUST_PROXY=1`; jangan aktifkan kepercayaan proxy sembarang jika Node dapat diakses langsung dari internet. Sesuaikan hop proxy dengan arsitektur nyata. Maksimal request proxy harus lebih besar dari batas file audio; contoh memakai 40 MB untuk audio default 30 MB. Jika menaikkan batas audio, naikkan juga batas reverse proxy.

Untuk menguji localhost dengan Compose, dapat memakai `APP_URL=http://localhost:3000` sementara; sebelum publik gunakan domain HTTPS. Cookie sesi otomatis Secure saat APP_URL HTTPS. Tanpa HTTPS, jangan anggap pengujian lokal setara deployment produksi.

Di lingkungan proxy build khusus, Dockerfile mendukung secret `proxy_ca` untuk CA terpercaya saat `npm ci`; instalasi TLS tidak dinonaktifkan. Pada VPS biasa cukup `docker compose build`.

## 7. Menambahkan lagu dan banyak foto

Di dashboard → **Edit undangan → Info & tampilan**:

1. Isi judul lagu, pilih file MP3/M4A/OGG/WAV, lalu **Unggah lagu**.
2. Pilih lagu pada **Musik latar**, kemudian **Simpan**. Lagu yang baru diunggah belum menjadi musik publik sebelum undangan disimpan.
3. Musik mulai diputar saat tamu menekan Buka Undangan. Tombol musik di navigasi bawah dapat menjeda dan memutar kembali. Jika browser menolak pemutaran, tamu dapat menekan tombol Musik untuk mencoba lagi. Pilihan None menghilangkan pemutar.
4. Menghapus lagu yang sedang dipakai langsung mengubah musik tersimpan menjadi None. Penghapusan meminta konfirmasi.

Di **Galeri foto**:

- Pilih banyak file sekaligus. Foto diunggah satu per satu dengan indikator proses; simpan susunan setelah selesai.
- Menghapus foto dari susunan galeri tidak langsung menghapus filenya. Pada **Penyimpanan acara**, gunakan lagi foto yang sudah diunggah atau hapus permanen untuk membebaskan kapasitas.
- Foto yang masih dipakai sebagai sampul, profil atau galeri dilindungi dari penghapusan permanen. Lepaskan dari formulir, Simpan, lalu hapus dari pustaka.
- Jika satu file gagal, foto yang berhasil tetap ada; Anda dapat mencoba file yang gagal lagi.

Batas default:

| Konfigurasi | Nilai |
|---|---:|
| `MAX_GALLERY_PHOTOS` | 200 foto pada satu galeri |
| `MAX_EVENT_PHOTOS` | 1.000 file foto per acara, termasuk foto belum dipakai |
| `MAX_IMAGE_MB` | 10 MB per foto |
| `MAX_AUDIO_MB` | 30 MB per lagu |
| `MAX_EVENT_TRACKS` | 20 lagu per acara |
| `MAX_EVENT_STORAGE_MB` | 2.048 MB foto + lagu per acara |

Isi gambar divalidasi dengan Sharp (JPEG/PNG/WebP, batas 40 megapiksel), lalu dirotasi, metadata dibuang dan dioptimalkan ke WebP maksimal 2000×2000. Audio diperiksa berdasarkan header dan metadata stream, maksimal 30 menit. M4A harus memakai container audio M4A/M4B yang didukung. File nama/ekstensi kiriman bukan validasi keamanan. Unggah hanya lagu yang Anda berhak gunakan.

Batas jumlah dan ukuran dapat diubah melalui environment dalam rentang yang diperiksa aplikasi. Kuota diperiksa di transaksi dengan lock acara sehingga dua unggahan bersamaan tidak melompati batas. Unggahan memakai disk sementara, bukan menahan semua file dalam RAM. Hanya dua unggahan diproses bersamaan per instance; jika server sibuk, pengguna diminta mencoba kembali.

## 8. Penghapusan, pemeliharaan, dan backup

Penghapusan acara mencabut akses API segera dan mencatat file untuk dibersihkan. Jika penyimpanan terputus, pekerjaan tetap tercatat dalam `storage_deletions`. Server mencoba ulang tiap 30 detik; perintah berikut juga tersedia:

```sh
npm run storage:cleanup
```

Respons penghapusan dapat memiliki `cleanupPending=true`: data logis sudah dihapus tetapi masih ada file privat yang menunggu pembersihan. Periksa kode keluar/log pemeliharaan dan kapasitas bucket. Jangan membuat bucket publik untuk memudahkan akses file.

Backup yang perlu disimpan: PostgreSQL (misalnya layanan backup penyedia/pg_dump) dan bucket atau volume media. Untuk SQLite, gunakan backup API atau hentikan aplikasi lalu salin database beserta WAL dan file media secara konsisten. Lakukan uji pemulihan pada lingkungan terpisah. Menambah kapasitas database tidak menambah kapasitas bucket atau disk secara otomatis.

## 9. Verifikasi

`npm test` menguji SQLite lokal. Bila tersedia PostgreSQL uji, set `TEST_DATABASE_URL` lalu jalankan tes. Harness membuat schema acak khusus tes dan menghapus schema tersebut setelah selesai; gunakan database pengujian, bukan produksi. Tes S3 memakai `TEST_S3_ENDPOINT` beserta konfigurasi S3 pada emulator/layanan uji. Aplikasi tidak membuat bucket uji secara otomatis.

Verifikasi deployment nyata tetap memerlukan URL database, bucket, kredensial, domain dan HTTPS milik Anda. Hasil pengerjaan dan batas pengujian tercatat di `VALIDATION.md`.

## Hostinger: entry point dan batas startup

Gunakan Node.js 24+, framework Express, root berisi package.json, startup file `server.js`, dan start command `npm start` jika diminta. `server.js` memulai server ketika dieksekusi langsung maupun ketika di-require oleh loader hosting. Factory `createApp` berada di `app.js`; jangan pilih `app.js` sebagai startup file. Unggah seluruh proyek terbaru karena server.js membutuhkan app.js dan modul lainnya.

Jika log menyebut `App did not call listen() within 3 seconds`, pastikan versi terbaru server.js sudah dipakai. Tidak ada guard `require.main === module` pada entry tersebut. Inisialisasi database/migrasi tetap harus berhasil sebelum listen; untuk PostgreSQL jalankan migrasi terlebih dahulu dan gunakan AUTO_MIGRATE=false sesuai panduan. Uji /healthz setelah deploy; tes lokal tidak menggantikan verifikasi di Hostinger. Environment variables diatur melalui panel; .env pribadi tidak termasuk kode Git atau ZIP rilis.
