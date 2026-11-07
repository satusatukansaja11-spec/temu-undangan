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

Admin mengelola lagu dari **/admin → Pustaka musik bersama**. Isi judul, pilih MP3/M4A/OGG/WAV, lalu Unggah lagu. Hapus hanya diizinkan jika lagu belum dipakai undangan mana pun. Lagu lama per acara dipertahankan agar undangan yang sudah ada tetap berfungsi.

Pelanggan membuka **Edit undangan → Info & tampilan → Musik latar**, memilih lagu dari pustaka, lalu Simpan. Pelanggan tidak dapat mengunggah atau menghapus audio, termasuk melalui API. Musik mulai saat Buka Undangan ditekan; tombol musik menjeda dan memutar kembali. Jika browser menolak play, gunakan tombol Musik untuk mencoba lagi. None menghilangkan pemutar.

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


## Panel pemilik dan aktivasi akses admin

Halaman `/admin` menggunakan akun login yang sama dengan aplikasi utama, dengan hak admin tersimpan di server. Tidak ada password admin bawaan dan akun pertama tidak otomatis menjadi admin.

1. Backup database dan media, deploy seluruh kode terbaru, lalu jalankan `npm run db:migrate` pada database aplikasi (migrasi 004 menambahkan tabel admin, pustaka musik dan audit). SQLite dengan AUTO_MIGRATE=true juga menjalankannya saat startup.
2. Daftarkan akun pemilik melalui `/daftar` jika belum ada. Pakai email dan password yang Anda kuasai.
3. Dari terminal server pada folder aplikasi dan konfigurasi database yang sama, jalankan (ganti email contoh dengan email akun Anda):

   ```sh
   npm run admin:grant -- pemilik@example.com
   ```

4. Login/muat ulang, lalu buka `https://domain-anda/admin`. Panel Admin juga muncul pada dashboard akun pemilik di HP/laptop. Jika paket tidak menyediakan terminal, minta dukungan hosting menjalankan perintah tersebut pada environment aplikasi. Jangan memberikan hak admin melalui form publik atau membagikan akses server kepada pelanggan.
5. Untuk mencabut hak akses:

   ```sh
   npm run admin:revoke -- pemilik@example.com
   ```

Perintah membutuhkan akun email/password yang sudah terdaftar. Pemeriksaan admin dilakukan pada setiap request server, sehingga pencabutan juga berlaku untuk sesi yang masih login. Jalankan grant hanya untuk akun Anda sendiri yang identitasnya sudah dipastikan; tidak ada verifikasi kepemilikan email otomatis pada alur pendaftaran saat ini.

Panel mendukung pencarian nama/email/undangan, koreksi tanggal dengan alasan wajib, riwayat tindakan, dan upload/hapus lagu bersama. Koreksi memindahkan tanggal jadwal tambahan yang sama dengan tanggal utama lama; jadwal di hari lain tetap utuh. Jika pengguna membuka editor sebelum koreksi, penyimpanan data lama ditolak agar tidak menimpa koreksi: pengguna perlu memuat ulang. Audit dan data pelanggan hanya tersedia bagi admin.

Lagu bersama disimpan di storage local/S3 yang sudah dipilih. Metadata, peran admin, dan audit perlu disertakan dalam backup database; `storage:sync` juga memindahkan lagu pustaka saat migrasi storage. Tidak ada file .env pribadi pada kode rilis. Pembayaran transfer manual, katalog, aktivasi tanggal dan expiry tersedia pada migrasi 005. Penjualan memerlukan konfigurasi rekening/harga di panel admin.


## Penjualan tema, transfer manual dan migrasi 005

