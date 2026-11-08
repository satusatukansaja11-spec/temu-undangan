(function (root) {
  const features = [
    ["Pilih dari seluruh katalog tema", true, true],
    ["Nama tamu & sebar WhatsApp", true, true],
    ["Dashboard buat/edit sendiri", true, true],
    ["RSVP, ucapan & emoji", true, true],
    ["Tautan lokasi Maps", true, true],
    ["Countdown & simpan kalender", true, true],
    ["Galeri foto", "10 foto", "20 foto"],
    ["Titip kado fisik & rekening", true, true],
    ["Musik dari pustaka admin", true, true],
    ["Revisi selama masa aktif", true, true],
    ["Love Story", false, true],
    ["Tautan video / live streaming", false, true],
    ["Tombol gulir otomatis", false, true],
    ["Peta Google Maps di undangan", false, true],
    ["Pilihan font nama mempelai", false, true],
    ["Warna aksen pilihan sendiri", false, true],
  ];
  const pending = ["QR check-in tamu", "Balasan ucapan oleh mempelai"];
  const api = { features, pending };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TEMU_PACKAGE_FEATURES = api;
})(typeof window !== "undefined" ? window : globalThis);
