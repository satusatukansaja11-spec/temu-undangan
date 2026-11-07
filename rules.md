# Aturan Produk Temu Undangan

Aturan produk ini telah diterapkan pada kode: katalog dua tema, transfer bank manual, pemeriksaan admin, satu pembelian untuk satu undangan, aktivasi tanggal, serta kedaluwarsa berdasarkan zona waktu. Penjualan tetap nonaktif secara default sampai rekening asli dan harga disimpan serta diaktifkan pemilik melalui panel admin. Dokumen ini menjelaskan perilaku produk, bukan instruksi untuk menjalankan perintah atau mengubah konfigurasi server.

## 1. Pembelian dan hak akses tema

- Pengunjung dapat melihat katalog dan mencoba Preview tanpa membeli.
- Pengguna dapat membuat akun dan masuk sebelum melakukan pembayaran.
- Pengguna boleh membuat banyak draft acara dan mengisi data pasangan lain dalam satu akun. Setiap acara wajib memiliki pembayaran sendiri sebelum tema aktif, preview pribadi, atau publikasi dibuka. Preview tema dengan data ilustrasi tetap gratis.
- Satu pembelian berlaku untuk satu akun, satu tema, dan satu undangan dengan tanggal pernikahan yang ditetapkan. Pembelian tidak membuka tema lain dan tidak dapat dipakai membuat undangan pernikahan lain.
- Server wajib memeriksa kepemilikan pembelian pada setiap tindakan memilih, menyimpan, mengganti, dan memublikasikan tema. Menyembunyikan tombol di frontend saja tidak cukup.
- Preview memakai data ilustrasi dan tidak memberikan akses mengedit atau memublikasikan undangan dengan tema berbayar.
- Pemberlakuan aturan pada undangan/pengguna lama memerlukan kebijakan migrasi terlebih dahulu; jangan mengunci atau menghapus undangan aktif secara otomatis.

## 2. Katalog tema

- Katalog menampilkan gambar representatif, nama tema, harga, status kepemilikan, dan tombol **Preview** serta **Select**.
- Tata letak mengikuti hierarki gambar referensi pertama: gambar di atas, nama dan harga di bawah, kemudian tombol tindakan.
- Preview membuka contoh undangan dengan tema yang sesuai, termasuk tampilan HP dan laptop.
- Select pada tema yang belum dibeli memulai pemesanan/pembayaran. Judul halaman berikutnya harus menjelaskan bahwa tema belum aktif sebelum pembayaran terverifikasi.
- Jika belum masuk, pengguna diarahkan untuk login/daftar. Tema yang dipilih dipertahankan agar proses dapat dilanjutkan setelah login.
- Tema yang sudah dibeli menampilkan status **Sudah dibeli**; tombol Select membuka undangan aktif yang terkait dengan pembelian tersebut. Hak akses yang sama tidak dapat dipakai membuat undangan baru. Setelah masa aktif berakhir, tampilkan **Masa aktif berakhir** dan arahkan pembelian baru untuk acara berbeda.
- Harga harus berasal dari konfigurasi server. Harga, diskon, label NEW, atau promo pada gambar referensi tidak otomatis menjadi harga/promo produk.
- Katalog responsif, tombol berlabel jelas dan dapat digunakan dengan keyboard. Jangan membuat tombol pembayaran seolah berfungsi jika integrasi belum tersedia.

## 3. Order dan pembayaran transfer bank manual

Alur utama:

`Login → Tambah/pilih acara → Isi draft → Pilih tema / Preview (opsional) → Order khusus acara → Transfer bank → Konfirmasi → Admin memeriksa mutasi → Pembayaran acara aktif → Kunci tanggal → Bagikan undangan`

### Rekening pembayaran produk

- Pembayaran dilakukan melalui transfer antarbank ke rekening pemilik layanan. Payment gateway belum diperlukan untuk alur manual ini.
- Admin dapat mengatur nama bank, nomor rekening, nama pemilik rekening, dan petunjuk transfer. Rekening ini terpisah dari rekening Titip Hadiah milik mempelai di dalam undangan.
- Tampilkan bank, nomor rekening, atas nama, total tagihan, kode order, batas waktu pembayaran, tombol **Salin nomor rekening**, dan **Konfirmasi via WhatsApp**.
- Ringkasan order menyimpan snapshot harga dan instruksi rekening yang berlaku saat order dibuat, agar perubahan konfigurasi tidak mengubah order lama diam-diam.
- Jangan menampilkan rekening contoh sebagai tujuan pembayaran nyata. Nonaktifkan pemesanan nyata sampai rekening milik penjual sudah diisi dan diperiksa.

