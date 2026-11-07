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

## PostgreSQL, object storage, lagu dan banyak foto — 3 November 2026

- **SQLite lokal:** 39 tes lulus, 0 gagal; dua pengujian layanan eksternal dilewati ketika environment PostgreSQL/S3 tidak disediakan.
- **Pengujian gabungan:** 41/41 tes lulus, 0 gagal/skip, menggunakan PostgreSQL 16 asli pada container sementara dan emulator HTTP S3-compatible lokal (S3rver). Setiap pengujian PostgreSQL memakai schema acak terisolasi yang dibersihkan sesudahnya. Bukan database produksi.
- Perilaku lama login, kepemilikan acara, draft/media privat, kalender dan RSVP diuji ulang dengan query asynchronous pada kedua driver. Upsert/ringkasan menggunakan SQL yang sesuai kedua database; transaksi PostgreSQL memakai koneksi pool yang sama dan row lock untuk kuota media.
- Pengujian baru mencakup isi audio palsu, upload lintas akun, WAV valid, akses audio draft/publik, HTTP Range, lebih dari 20 foto, pencatatan ukuran, penolakan galeri di atas batas, perlindungan foto aktif, penghapusan lagu menjadi None, pembersihan file sementara, kuota terhadap unggahan bersamaan, migrasi SQLite lama yang idempoten, password lama tetap valid, impor ke PostgreSQL, serta penolakan target impor yang sudah berisi data.
- Integrasi S3-compatible menguji put/head/get-range/delete melalui SDK nyata ke emulator, pembatasan akses aplikasi, dan retry penghapusan setelah kegagalan penyimpanan yang disimulasikan. Kebijakan IAM/ACL provider cloud nyata belum diuji.
- Browser Chromium menggunakan aplikasi dengan **PostgreSQL + S3-compatible**: daftar akun, unggah/pilih/simpan lagu, putar/jeda tanpa autoplay, unggah 25 foto tambahan (28 total), reload, hapus foto tidak dipakai dan lagu terpilih, serta None mencabut pemutar dan akses audio publik. Mobile 390×844 dan desktop 1440×1000 diperiksa tanpa overflow atau JavaScript page error pada alur tersebut.
- `Dockerfile` berhasil dibangun dengan Node 24, dijalankan sebagai pengguna non-root, dan `/healthz` merespons 200. Konfigurasi Compose divalidasi; belum memasang Compose di VPS produksi.
- `npm audit --omit=dev`: 0 kerentanan pada lockfile yang diserahkan. Multer diperbarui ke 2.5.x dan body-parser dipatok melalui override kompatibel 2.4.x; parser body tidak mengaktifkan inflate.

File SQL/migrasi, alat impor, pemeliharaan media, Docker Compose, contoh reverse proxy dan panduan tersedia di `docs/DEPLOYMENT.md`. Tidak ada hosting/domain/database/bucket eksternal milik pengguna yang dibuat atau diubah. Deployment publik, sertifikat HTTPS, koneksi TLS penyedia PostgreSQL, kebijakan bucket dan kapasitas layanan nyata memerlukan konfigurasi serta verifikasi pada akun hosting pengguna. Dukungan upload tidak berarti penyimpanan tanpa batas.

## Menu Sebar — 3 November 2026

Tes lokal: 40 lulus, 0 gagal, 2 dilewati karena PostgreSQL/S3 eksternal tidak disediakan untuk putaran ini. Tes baru mencakup penyimpanan penerima/template, validasi nama dan placeholder link, penolakan baca/tambah/hapus lintas pemilik, serta cascade delete. Migrasi SQLite lama tetap lulus dengan tiga versi schema.

Browser Chromium memeriksa tambah penerima, simpan pesan, kembali/muat ulang daftar, pratinjau WhatsApp yang dapat diedit, URL ter-encode dengan nama berisi ampersand, sapaan pada undangan publik tanpa login, serta overflow pada HP/desktop. Tidak membuka WhatsApp atau mengirim pesan nyata. Import/export memakai JSON dan template agama mengikuti pilihan acara, bukan jenis acara lain. Pengujian PostgreSQL/S3 terdahulu bukan klaim pengujian layanan eksternal ulang pada revisi ini.

## Tema Navy Ivory dan layout undangan — 4 November 2026

