# Desain Tema Temu Undangan

Dokumen ini menjadi acuan implementasi visual tema Navy Ivory, Jawa Heritage, dan Islamic Serenity. Tema menggunakan komponen serta fitur aplikasi yang sama; yang berbeda adalah palet, ilustrasi, ornamen, dan suasana. Setiap tema dapat memiliki dua gambar latar yang diatur pemilik melalui Admin → Menu Latar.

## Struktur bersama

- Laptop: foto pasangan menetap di kiri; panel undangan 480 px di kanan bergulir sendiri. HP: satu kolom selebar layar, tanpa overflow horizontal.
- Sampul: foto pasangan, The Wedding Of, nama mempelai, nama tamu, dan Buka Undangan.
- Isi: intro nama → foto dan kutipan Ar-Rum yang sudah digunakan aplikasi → WITH LOVE/pembuka → countdown/Save the Date → profil mempelai → love story → acara → Maps → galeri → RSVP → ucapan/doa publik sesuai persetujuan → Titip Hadiah → penutup dengan logo cincin Temu.
- Nama mempelai memakai Great Vibes lokal; judul Georgia/serif; formulir dan navigasi memakai sans-serif yang mudah dibaca. Nama/tanggal/foto tetap berasal dari data acara.
- Float in muncul sekali saat elemen masuk layar dan menghormati reduced motion. Dekorasi tidak menangkap klik atau menutupi tombol, rekening, maupun formulir.
- Musik mulai setelah Buka Undangan ditekan; tombol menjeda/memutar kembali. Tidak menambahkan autoplay sebelum interaksi.
- Latar bersifat dekoratif di belakang konten dengan lapisan ivory yang menjaga keterbacaan. Foto mempelai, galeri, dan kartu rekening tidak diwarnai ulang.

## Navy Ivory

- Palet: navy #34415b, ivory #fffaf1, emas lembut #aa9b67. Logo Temu tetap memakai dua cincin hijau sebagai identitas layanan.
- Sampul bawaan menggunakan ilustrasi bunga/paviliun yang sudah ada, foto oval berbingkai emas, dan nama Great Vibes.
- Halaman isi memakai ivory dengan batas/bingkai navy dan penekanan emas pada timeline. Jangan menghilangkan isi ucapan, RSVP atau rekening ketika latar diganti.
- Admin → Menu Latar → Navy Ivory menyediakan slot **Sampul / halaman pertama** dan **Isi undangan**. Unggahan sampul dipakai pada sampul, intro dan gambar katalog. Unggahan isi dipakai pada bagian isi; tanpa unggahan isi, latar bawaan tetap berlaku.

## Jawa Heritage

- Palet: cokelat #59432f, ivory #fff7e8, emas #b49558, dan aksen gelap #3f3427.
- Unsur utama: motif kawung yang berulang secara halus, gunungan simetris pada bagian sampul, dan siluet pendopo/joglo pada area bawah.
- Ruang tengah dibuat tenang untuk nama mempelai, foto, dan teks. Ornamen batik berada pada tepian; isi menggunakan motif kawung yang ringan, bukan tekstur gelap di belakang paragraf.
- Foto mempelai tetap foto pengguna; tema tidak mengasumsikan pakaian adat tertentu, nama suku, gelar, atau urutan prosesi yang belum diisi pengguna.
- Ilustrasi bawaan merupakan vektor orisinal untuk aplikasi, tidak diklaim sebagai artefak budaya atau replika batik historis tertentu.
- Admin dapat mengganti kedua latar melalui Menu Latar → Jawa Heritage. Timeline, tombol dan bingkai foto mengikuti warna cokelat/emas.

## Islamic Serenity

- Palet: hijau zamrud #184d42, ivory #fffaf0, emas lembut #c7a45c, dan hijau gelap #123d35.
- Unsur utama: lengkung mihrab, pola bintang geometris delapan sudut, garis emas yang rapi, dan siluet kubah/minaret dekoratif pada bagian bawah sampul.
- Bagian tengah lapang dan terang; halaman isi memakai pola geometri dengan opasitas rendah di tepian.
- Tidak membuat tulisan Arab, ayat, hadis atau kutipan keagamaan baru sebagai dekorasi. Kutipan Ar-Rum dan pembuka yang telah diminta pengguna tetap mengikuti isi aplikasi; tidak mengarang sumber agama.
- Nama mempelai dan foto tetap dapat disesuaikan. Formulir/ucapan/galeri tetap tersedia seperti tema lain.
- Admin dapat mengganti kedua latar melalui Menu Latar → Islamic Serenity. Tombol dan judul mengikuti emerald/emas dengan teks yang kontras.

## Menu Latar di admin

- Dropdown memilih Navy Ivory, Sakura & Butterfly, Meihua Pavilion, Jawa Heritage, atau Islamic Serenity.
- Dua slot per tema: cover dan inside. Unggah JPG/PNG/WebP maksimal 10 MB; server memeriksa isi file, memperbaiki orientasi, menghapus metadata dan mengoptimalkan WebP.
- Latar berlaku untuk tema global, tidak mengganti foto pribadi acara. Hanya admin pemilik yang dapat mengunggahnya. Pergantian latar memperbarui katalog, preview dan undangan sesuai tema.
- Gambar bawaan dan unggahan memiliki fallback yang jelas. Teks tetap tampil jika gambar belum selesai dimuat.

