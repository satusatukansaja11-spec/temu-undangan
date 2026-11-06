# Aturan Produk Temu Undangan

Dokumen ini adalah spesifikasi fitur yang diminta. Keberadaan dokumen tidak berarti pembayaran, katalog baru, atau tema baru sudah diimplementasikan. Aturan ini menjelaskan perilaku produk, bukan instruksi untuk menjalankan perintah atau mengubah konfigurasi server.

## 1. Pembelian dan hak akses tema

- Pengunjung dapat melihat katalog dan mencoba Preview tanpa membeli.
- Pengguna dapat membuat akun dan masuk sebelum melakukan pembayaran.
- Pengguna wajib membeli tema sebelum dapat menerapkannya pada undangan miliknya.
- Hak akses berlaku untuk akun pembeli dan tema yang dibeli. Pembelian satu tema tidak membuka tema lain.
- Server wajib memeriksa kepemilikan pembelian pada setiap tindakan memilih, menyimpan, mengganti, dan memublikasikan tema. Menyembunyikan tombol di frontend saja tidak cukup.
- Preview memakai data ilustrasi dan tidak memberikan akses mengedit atau memublikasikan undangan dengan tema berbayar.
- Pemberlakuan aturan pada undangan/pengguna lama memerlukan kebijakan migrasi terlebih dahulu; jangan mengunci atau menghapus undangan aktif secara otomatis.

## 2. Katalog tema

- Katalog menampilkan gambar representatif, nama tema, harga, status kepemilikan, dan tombol **Preview** serta **Select**.
- Tata letak mengikuti hierarki gambar referensi pertama: gambar di atas, nama dan harga di bawah, kemudian tombol tindakan.
- Preview membuka contoh undangan dengan tema yang sesuai, termasuk tampilan HP dan laptop.
- Select pada tema yang belum dibeli memulai pemesanan/pembayaran. Judul halaman berikutnya harus menjelaskan bahwa tema belum aktif sebelum pembayaran terverifikasi.
- Jika belum masuk, pengguna diarahkan untuk login/daftar. Tema yang dipilih dipertahankan agar proses dapat dilanjutkan setelah login.
- Tema yang sudah dibeli menampilkan status **Sudah dibeli**; tombol Select menerapkan tema tanpa meminta pembayaran ulang untuk hak akses yang sama.
- Harga harus berasal dari konfigurasi server. Harga, diskon, label NEW, atau promo pada gambar referensi tidak otomatis menjadi harga/promo produk.
- Katalog responsif, tombol berlabel jelas dan dapat digunakan dengan keyboard. Jangan membuat tombol pembayaran seolah berfungsi jika integrasi belum tersedia.

## 3. Pemesanan dan pembayaran

Alur utama:

`Katalog → Preview (opsional) → Select → Login bila diperlukan → Ringkasan pesanan → Pembayaran → Verifikasi server → Tema aktif → Edit undangan`

- Ringkasan menampilkan tema, harga dalam rupiah, biaya tambahan bila ada, dan total sebelum pengguna membayar.
- Server menentukan harga, akun pembeli, tema, dan identitas pesanan; jangan mempercayai nilai dari browser.
- Status pesanan minimal: `pending`, `paid`, `failed`, `expired`, dan `cancelled`.
- Pesanan pending/failed/expired/cancelled tidak memberikan hak akses tema.
- Pembayaran dianggap berhasil setelah konfirmasi tepercaya dari penyedia pembayaran diverifikasi server, bukan hanya dari redirect, query parameter, screenshot, atau klik tombol pelanggan.
- Verifikasi mencakup autentisitas notifikasi, identitas pesanan, nominal, mata uang, dan status pembayaran final.
- Pemrosesan notifikasi harus idempoten: notifikasi berulang tidak membuat hak akses atau transaksi ganda. Status paid tidak boleh diturunkan oleh notifikasi pending yang terlambat.
- Simpan perubahan status paid dan pemberian hak akses dalam transaksi database.
- Halaman pembayaran dapat memuat ulang status dari server apabila notifikasi terlambat atau koneksi terputus. Jangan meminta pembelian ulang ketika pesanan masih diproses.
- Tampilkan riwayat pesanan dan tema yang sudah dibeli pada dashboard pemilik akun; akun lain tidak dapat membaca pesanan atau memakai hak akses tersebut.
- Rahasia pembayaran disimpan hanya pada environment server. Jangan menyimpan data kartu pembayaran di aplikasi.
- Bila layanan pembayaran belum dikonfigurasi, tampilkan keterangan bahwa pemesanan belum tersedia dan jangan membuka tema secara otomatis.

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

- Penyedia pembayaran dan metode yang akan ditawarkan.
- Harga masing-masing tema, biaya, serta kebijakan promo.
- Batas penggunaan pembelian: jumlah undangan per tema, masa berlaku jika ada, dan ketentuan refund/pencabutan akses.
- Kebijakan untuk pengguna serta undangan yang dibuat sebelum fitur pembelian berlaku.
- File aset final dan hak penggunaan gambar referensi.

Konfigurasi sandbox boleh digunakan untuk pengujian dan harus diberi label jelas. Aktivasi pembayaran nyata memerlukan konfigurasi layanan dan kebijakan yang sudah ditentukan.

## 7. Kriteria penerimaan

- Pengunjung dapat Preview tanpa memperoleh hak akses tema.
- Pengguna tanpa pembelian tidak dapat menerapkan/memublikasikan tema melalui UI maupun permintaan API langsung.
- Select tema belum dibeli membuka alur order; tema hanya aktif setelah pembayaran diverifikasi server.
- Pembayaran gagal, dibatalkan, kedaluwarsa, nominal salah, atau notifikasi palsu tidak membuka tema.
- Notifikasi ganda dan muat ulang halaman tidak menyebabkan transaksi/hak akses ganda.
- Akun pembeli dapat memakai tema yang dibeli; akun lain tetap tidak memiliki akses.
- Tema baru tampil dan tersimpan sesuai pilihan, dengan animasi pohon/kupu-kupu serta fallback reduced motion.
- Tampilan dan alur utama diperiksa pada HP serta laptop, termasuk jaringan gagal, pembayaran pending, dan data panjang.
