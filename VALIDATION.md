# Hasil verifikasi — 19 Oktober 2026

## Backend

`npm test`: **11 pengujian lulus, 0 gagal**, menggunakan Node.js 24.19.0 dan database sementara. Rincian dapat direproduksi di `test/app.test.js`.

- Akses anonim ditolak; pemeriksaan CSRF dan Origin aktif.
- Pemilik acara berasal dari sesi; ID pemilik kiriman frontend diabaikan.
- Dua identitas diuji: pengguna kedua tidak dapat membaca, mengubah, menghapus atau mengunggah ke acara pengguna pertama.
- Draft dan foto draft tidak dapat dibuka tanpa sesi pemilik.
- Isi gambar palsu dan file lebih besar dari 5 MB ditolak.
- Kegagalan validasi tidak menimpa data yang sudah disimpan.
- Undangan lengkap dapat diakses tanpa login; data publik tidak menyertakan identitas akun atau ID internal.
- Mengembalikan undangan menjadi draft mencabut akses publik beserta fotonya.
- Hapus acara membersihkan relasi dan file foto.
- Halaman aplikasi, audio WAV dan URL tak ditemukan memberikan respons sesuai.
- Login demo tidak aktif secara default; OAuth yang belum diatur kembali dengan pesan konfigurasi.

## Browser

Diuji di Chromium headless yang tersedia di lingkungan pengerjaan, menggunakan server lokal dan akun demo lokal. Foto fixture berupa gambar warna polos untuk menguji upload; bukan konten undangan nyata.

Desktop 1440×1000, ponsel 390×844, tablet 768×1024:

- Login demo → dashboard → tambah acara → isi formulir → unggah ketiga foto wajib → simpan → dashboard.
- Status menjadi Siap Dibagikan setelah informasi lengkap.
- Dialog Sebar menghasilkan URL `https://wa.me/?text=...` dengan pesan dan tautan undangan. Tidak mengirim pesan atau membuka aplikasi WhatsApp sungguhan selama pengujian.
- Halaman publik berhasil dibuka dalam context browser lain tanpa cookie login.
- Musik dalam keadaan paused sebelum interaksi; pilihan None tidak merender elemen audio.
- Unggah galeri dua file, pindah urutan, hapus satu, simpan; halaman publik memuat satu foto yang tersisa.
- Konfirmasi hapus: Batal mempertahankan acara; Hapus menghilangkan acara dari daftar.
- Keluar akun mengembalikan halaman login.
- Tidak ditemukan JavaScript page error pada alur utama.
- Tidak ditemukan overflow horizontal pada halaman dashboard ponsel dan undangan ponsel/tablet yang diuji. CSS untuk desktop dan screenshot diperiksa.

## Batas verifikasi

Google OAuth nyata belum dijalankan karena client ID/secret belum disediakan dan endpoint Google tidak tersedia dalam kebijakan jaringan lingkungan. Belum ada deployment internet, sehingga akses lintas perangkat melalui domain publik belum diverifikasi. Helper penerbitan Sites tidak terpasang; source disiapkan untuk deployment Node.js mandiri. Kontrol musik diuji untuk ketiadaan autoplay dan elemen audio; kualitas suara belum ditinjau dengan perangkat audio fisik. Keyboard dan screen reader belum diuji menyeluruh.

## Pembaruan halaman awal dan login — 24 Oktober 2026

`npm test`: **19 pengujian lulus**. Selain pengujian sebelumnya, mencakup rute beranda/login/daftar/dashboard/layar tamu, origin pendaftaran, validasi password/email, hash + salt dan sesi pendaftaran, penolakan email duplikat, login email salah/benar, pembatasan percobaan, penanganan Apple yang belum diatur, callback palsu, serta signature/audience/expiry/nonce/email token Apple menggunakan key fixture yang dibuat saat tes. Pengujian token fixture tidak menggantikan uji OAuth Apple nyata.