Contoh untuk desain/pengujian saja — rekening fiktif, jangan ditransfer:

| Jenis bank | Nomor rekening contoh | Atas nama contoh |
|---|---|---|
| BCA | `0000000000` | NAMA PEMILIK USAHA — CONTOH |
| BRI | `000000000000000` | NAMA PEMILIK USAHA — CONTOH |
| Mandiri | `0000000000000` | NAMA PEMILIK USAHA — CONTOH |

Cukup aktifkan bank yang benar-benar digunakan penjual; tidak wajib menyediakan semua bank di atas. Rekening penerima memang ditampilkan kepada pembeli, tetapi PIN, OTP, password internet banking, dan kredensial admin tidak pernah ditampilkan/disimpan sebagai instruksi pembayaran.

### Status dan verifikasi

- Server menentukan harga, akun pembeli, tema, dan kode order unik; jangan mempercayai nominal atau identitas dari browser.
- Status minimal: `pending_payment`, `awaiting_verification`, `paid`, `rejected`, `expired`, dan `cancelled`. Kedaluwarsa order berbeda dari berakhirnya masa aktif undangan.
- Order langsung tercatat pada dashboard admin sejak dibuat, sebelum pelanggan membuka WhatsApp atau membayar.
- Konfirmasi pelanggan memindahkan order ke awaiting_verification, bukan langsung paid. Sertakan nama pengirim, tanggal transfer, nominal, dan bukti transfer bila diperlukan.
- Admin wajib memeriksa dana pada mutasi rekening yang sebenarnya, mencocokkan nominal dan order, lalu menekan **Verifikasi & Aktifkan** atau **Tolak konfirmasi** dengan alasan.
- Screenshot bukti transfer, pesan WhatsApp, redirect, dan tombol **Sudah transfer** bukan bukti bahwa dana telah diterima.
- Hanya admin terotorisasi dapat menyetujui pembayaran. Simpan siapa yang memverifikasi, waktu, nominal yang dicocokkan, serta referensi mutasi; jangan gunakan satu transfer untuk membayar dua order.
- Aktivasi harus idempoten: klik atau konfirmasi berulang tidak membuat hak akses/pesanan ganda. Simpan status paid dan hak akses satu undangan dalam transaksi database.
- Pesanan belum dibayar, ditolak, dibatalkan, atau kedaluwarsa tidak membuka tema. Transfer terlambat harus ditinjau admin, tidak boleh mengaktifkan order otomatis.
- Bukti transfer bersifat privat, dibatasi ukuran/jenis file, serta hanya dapat dibaca pembeli terkait dan admin. Jangan menaruh bukti pada URL publik.
- Dashboard pembeli menampilkan status menunggu pembayaran, menunggu pemeriksaan, aktif, atau penolakan beserta alasan. Berikan jalur konfirmasi ulang jika ditolak karena bukti tidak lengkap.

### Pemberitahuan pesanan dan WhatsApp

- Sumber pencatatan utama adalah dashboard admin **Pesanan**: jumlah pesanan baru, kode order, pelanggan, tema, nominal, waktu, status, dan tindakan verifikasi.
- Tombol **Konfirmasi via WhatsApp** membuka chat ke nomor penjual yang dikonfigurasi dengan pesan siap kirim, misalnya:

  > Halo Admin Temu, saya ingin konfirmasi order [KODE ORDER], tema [NAMA TEMA], total [TOTAL]. Nama akun: [NAMA]. Saya sudah transfer melalui [BANK PENGIRIM] pada [WAKTU TRANSFER]. Mohon diperiksa. Bukti transfer saya lampirkan.

- Pelanggan tetap harus menekan Kirim pada WhatsApp. Link wa.me tidak mengirim pesan otomatis atau otomatis melampirkan bukti transfer.
- Nomor WhatsApp penjual memakai format internasional, misalnya 62 diikuti nomor tanpa awalan 0; nomor asli belum ditentukan.
- Klik WhatsApp tidak boleh menjadi satu-satunya cara mencatat konfirmasi. Sediakan **Kirim konfirmasi pembayaran** dalam aplikasi agar order tetap masuk antrean admin meskipun pelanggan tidak menggunakan WhatsApp.
- Notifikasi email admin dapat ditambahkan sebagai pelengkap. WhatsApp otomatis untuk setiap order memerlukan integrasi WhatsApp Business Platform/penyedia yang sesuai dan bukan kemampuan bawaan link wa.me.
- Jika notifikasi eksternal gagal, order tetap tersimpan dan dapat diproses di dashboard. Jangan mengklaim pemberitahuan otomatis sudah berjalan sebelum integrasinya tersedia.
- Tema dan data pesanan hanya dapat diakses pemilik terkait/admin; informasi transaksi tidak ditampilkan pada undangan publik.