Tes lokal: 40 lulus, 0 gagal, 2 pengujian layanan eksternal dilewati. Tidak ada perubahan database pada revisi tampilan ini. Chromium memeriksa laptop 1440×1000, panel kanan bergulir tanpa menggerakkan latar kiri, sampul yang menyembunyikan isi sebelum tombol ditekan, nama penerima, HP/tablet 320/390/768 px tanpa overflow horizontal, dan RSVP berhasil setelah sampul dibuka. Tidak ditemukan JavaScript page error pada alur tersebut. Ilustrasi latar dibuat berdasarkan inspirasi referensi; foto warna polos dalam screenshot adalah fixture pengujian, bukan foto mempelai pengguna. Pengujian tidak mengklaim kesamaan piksel dengan referensi atau audit aksesibilitas menyeluruh.

## Intro dan Titip Hadiah — 4 November 2026

Tes lokal: 40 lulus, 0 gagal, dua tes PostgreSQL/S3 dilewati pada putaran ini. Format rekening lama tetap kompatibel ketika keterangan opsional tidak ada. Chromium memeriksa urutan intro setelah buka sampul, Galeri setelah Maps, Titip Hadiah tepat sebelum penutup, teks doa restu persis, tambah/edit/hapus rekening lewat dialog, penyimpanan dan pembacaan kembali keterangan, angka nol awal, salin nomor, tombol alamat kado fisik, dan tampilan HP/desktop tanpa overflow/page error pada alur yang diuji. Tidak ada transfer nyata. Screenshot memakai nama/nomor sintetis berlabel contoh.

## Great Vibes pada cover — 5 November 2026

Chromium memverifikasi font lokal benar-benar berhasil dimuat melalui FontFaceSet, nama cover memakai Great Vibes, serta lebar 320/390/1440 px dan nama panjang tidak menyebabkan overflow horizontal. Screenshot memakai data sintetis. Perubahan hanya CSS dan aset font berlisensi OFL; tes backend tidak diulang untuk perubahan tipografi ini.

## Float in dan timeline — 5 November 2026

Tes backend lokal: 40 lulus, 0 gagal; dua tes layanan eksternal dilewati. Chromium memeriksa elemen timeline sebelum/sesudah masuk viewport, observer panel laptop, posisi kiri/kanan bergantian, empat agenda fixture, lebar 320/390/1440 tanpa overflow/page error, serta reduced motion yang menampilkan elemen langsung. Deskripsi baru bersifat opsional dan mempertahankan format jadwal lama. Animasi memakai keyframes saat reveal agar elemen di luar layar tidak mengalami transisi fade-out awal.

## Label aksi, intro ayat dan RSVP — 5 November 2026

Chromium memeriksa label Preview/Bagikan/Hapus undangan/Keluar akun, membatalkan serta mengonfirmasi penghapusan draft QA, dan logout. Halaman pertama setelah buka sampul memakai Great Vibes untuk nama dari data mempelai serta kutipan Ar-Rum ayat 21 sesuai permintaan. RSVP publik berhasil tanpa input jumlah tamu; respons baru yang hadir dihitung satu, sementara jumlah pada respons lama dipertahankan saat status hadir tetap dipilih. Lebar 320/390/1440 diperiksa tanpa overflow horizontal atau page error. Screenshot memakai data sintetis. Syntax check frontend dan git diff check lulus; suite backend tidak diulang karena tidak ada perubahan backend.

## Musik saat buka undangan dan urutan pembuka — 5 November 2026

Chromium memverifikasi audio nyata mulai dan waktu pemutaran bergerak setelah klik Buka Undangan, jeda/putar kembali, penolakan play yang tetap membuka undangan dan mengaktifkan kembali tombol, serta undangan tanpa musik. Intro nama tidak lagi berisi ayat; bagian berikutnya menampilkan foto lalu kutipan Ar-Rum, diikuti halaman WITH LOVE dan salam pembuka sesuai teks permintaan. Lebar 320/390/1440 tanpa overflow horizontal atau page error. Screenshot memakai data sintetis. Syntax check frontend dan git diff check lulus; backend tidak berubah. Pemutaran bergantung pada interaksi Buka Undangan dan kebijakan browser/perangkat; tidak mengklaim autoplay bersuara sebelum interaksi.