Login provider Google dan Apple nyata tetap memerlukan kredensial dan akses jaringan eksternal. Tidak ada email konfirmasi atau layanan pemulihan password yang dikirim selama pengujian.

Browser Chromium: menu tujuh item, dialog contoh tema, tautan ZIP GitHub, penjelasan Apple belum dikonfigurasi, pendaftaran email hingga dashboard, login salah/benar, keluar akun, serta sapaan dan hapus nama Layar Tamu berhasil. Beranda, login, daftar, dan Layar Tamu diperiksa di 390×844; beranda juga diperiksa di 768×1024 dan desktop 1440×1000. Tidak ditemukan overflow horizontal maupun JavaScript page error pada alur yang diperiksa.

## Penghapusan login Google — 2 November 2026

Tombol Google, ikon, pesan konfigurasi, endpoint OAuth/callback, pembacaan environment Google dan akses foto profil Google telah dihapus. Akun dan data undangan tidak dihapus. Apple tetap menjadi opsi terpisah sesuai lingkup perubahan; daftar/login email tidak memerlukan Google atau Apple.

Regresi ditambahkan untuk memastikan endpoint Google lama mengembalikan 404 dan API identitas tidak lagi menawarkan konfigurasi Google. Dua pengguna yang benar-benar dibuat melalui endpoint pendaftaran diuji untuk memastikan daftar undangan terpisah dan akses baca/ubah/hapus ke acara milik pengguna lain ditolak.

Hasil: `npm test` **20 lulus, 0 gagal**. Chromium memverifikasi halaman login/daftar tanpa Google dan tanpa akun demo saat `DEMO_LOGIN=false`, daftar akun pribadi, penyimpanan draft, reload, logout, login email kembali dan draft tetap tersedia. Halaman mobile 390×844 serta desktop 1440×1000 tidak menunjukkan overflow horizontal atau JavaScript page error pada alur tersebut. Gambar pratinjau login telah diperbarui.

## Undangan lengkap dan optimasi HP — 3 November 2026

`npm test`: **30 lulus, 0 gagal**. Tambahan pengujian mencakup penyimpanan cerita/rangkaian/gift, validasi array dan URL, draft parsial, konversi WIB/WITA/WIT, kalender dengan escape/lipatan UTF-8, kalender privat draft, RSVP anonim dengan origin sah, validasi jumlah tamu, cookie HttpOnly, pembaruan tanpa duplikasi, respons pribadi tidak terbaca tamu lain, rekap/paginasi hanya pemilik, nonaktifkan RSVP, batas pengiriman, dan cascade delete respons saat acara dihapus. Tes menggunakan database sementara; tidak menyentuh data produksi.

Chromium memeriksa editor love story/susunan acara/wedding gift dan rekap RSVP, countdown, file `.ics` WITA, profil pria/wanita, tautan Maps, galeri lightbox, salin rekening, RSVP simpan/muat ulang/ubah serta tampil dalam rekap pemilik. Pratinjau menonaktifkan pengiriman RSVP. Ukuran 320, 390, 768 dan 1440 piksel diperiksa tanpa overflow horizontal atau JavaScript page error pada alur tersebut. Musik tetap paused sebelum tindakan pengguna. Setelah inspeksi visual, kontrol musik dipindah ke navigasi bawah agar tidak menutupi tombol formulir.

Gambar pratinjau undangan menggunakan ilustrasi buatan untuk fixture QA, nama sintetis dan rekening berlabel contoh. Ini bukan foto atau detail rekening pelanggan. Tidak dilakukan transfer, pengiriman pesan, penulisan ke kalender eksternal, maupun pembukaan navigasi Maps di luar aplikasi.

Batas: RSVP anonim bergantung cookie browser; bukan verifikasi identitas. Kalender diperiksa sebagai unduhan/isi `.ics`, belum diuji impor ke seluruh aplikasi kalender di perangkat fisik. Clipboard memiliki fallback pemilihan teks. Tidak ada klaim audit aksesibilitas penuh atau pengujian semua browser/perangkat.