## 4. Satu tema baru: Sakura & Butterfly

Nama **Sakura & Butterfly** adalah nama kerja yang dapat diganti. Tambahkan satu tema baru di samping tema yang sudah ada, bukan mengganti seluruh tema lama.

### Arah visual

- Gambar referensi kedua menjadi acuan suasana utama: ivory, blush lembut, pegunungan, danau, pohon sakura, burung, dan paviliun.
- Gambar referensi ketiga menjadi acuan ornamen bunga, dedaunan, serta kupu-kupu berwarna biru dan jingga.
- Gabungkan keduanya menjadi satu tema yang konsisten: lanskap untuk sampul/latar dan ornamen bunga serta kupu-kupu untuk bagian isi.
- Sisakan ruang tenang di belakang teks agar nama, informasi acara, formulir, dan nomor rekening tetap terbaca.
- Gunakan aset referensi asli hanya jika file dapat diakses dan hak penggunaannya sesuai. Jika belum tersedia, minta file sumber atau gunakan aset pengganti yang penggunaannya diizinkan; jangan mengklaim aset pengganti sebagai gambar asli.

### Animasi

- Pohon/cabang bergerak perlahan seperti tertiup angin, dengan titik putar di pangkal. Gunakan lapisan ornamen terpisah agar teks dan seluruh latar tidak ikut bergoyang.
- Kupu-kupu mengepak dan bergerak perlahan pada jalur pendek, tidak menutupi nama, tombol, input, maupun informasi acara.
- Ornamen bersifat dekoratif: tidak menangkap klik, tidak menerima fokus, dan disembunyikan dari pembaca layar.
- Utamakan animasi transform/opacity, jumlah elemen terbatas, dan hentikan animasi saat halaman tidak terlihat untuk menghemat daya HP.
- Hormati `prefers-reduced-motion`: tampilkan ornamen diam dan nonaktifkan gerakan berulang.
- Pertahankan float in yang sudah ada tanpa menghalangi isi atau interaksi.

### Integrasi tema

- Tema muncul di katalog dengan Preview dan Select serta mengikuti aturan pembayaran yang sama.
- Setelah hak akses dimiliki, tema dapat dipilih dari editor dan pilihan tersimpan di database.
- Preview dan undangan publik memakai renderer tema yang dipilih, termasuk setelah halaman dimuat ulang.
- Nama mempelai, foto, musik, acara, Maps, galeri, hadiah, RSVP, dan personalisasi nama tamu tetap berasal dari data undangan pengguna.
- Pada laptop, pertahankan foto besar di kiri dan panel undangan yang dapat digulir di kanan; pada HP gunakan satu kolom tanpa overflow horizontal.
- Pertahankan urutan pembuka: sampul → nama mempelai → foto dan Ar-Rum ayat 21 → WITH LOVE dan salam pembuka → bagian undangan berikutnya.
- Musik mengikuti pilihan acara, mulai saat Buka Undangan ditekan dan dapat dijeda/diputar kembali melalui tombol musik.

## 5. Penyimpanan dan konfigurasi

- Simpan katalog tema, pesanan, referensi pembayaran, serta hak akses akun melalui migrasi database yang sesuai dengan SQLite dan PostgreSQL yang didukung proyek.
- Pertahankan kepemilikan data antar pengguna dan jangan menghapus data/berkas lama saat deployment.
- File `.env`, password, token, dan kunci pembayaran tidak boleh diunggah ke GitHub atau disertakan dalam ZIP kode. `.env.example` hanya berisi contoh tanpa rahasia.
- Halaman utama tidak lagi menampilkan menu atau bagian Download kode aplikasi.

## 6. Keputusan sebelum pembayaran nyata diaktifkan

Hal-hal berikut belum ditentukan dan tidak boleh diisi dengan nilai produksi yang dikarang:

- Rekening transfer asli, nama pemilik rekening, dan admin yang berwenang memverifikasi. WhatsApp awal sudah ditetapkan pemilik: 6282137665266, dapat diganti melalui panel admin. Metode pembayaran: transfer bank manual.
- Harga masing-masing tema, biaya, serta kebijakan promo.
- Ketentuan refund, batas waktu pembayaran, target waktu pemeriksaan transfer, serta prosedur koreksi tanggal oleh admin. Satu pembelian untuk satu undangan/pernikahan sudah ditetapkan.
- Kebijakan untuk pengguna serta undangan yang dibuat sebelum fitur pembelian berlaku.
- Aset sumber asli jika ingin memakai gambar referensi persis. Tema Sakura saat ini memakai ilustrasi SVG orisinal yang terinspirasi referensi, bukan salinan gambar terlampir.

Pengujian memakai rekening fiktif berlabel contoh. Pembayaran nyata hanya dibuka setelah rekening penjual, harga, kontak admin, dan prosedur verifikasi ditetapkan.

## 7. Kriteria penerimaan

- Pengunjung dapat Preview tanpa memperoleh hak akses tema.
- Pengguna tanpa pembelian dapat mengisi draft dan memilih tema untuk penawaran, tetapi tidak dapat mengaktifkan tema/preview pribadi/publikasi melalui UI maupun API.
- Select tema belum dibeli membuka order transfer bank; tema hanya aktif setelah admin memverifikasi dana masuk dan server menyimpan hak akses.
- Pembayaran gagal, dibatalkan, kedaluwarsa, nominal salah, atau notifikasi palsu tidak membuka tema.
- Konfirmasi/klik persetujuan berulang dan muat ulang halaman tidak menyebabkan transaksi/hak akses ganda.
- Akun pembeli dapat memakai tema untuk satu undangan yang dibeli; akun lain dan undangan lain tidak memperoleh akses.
- Tema baru tampil dan tersimpan sesuai pilihan, dengan animasi pohon/kupu-kupu serta fallback reduced motion.
- Tampilan dan alur utama diperiksa pada HP serta laptop, termasuk jaringan gagal, pembayaran pending, dan data panjang.

## 8. Undangan sekali pakai dan tanggal pernikahan

- Satu order paid hanya mengaktifkan satu undangan untuk satu pernikahan; jangan memberi lisensi tema yang dapat dipakai berulang untuk acara berbeda.
- Tanggal rencana boleh diisi pada draft sebelum pembayaran. Setelah pembayaran disetujui, pengguna mengonfirmasi tanggal pernikahan dan zona waktu acara untuk aktivasi. Sebelum aktivasi/publikasi pertama, tampilkan konfirmasi bahwa tanggal tersebut menentukan masa aktif dan pemakaian hanya untuk satu pernikahan.
- Untuk mencegah pemakaian ulang dengan terus memajukan tanggal, tanggal dikunci saat pengguna mengonfirmasi aktivasi pertama. Setelah dikunci, pengguna tidak dapat mengganti tanggal utama atau memindahkan jadwal tambahan ke hari lain untuk memperpanjang masa aktif.
- Sebelum masa aktif berakhir, data lain seperti foto, teks, lokasi, dan musik tetap dapat diedit sesuai fitur yang dibeli. Kebutuhan perubahan tanggal yang sah ditangani admin dengan alasan dan catatan audit; prosedur rinci ditetapkan sebelum peluncuran.
- Masa aktif berakhir pada pukul 00.00 hari setelah tanggal pernikahan, berdasarkan zona waktu acara yang disimpan (WIB/WITA/WIT). Gunakan waktu server, bukan jam perangkat pengguna. Zona waktu juga dikunci bersama tanggal.
- Contoh: tanggal 20 Juni 2027, Asia/Jakarta (WIB), aktif sampai sebelum 21 Juni 2027 pukul 00.00 WIB. Sejak waktu tersebut undangan berstatus `expired`.
- Setelah expired, pengguna tidak dapat mengedit, mengganti tanggal/zona waktu, mengganti tema, memublikasikan ulang, atau menggunakan ulang undangan tersebut. Tombol yang tidak berlaku menampilkan alasan yang jelas.
- Tautan publik expired menampilkan pemberitahuan masa aktif berakhir; RSVP baru dan akses media publik undangan tersebut dihentikan. Untuk undangan lain yang masih aktif, akses media tetap mengikuti kepemilikan/pemakaiannya.
- Akun pembeli tetap dapat login dan melihat riwayat pesanan serta arsip undangan miliknya dalam mode baca saja. Jangan menghapus database, foto, lagu, atau ucapan secara otomatis hanya karena expired.
- Membuat undangan untuk pernikahan baru memerlukan order/pembelian baru, termasuk jika memakai tema yang sama.
- Aturan masa aktif dan penguncian wajib diperiksa server pada endpoint edit, publikasi, RSVP, render publik, akses media, dan pemilihan tema. Cron atau tombol disabled hanya pelengkap; akses tetap ditolak saat tenggat terlewati meskipun tugas terjadwal belum berjalan.
- Tanggal awal yang sudah lewat tidak boleh dipakai mengaktifkan pembelian baru. Koreksi tanggal tidak otomatis memperbarui tenggat tanpa validasi dan otorisasi admin.
- Status pembayaran paid tetap menjadi riwayat keuangan setelah undangan expired; jangan mengubah pembayaran menjadi gagal karena masa aktif selesai.
- Kebijakan undangan lama harus dimigrasikan secara eksplisit, dengan backup dan pemberitahuan; jangan menerapkan penguncian retroaktif tanpa kebijakan yang ditentukan.