1. Backup database serta seluruh media (termasuk bukti pembayaran privat), lalu deploy seluruh kode terbaru. Jangan menghapus volume data atau mengganti .env/database ketika update.
2. Jalankan `npm run db:migrate` pada database produksi; SQLite AUTO_MIGRATE=true melakukannya saat startup. Migrasi 005 menandai undangan lama sebagai legacy agar tetap berfungsi. Draft baru tetap dapat dibuat tanpa pembayaran; perintah tidak memberi akses aktivasi/publikasi gratis.
3. Login pemilik ke `/admin` dengan peran admin yang sudah diberikan melalui `admin:grant`. Hak admin lama tetap dipertahankan. Jika belum, daftarkan akun sendiri lalu gunakan perintah grant pada bagian sebelumnya.
4. Pada **Rekening dan harga produk**, isi bank, nomor rekening asli, nama pemilik rekening, petunjuk transfer, harga rupiah masing-masing tema dan batas waktu pembayaran. WhatsApp awal `6282137665266` dapat diganti. Harga 0 berarti tema belum dijual. Aktifkan checkbox penjualan hanya sesudah rekening dan harga diperiksa.
5. Order tampil pada **Pesanan produk**. Gunakan Perbarui untuk melihat order baru. Pelanggan mengirim konfirmasi melalui aplikasi dan dapat melanjutkan chat WhatsApp. Link WhatsApp tidak mengirim otomatis.
6. Periksa dana melalui mutasi bank sebenarnya. Klik Periksa pembayaran, masukkan nominal dan referensi transaksi bank unik, centang dana sudah diperiksa, lalu Setujui & aktifkan. Bukti transfer saja tidak membuktikan dana masuk. Gunakan alasan untuk penolakan; transfer terlambat memerlukan alasan tambahan saat disetujui.
7. Pelanggan membuka draft acara yang terkait dengan satu order tersebut, menyimpan tanggal/zona waktu, lalu menekan Aktifkan & kunci tanggal. Setelah aktivasi, perubahan tanggal hanya melalui admin selama masa aktif. Seluruh jadwal tambahan pada undangan baru berada di tanggal yang sama.
8. Masa aktif berakhir tepat pukul 00.00 hari berikutnya pada zona WIB/WITA/WIT terpilih. Pemeriksaan berlangsung pada request server, tidak memerlukan cron. Undangan lama legacy tidak mengikuti expiry baru sampai kebijakan migrasi tersendiri ditentukan. Undangan expired menjadi arsip baca saja, bukan dihapus.

Bukti foto maksimal 5 MB, JPEG/PNG/WebP, disimpan sebagai objek privat di prefix photos/ yang sama tanpa dimasukkan ke tabel foto publik. Akses hanya pemilik order/admin melalui endpoint terotorisasi. `storage:sync` mencakup bukti; backup database dan storage tetap dua hal berbeda. Impor SQLite ke PostgreSQL mempertahankan order, hak akses, kunci tanggal, konfigurasi penjualan dan referensi bukti. Pada sumber lama tanpa lisensi, undangan yang diimpor ditandai legacy.

Harga/rekening pada screenshot dan fixture adalah fiktif. Tidak ada pembayaran bank sungguhan dijalankan pada pengujian kode. Refund otomatis dan notifikasi WhatsApp/email otomatis belum disediakan; proses admin dan tombol WhatsApp manual yang digunakan.


## Pembaruan banyak acara dan perbaikan localhost

Pembaruan ini tidak menambah migrasi SQL baru di atas 005. Tetap jalankan `npm run db:migrate` setelah memperbarui seluruh kode jika versi sebelumnya belum lengkap. Rekening, harga, order lama, dan hak admin tidak direset.