## WITH LOVE halaman keempat dan judul mempelai — 5 November 2026

Urutan setelah sampul dibuka: weddingIntro, weddingVerse, saveDate, withLove, couple. Chromium memeriksa WITH LOVE hanya muncul satu kali tepat sebelum Bride & Groom, salam pembuka tetap ada, judul mempelai menggunakan Great Vibes dan font benar-benar termuat. Lebar 320/390/1440 tanpa overflow horizontal atau page error. Screenshot memakai data sintetis. Syntax check dan git diff check lulus; backend tidak berubah.

## WhatsApp dan Sampai Selesai — 5 November 2026

Pengujian backend mencakup persistensi pilihan waktu selesai, status ready tanpa jam akhir jika Sampai Selesai dipilih, penolakan tipe salah/jam terbalik, metadata Open Graph tanpa JavaScript, escape judul, foto sampul publik tanpa login, penolakan preview draft, kalender tanpa jam akhir, dan penyimpanan placeholder link_undangan. Pengujian pesan mencakup format Islam, salam agama lain, hari/tanggal, zona waktu, waktu pasti/Selesai dan substitusi satu kali untuk nama penerima. Chromium memeriksa simpan/muat ulang, pesan personal terenkode, preview foto dalam dialog, alias template tersimpan, timeline publik, serta lebar 320/390/1440 tanpa overflow horizontal/page error. Screenshot memakai data sintetis. Tidak mengirim WhatsApp nyata atau mengklaim pratinjau kartu sudah diverifikasi oleh crawler WhatsApp; perlu domain publik HTTPS. Tes PostgreSQL/S3 eksternal tetap dilewati.

## Entry point Hostinger — 6 November 2026

Server startup dipisahkan dari factory app.js. Dua subprocess terisolasi memverifikasi eksekusi langsung dan require oleh loader, GET /healthz serta shutdown SIGTERM. Keduanya selesai di bawah 0,2 detik pada pengujian lokal ini; tidak menyatakan latensi Hostinger. Suite: 44 lulus, 0 gagal, 2 tes layanan eksternal dilewati. Pemeriksaan sintaks dan git diff check lulus. .env pribadi tidak dilacak, tidak dimasukkan ke commit/ZIP, dan tidak diunggah. Deployment Hostinger belum dijalankan dari lingkungan ini.

## Admin pemilik dan pustaka musik — 6 November 2026

Suite backend lokal: 45 lulus, 0 gagal, 2 layanan eksternal dilewati. Tes baru mencakup penolakan akses admin/CSRF/unggah-hapus pengguna biasa, audio palsu, pustaka bersama, pilihan musik pengguna, HTTP Range publik hanya saat lagu dipakai undangan ready, perlindungan lagu aktif, penghapusan/cleanup, koreksi tanggal beserta jadwal yang relevan, konflik editor lama, pencarian, audit, dan pencabutan hak admin. Migrasi lama tetap idempoten dan tidak menghapus lagu lama.

Chromium menguji pemberian hak melalui CLI ke akun QA, koreksi tanggal via dialog, unggah/hapus pustaka, penolakan hapus lagu yang masih dipakai, pilihan lagu di editor pelanggan tanpa kontrol upload, penolakan halaman admin untuk pelanggan, lebar 320/390/1440 tanpa overflow horizontal atau JavaScript page error. Screenshot memakai data sintetis. Tampilan audit memakai label dan ringkasan yang terbaca. Hostinger tidak dideploy dari lingkungan ini; admin produksi perlu dipromosikan lewat perintah server pada database yang benar. PostgreSQL/S3 eksternal tidak diuji pada putaran ini. .env pribadi tidak ditambahkan ke Git.

## Katalog berbayar, transfer manual dan sekali pakai — 6 November 2026