### Kriteria penerimaan tambahan

- Order muncul di dashboard admin walaupun WhatsApp belum dibuka; konfirmasi pelanggan masuk antrean pemeriksaan tanpa otomatis mengaktifkan tema.
- Nomor rekening penjual dan tombol salin tampil sesuai konfigurasi; rekening Titip Hadiah mempelai tidak tercampur dengan rekening pembayaran produk.
- Hanya verifikasi admin atas transfer yang benar-benar masuk dapat mengaktifkan hak akses satu undangan.
- Tepat sebelum batas akhir, undangan masih aktif; tepat pada batas akhir dan sesudahnya seluruh pembatasan expired berlaku, termasuk untuk tab editor yang sudah terbuka.
- Uji batas tanggal pada WIB, WITA, dan WIT, penggantian tanggal lewat API, serta upaya memakai order sama pada undangan lain.
- Setelah expired, pelanggan tetap dapat login/membaca arsip, tetapi tidak dapat memindahkan tanggal atau memakai undangan untuk pernikahan baru.


## 9. Panel admin pemilik dan pustaka musik

- Panel `/admin` terhubung ke database dan akun aplikasi utama, dengan peran admin yang diberikan lewat perintah server kepada akun pemilik. Pelanggan tidak dapat mendaftar sebagai admin.
- Pemilik dapat mencari undangan pelanggan dan mengoreksi tanggal dengan alasan wajib. Simpan tanggal sebelum/sesudah, pelaku, waktu, dan alasan pada audit; koreksi tidak boleh menimpa perubahan yang lebih baru tanpa memuat ulang data.
- Hanya admin dapat mengunggah dan menghapus musik. Pelanggan hanya memilih lagu dari pustaka bersama; unggah foto tetap tersedia. Pembatasan berlaku pada UI dan API.
- Lagu bersama yang masih dipakai undangan tidak boleh dihapus. Pilihan lagu lama per acara dipertahankan agar data pengguna lama tidak rusak.
- Gunakan akun pemilik sendiri; tidak ada kredensial admin bawaan dan tidak ada promosi otomatis untuk pengguna pertama. Hak admin dapat dicabut melalui server.
- Panel bantuan, pustaka musik, order transfer manual, verifikasi pembayaran, katalog tema, penguncian tanggal, dan expiry sudah diimplementasikan. Pemilik tetap perlu mengisi rekening asli dan harga sebelum menyalakan penjualan.


## 10. Kebijakan penerapan dan batas yang diputuskan