- **Tambah Acara** membuat draft belum aktif. Pelanggan dapat memasukkan nama pasangan lain dan tanggal rencana, lalu memilih tema untuk acara tersebut. Order menyimpan event_id sejak checkout. Admin menyetujui acara yang sama, bukan membuat acara baru. Order lama tanpa event_id tetap kompatibel dan dibuatkan satu acara saat pertama disetujui.
- Persetujuan pembayaran A tidak membuka acara B. Acara dengan pending order lain tidak dideduplikasi hanya berdasarkan tema. Klien mengirim eventId yang dimiliki akun; server memeriksa pemilik dan status pembayaran. Draft belum dibayar tidak dapat diaktifkan atau dipublikasikan.
- Untuk menghapus draft yang masih memiliki order, batalkan order dahulu. Konfirmasi awaiting_verification harus ditinjau admin terlebih dahulu agar tidak menghapus acara saat pemeriksaan transfer berlangsung.
- Harga jual dan harga normal opsional diatur di kartu per tema pada /admin#themePricing. Pengaturan lama yang belum memiliki comparePrices diperlakukan tanpa promo. Perubahan harga tidak mengganti snapshot invoice yang sudah dibuat.
- Localhost menggunakan Node.js 24+ dan APP_URL yang sama persis dengan alamat browser (contoh http://localhost:3000), NODE_ENV=development. Folder proyek boleh berada di XAMPP tetapi server PHP tidak menjalankan aplikasi Node ini. Restart Node sesudah mengubah .env.
- Pemberian hak admin harus dilakukan di folder proyek dengan DATA_DIR/DATABASE_URL yang sama: `npm run admin:grant -- email-anda@example.com`. Tidak cukup memiliki akun dengan nama Admin. Jika localhost dan produksi memakai database berbeda, berikan peran secara terpisah pada akun pemilik masing-masing. Halaman /admin menyediakan panduan dan pemeriksaan ulang peran tanpa harus logout.
- Logout memerlukan asal request yang sama dengan APP_URL atau origin host aplikasi aktual serta CSRF sesi yang valid. Untuk sesi yang sudah habis, logout tetap membersihkan cookie. Token salah dan origin lintas situs tetap ditolak. Frontend menampilkan kegagalan dan mengaktifkan kembali tombol agar bisa dicoba ulang.


## Migrasi 006: latar tema dan ucapan publik

Deploy semua berkas terbaru, backup data/media, dan jalankan `npm run db:migrate`. Migrasi 006 menambahkan theme_assets dan wish_visibility. SQLite AUTO_MIGRATE=true juga menerapkannya saat startup. Migrasi tidak memublikasikan ulang pesan privat lama.

Admin dapat menentukan harga **Meihua Pavilion** di kartu harga tema. Isi dua gambar melalui **Latar Meihua Pavilion**: gambar pertama untuk cover, gambar kedua untuk isi. Unggah file JPG/PNG/WebP asli, masing-masing maksimal 10 MB. File dirotasi sesuai orientasi, metadata dibuang dan dioptimalkan menjadi WebP. Kedua gambar asli yang tampil pada pesan chat belum tersedia sebagai berkas proyek; default kode menggunakan ilustrasi vektor contoh dan dapat diganti lewat slot tersebut tanpa mengubah kode. Harga/rekening yang sudah ada tidak direset saat penambahan tema ketiga.

Gambar tema global adalah materi publik untuk katalog dan preview, disajikan melalui /theme-assets/:id. Metadata disimpan di theme_assets, objek di prefix photos/ pada storage yang sama. Foto pernikahan pribadi dan bukti transfer tetap memakai kontrol akses masing-masing. Penggantian gambar menjadwalkan objek lama untuk dibersihkan; storage:sync dan impor database mencakup aset tema serta catatan persetujuan ucapan.

Ucapan publik berasal dari RSVP dengan publishMessage=true secara eksplisit. Checkbox pada formulir dimulai tidak dicentang. Nama, ucapan dan waktu tampil di daftar publik; detail konfirmasi kehadiran individu tetap privat. Jumlah orang hadir merupakan agregat. Pemilik dapat memoderasi dari editor → RSVP → Ucapan yang disetujui untuk publik. Hindari mengubah tabel persetujuan secara massal untuk membuka ucapan privat lama. Endpoint tetap mengikuti status publikasi, RSVP enabled dan masa aktif.