Backend: suite lengkap 47 lulus, 0 gagal, 2 tes layanan eksternal dilewati. Pengujian pembayaran memakai rekening/harga fiktif dan clock terisolasi; tidak ada transfer bank nyata. Tes mencakup penolakan pembuatan undangan gratis pada factory produksi, katalog/preview, konfigurasi admin, snapshot harga/rekening, order berulang, konfirmasi/reject/konfirmasi ulang, CSRF/kepemilikan, bukti privat, persetujuan simultan dan idempotensi, referensi mutasi ganda, pembatalan, transfer terlambat, satu order satu undangan, aktivasi eksplisit, tema/tanggal/zona waktu terkunci, koreksi admin beserta expiry, arsip tetap terbaca, dan penolakan publik/RSVP/kalender/media/edit tepat pada batas waktu. WIB/WITA/WIT diuji terpisah. Pengujian lama memakai opsi factory internal khusus fixture agar alur media/auth tetap dapat diuji tanpa checkout; opsi tersebut tidak tersedia sebagai environment atau API produksi.

Chromium memeriksa katalog dua tema dan tombol Preview/Select, preview ilustrasi tanpa pengiriman RSVP, SVG Sakura dengan tiga kupu-kupu, reduced motion, checkout, nomor WhatsApp, konfirmasi pelanggan, persetujuan melalui dialog admin, aktivasi dan input tanggal terkunci. Alur Select → login → kembali ke pesanan juga diperiksa. Lebar 320/390/1440 tanpa overflow horizontal atau JavaScript page error pada alur tersebut. Screenshot harga/rekening adalah fixture fiktif berlabel QA; penjualan produksi default nonaktif dan harga 0 sampai diisi pemilik. Ilustrasi Sakura adalah vektor orisinal terinspirasi referensi, bukan salinan gambar sumber.

Migrasi 005 mempertahankan seluruh undangan yang sudah ada sebagai legacy tanpa expiry retroaktif. Impor database dan sinkronisasi storage mencakup order, lisensi, konfigurasi, dan bukti pembayaran. PostgreSQL/S3 eksternal serta deployment Hostinger nyata belum dijalankan pada putaran ini. .env pribadi tidak dimasukkan ke kode/commit.

## Logout, akses admin lokal, banyak acara, harga per tema — 6 November 2026

Suite lokal: 48 lulus, 0 gagal, 2 layanan eksternal dilewati. Tes baru menggunakan factory produksi (tanpa bypass fixture) dan membuktikan dua draft dengan tema sama mendapat dua invoice terpisah, klik ulang pada acara yang sama tetap idempoten, persetujuan hanya mengaktifkan satu acara terkait, tidak ada acara duplikat saat approve, kepemilikan eventId diperiksa, invoice paid tidak dapat digunakan ulang, unpaid tidak dapat mengunci tanggal, dan nama acara tampil pada invoice. Harga normal yang lebih rendah dari harga jual ditolak. Logout menghapus sesi, mendukung sesi habis, tetap menolak CSRF salah/origin lintas situs dan menerima origin host lokal dengan CSRF valid.

Chromium: panduan admin lokal, CLI grant dan periksa ulang peran, Select Sakura saat belum dikonfigurasi (informasi jelas), pengaturan harga/promo per tema, dua acara untuk pasangan berbeda dari satu akun, dua order Sakura, hanya satu acara dibayar, dashboard kartu 320/390/1440 tanpa overflow atau page error. Simulasi putus jaringan pada logout menampilkan feedback dan mengaktifkan kembali tombol; retry menghapus sesi dan menuju login. Screenshot memakai akun, harga dan rekening fiktif. Hostinger/layanan PostgreSQL/S3 tidak diuji langsung pada putaran ini. .env pribadi tidak ditambahkan ke Git.

## Bagikan di kartu dan harga pengguna — 7 November 2026

Tombol Bagikan ditambahkan di sebelah Tetapkan tanggal/Lengkapi acara pada kartu yang sudah dibayar. Pemeriksaan kesiapan tetap berlaku; aktivasi tanggal yang belum selesai menampilkan petunjuk, dan acara ready membuka alur Sebar. Harga katalog/checkout memakai harga jual merah dan harga normal abu-abu dicoret (hanya bila lebih tinggi), format Rp. dengan pemisah ribuan Indonesia. Chromium memeriksa urutan tombol, petunjuk aktivasi, pemanggilan Sebar untuk acara ready, warna/strikethrough/format harga, kondisi tanpa harga normal, serta lebar 320/390/1440 tanpa overflow/page error. Screenshot harga menggunakan nilai contoh dari referensi, bukan perubahan konfigurasi harga penjual. Syntax check dan git diff check lulus; suite backend tidak diulang karena perubahan terbatas pada presentasi dan handler frontend.