- Migrasi 005 menandai seluruh undangan yang sudah ada sebagai legacy. Undangan tersebut mempertahankan tema Navy dan perilaku lamanya, tanpa penguncian/expiry retroaktif. Pembelian dan sekali pakai wajib untuk undangan baru setelah pembaruan ini.
- Penjualan awal nonaktif, harga kedua tema 0 (belum ditetapkan), rekening kosong, WhatsApp 6282137665266. Nomor rekening dan harga contoh pada screenshot pengujian bukan konfigurasi penjualan.
- Batas pembayaran awal 24 jam, dapat diatur 1–168 jam. Transfer terlambat hanya dapat disetujui admin dengan alasan tambahan; tidak otomatis mengaktifkan tema.
- Konfirmasi dalam aplikasi meminta nama pengirim, bank, waktu dan nominal transfer. Bukti foto opsional maksimal 5 MB (JPEG/PNG/WebP), bersifat privat. PDF belum didukung.
- Pengguna mengunci tanggal secara eksplisit melalui Aktivasi; sebelum itu undangan berbayar tetap draft walaupun isian lengkap. Semua jadwal pada undangan baru harus berada pada satu tanggal pernikahan yang dibeli.
- Koreksi admin pada undangan berbayar hanya selama masa aktif, disertai alasan, konflik versi dicegah, dan tenggat diperbarui sesuai tanggal/zona waktu terkunci. Arsip expired tidak dapat diaktifkan ulang melalui koreksi tanggal.
- Admin memperoleh pemberitahuan melalui daftar/jumlah pesanan dan tombol Perbarui di panel. Tautan WhatsApp memerlukan pelanggan menekan Kirim; tidak ada pengiriman WhatsApp/email otomatis.
- Refund/pencabutan transaksi paid tidak disediakan sebagai tindakan otomatis. Kebijakan refund perlu ditetapkan pemilik dan diproses dengan pencatatan yang sesuai sebelum fitur tersebut ditambahkan.


## 11. Banyak acara per akun, harga per tema, dan akses lokal

- Satu akun dapat membuat dan mengelola acara untuk pasangan lain. Identitas pemilik akun tidak harus sama dengan nama mempelai.
- Tambah Acara membuat draft, bukan memberikan hak tema gratis. Setiap draft memiliki identitas acara sendiri dan dapat diisi sebelum dibayar; status tetap Belum aktif.
- Order baru wajib dikaitkan ke acara yang dipilih pada alur antarmuka. Dua acara dengan tema sama memiliki dua order dan dua pembayaran terpisah. Klik ulang pada acara/order yang sama tidak membuat tagihan ganda.
- Pembayaran hanya mengaktifkan acara terkait, tidak membuat salinan acara dan tidak membuka seluruh tema/acara dalam akun tersebut. Acara yang sudah dibayar tidak dapat ditagih ulang; untuk acara berbeda buat draft baru.
- Dashboard menampilkan kartu masing-masing acara: nama, foto, tanggal rencana, tema, status, Edit form, Preview, dan Aktifkan/Bayar atau Bagikan sesuai status.
- Select tetap dapat dibuka saat harga/rekening belum siap. Halaman menjelaskan alasan pembayaran belum tersedia; server tetap menolak checkout/aktivasi sampai konfigurasi valid.
- Admin mengatur harga jual dan harga normal opsional pada kartu per tema. Harga normal 0 berarti tanpa promo; diskon/pencoretan hanya ditampilkan jika harga normal lebih besar dari harga jual. Harga tidak dipinjam dari gambar contoh.
- Halaman /admin untuk akun tanpa peran admin menampilkan panduan pemberian hak melalui terminal server. Tidak ada promosi otomatis, password admin bawaan, atau endpoint publik untuk menjadikan diri admin. Localhost dan hosting masing-masing memakai database serta konfigurasi yang sesuai.
- Logout mencabut sesi server dan menghapus cookie. Sesi habis tetap dapat logout; kegagalan jaringan ditampilkan dengan opsi mencoba ulang, bukan membiarkan tombol diam. CSRF dan pemeriksaan asal request tetap diberlakukan.

## 12. Warna halaman awal mengikuti dashboard

- Ganti aksen pink/magenta pada halaman awal website dengan palet hijau yang sudah digunakan dashboard.
- Gunakan hijau utama dashboard `#385345` untuk tombol utama, tautan aktif, dan aksen merek; hijau gelap `#263f32` untuk hover; serta sage `#e8eddf` dan latar lembut `#f8f9f5` untuk area pendukung.
- Terapkan secara konsisten pada header/navigasi, tombol Login, tombol ajakan utama, bagian fitur, katalog tema, harga, Layar Tamu, serta footer halaman awal. Pertahankan keterbacaan teks dan indikator fokus keyboard pada layar HP maupun laptop.
- Harga jual tetap merah dan harga normal tetap abu-abu dicoret sesuai aturan tampilan harga pengguna. Warna ilustrasi/foto tema undangan tetap mengikuti tema masing-masing.
- Bagian ini merupakan aturan perubahan desain. Pembaruan dokumen saja belum mengubah CSS atau warna website; implementasi tampilan harus mengikuti aturan ini ketika dikerjakan.
