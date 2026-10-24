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