## Katalog tema dan harga

- Kartu hanya menampilkan gambar, nama tema, harga, Preview dan Select. Tidak menampilkan deskripsi atau kalimat Satu acara untuk satu pembayaran pada kartu.
- Semua kartu berada pada satu baris horizontal; layar kecil atau tema yang bertambah dapat digeser ke samping. Tombol minimal 44 px dan teks tidak dipotong.
- Harga jual merah; harga normal abu-abu dicoret hanya jika lebih tinggi. Harga berasal dari konfigurasi pemilik, bukan angka yang dikarang dari referensi.
- Tema baru default belum dijual sampai harga/rekening/penjualan diatur admin. Pembelian tetap satu acara satu pembayaran, meskipun kalimat penjelas tidak ditampilkan pada kartu katalog.

## Rekening pembayaran produk

- Admin dapat menambahkan hingga 10 rekening yang valid. Pembeli memilih bank tujuan sebelum membuat/mengonfirmasi tagihan. Daftar ini terpisah dari Titip Hadiah mempelai.
- Tagihan menyimpan snapshot rekening yang dipilih. Mengubah/menghapus rekening di admin tidak mengubah tujuan pada tagihan lama diam-diam.
- Perubahan pilihan bank untuk tagihan hanya tersedia sebelum konfirmasi pembayaran. Nominal/harga/deadline tetap mengikuti tagihan awal; setelah konfirmasi atau paid, bank dikunci.

## Penyempurnaan komponen dan Owner Studio

- Jawa Heritage menerapkan cokelat/emas pada timeline, judul, tombol, navigasi, countdown dan bingkai foto. Foto memakai sudut lengkung atas dengan dasar persegi; kawung, gunungan dan pendopo tetap menjadi latar dekoratif.
- Islamic Serenity menerapkan emerald/emas pada komponen yang sama, dengan foto berbingkai lengkung mihrab dan pemisah judul geometris. Data acara, nama, galeri, musik, RSVP serta hadiah menggunakan alur aplikasi yang sama.
- Kartu katalog lebih kecil: empat kolom terlihat pada desktop, gambar 174 px; HP menampilkan kartu 230 px dalam satu baris geser. Kartu acara pengguna, daftar pesanan dan pengaturan harga admin juga dipadatkan tanpa mengurangi target tombol 44 px.
- Keterangan penggunaan di katalog berasal dari jumlah lisensi per tema yang sudah dibayar atau lisensi lama yang valid. Draft dan pembayaran yang belum disetujui tidak dihitung. Tidak mengisi angka awal 20 secara fiktif; angka 20 ke atas muncul saat jumlah sebenarnya tercapai.
- Dashboard khusus pemilik mengambil susunan dari referensi: sidebar kiri, area kerja putih dengan ilustrasi geometris pastel dan ringkasan angka, serta panel kanan untuk verifikasi, pembayaran disetujui, musik dan aktivitas. Palet lavender hanya berlaku pada admin; halaman utama/pengguna tetap hijau.
- Menu admin: Ringkasan, Pesanan, Undangan, Pustaka musik, Rekening & harga, Menu latar, Aktivitas. Setiap menu terhubung dengan fitur asli; angka memakai API admin yang dilindungi otorisasi pemilik.
- Pada layar sempit, navigasi berubah menjadi baris menu geser, area kerja satu kolom dan ringkasan di bawah. Pembatasan akses pengguna biasa tetap berlaku.

## Ornamen bergerak dan countdown semua tema

- Admin → Menu latar → pilih tema → Gambar bergerak menyediakan unggahan beberapa PNG/WebP transparan. Maksimal 12 gambar per tema dan 5 MB per gambar; gambar dioptimalkan menjadi WebP maksimal 640 px tanpa membuang transparansi.
- Setiap ornamen memiliki halaman (sampul, nama, mempelai, acara, lokasi atau galeri), posisi empat sudut, ukuran 60–240 px, durasi 4–20 detik serta pilihan berayun/melayang/diam. Dapat dinonaktifkan, diedit dan dihapus. Tema yang tidak diberi ornamen tambahan tetap menggunakan desain sebelumnya.
- Ornamen berada di belakang konten, tidak menangkap klik, dan bukan bagian dari foto pribadi. Animasi berhenti di luar layar atau ketika tab disembunyikan, serta tampil diam pada prefers-reduced-motion.
- Semua countdown memiliki empat kotak berwarna dengan angka dan label putih: navy, rose Sakura, merah Meihua, cokelat Jawa, emerald Islami. Tema baru mewarisi `--countdown-bg`, `--countdown-text` dan `--countdown-border`, dengan fallback ke token warna tema. Ukuran menyesuaikan layar 320 px tanpa mengubah perhitungan zona waktu.
