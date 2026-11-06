function adminAuditDetails(entry) {
  const details = JSON.parse(entry.details);
  if (entry.action === "event.date")
    return `<p>Tanggal: ${esc(details.before || "Belum diisi")} → ${esc(details.after)}</p><p>Alasan: ${esc(details.reason)}</p><p>${(details.changedSchedules || []).length} jadwal tambahan disesuaikan.</p>`;
  if (entry.action.startsWith("music."))
    return `<p>Lagu: ${esc(details.name || "Lagu pustaka")}</p>`;
  if (entry.action.startsWith("order."))
    return `<p>Pesanan: ${esc(entry.target)}</p>${details.amount ? `<p>Nominal: ${rupiah(details.amount)}</p>` : ""}${details.reason ? `<p>Alasan: ${esc(details.reason)}</p>` : ""}`;
  if (entry.action === "event.activate")
    return `<p>Tanggal: ${esc(details.date)} · ${esc(details.timezone)}</p>`;
  if (entry.action === "shop.update")
    return `<p>Penjualan ${details.enabled ? "diaktifkan" : "dinonaktifkan"}.</p>`;
  return "";
}
const adminActionNames = {
  "event.date": "Koreksi tanggal undangan",
  "music.upload": "Lagu ditambahkan",
  "music.delete": "Lagu dihapus",
  "admin.grant": "Akses admin diberikan",
  "admin.revoke": "Akses admin dicabut",
  "order.approve": "Pembayaran disetujui",
  "order.reject": "Konfirmasi pembayaran ditolak",
  "shop.update": "Pengaturan penjualan diperbarui",
  "event.activate": "Tanggal diaktifkan",
};
let adminPage = 1,
  adminQuery = "";
async function renderAdmin() {
  document.title = "Panel Admin — Temu";
  shell(
    `<main class="admin-panel"><a href="/dashboard" class="text-button">← Dashboard undangan</a><div class="page-heading"><div><p class="eyebrow">KHUSUS PEMILIK</p><h1>Panel admin</h1><p>Bantu pelanggan dan kelola musik untuk seluruh undangan.</p></div></div><p id="adminFeedback" role="status">Memuat data…</p><div id="adminContent"></div></main>`,
  );
  try {
    const [listing, tracks, audit] = await Promise.all([
      api(
        "/api/admin/events?q=" +
          encodeURIComponent(adminQuery) +
          "&page=" +
          adminPage,
      ),
      api("/api/admin/music"),
      api("/api/admin/audit"),
    ]);
    document.querySelector("#adminFeedback").textContent =
      window.appOrigin && window.appOrigin !== location.origin
        ? `Konfigurasi APP_URL (${window.appOrigin}) berbeda dari alamat ini (${location.origin}). Untuk localhost, ubah APP_URL menjadi ${location.origin} dan restart Node.js sebelum menyimpan pengaturan.`
        : "";
    document.querySelector("#adminContent").innerHTML =
      `<section class="admin-section"><h2>Bantuan tanggal undangan</h2><p>Koreksi tanggal utama juga memindahkan jadwal tambahan yang bertanggal sama. Jadwal di hari lain tetap dipertahankan.</p><form id="adminSearch" class="admin-search"><label for="adminQuery">Cari nama, email, atau undangan<input id="adminQuery" type="search" maxlength="100" value="${esc(adminQuery)}"></label><button>Cari</button></form><div class="admin-event-list">${listing.events.length ? listing.events.map((e) => `<article><div><h3>${esc(e.name || "Undangan baru")}</h3><p>${esc(e.ownerName)} · ${esc(e.ownerEmail)}</p><p>Tanggal: <strong>${esc(e.date || "Belum diisi")}</strong> · ${esc(e.timezone || "Asia/Jakarta")} · ${esc(e.status === "expired" ? "Masa aktif berakhir" : e.status === "ready" ? "Siap dibagikan" : "Draft")}</p></div><button ${e.status === "expired" ? "disabled" : ""} data-correct-date="${esc(e.id)}">${e.status === "expired" ? "Arsip kedaluwarsa" : "Koreksi tanggal"}</button></article>`).join("") : "<p>Tidak ada undangan yang cocok.</p>"}</div><div class="admin-pagination"><button id="adminPrev" ${listing.page <= 1 ? "disabled" : ""}>Sebelumnya</button><span>Halaman ${listing.page} · ${listing.total} undangan</span><button id="adminNext" ${listing.page * 20 >= listing.total ? "disabled" : ""}>Berikutnya</button></div></section><section class="admin-section"><h2>Pustaka musik bersama</h2><p>Lagu di sini dapat dipilih semua pelanggan. Unggah hanya musik yang Anda memiliki izin penggunaannya. Maksimal ${appLimits.audioMB} MB dan 30 menit per lagu.</p><form id="adminMusicForm"><label for="adminTrackName">Judul lagu<input id="adminTrackName" name="name" maxlength="140" required></label><label for="adminTrackFile">File MP3, M4A, OGG, atau WAV<input id="adminTrackFile" name="audio" type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav" required></label><button class="primary" id="adminUpload">Unggah lagu</button><p id="adminMusicFeedback" role="status"></p></form><div class="admin-track-list">${tracks.length ? tracks.map((t) => `<article><h3>${esc(t.name)}</h3><p>${Math.round(t.duration)} detik · ${readableBytes(t.size_bytes)}</p><audio controls preload="none" src="/audio/${esc(t.id)}" aria-label="Pratinjau ${esc(t.name)}"></audio><button data-remove-library="${esc(t.id)}">Hapus lagu</button></article>`).join("") : "<p>Belum ada lagu unggahan. Pelanggan tetap dapat memilih Melodi Temu atau tanpa musik.</p>"}</div><p>Lagu yang masih digunakan undangan dilindungi dari penghapusan agar musik pelanggan tidak terputus.</p></section><section class="admin-section"><h2>Riwayat tindakan admin</h2><p>50 tindakan terbaru. Koreksi tanggal menyimpan alasan dan tanggal sebelum/sesudah.</p><div class="admin-audit">${audit.map((a) => `<article><strong>${esc(adminActionNames[a.action] || "Tindakan pengelola")}</strong><small>${esc(a.created)} · ${esc(a.actor_name || "Pengelola server")}</small>${adminAuditDetails(a)}</article>`).join("") || "<p>Belum ada riwayat.</p>"}</div></section><dialog id="dateCorrection" class="bank-dialog"><form id="dateCorrectionForm"><h2>Koreksi tanggal</h2><p id="dateCorrectionSummary"></p><label for="correctedDate">Tanggal pernikahan baru<input id="correctedDate" name="date" type="date" required></label><label for="correctionReason">Alasan koreksi<textarea id="correctionReason" name="reason" minlength="5" maxlength="1000" rows="3" required></textarea></label><p id="dateCorrectionFeedback" role="alert"></p><div class="actions"><button type="button" id="cancelCorrection">Batal</button><button class="primary" id="submitCorrection">Simpan koreksi</button></div></form></dialog>`;
    document.querySelector("#adminSearch").onsubmit = (e) => {
      e.preventDefault();
      adminQuery = document.querySelector("#adminQuery").value;
      adminPage = 1;
      renderAdmin();
    };
    document.querySelector("#adminPrev").onclick = () => {
      adminPage--;
      renderAdmin();
    };
    document.querySelector("#adminNext").onclick = () => {
      adminPage++;
      renderAdmin();
    };
    const dialog = document.querySelector("#dateCorrection");
    let selected;
    document.querySelectorAll("[data-correct-date]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = listing.events.find((e) => e.id === b.dataset.correctDate);
          document.querySelector("#dateCorrectionSummary").textContent =
            (selected.name || "Undangan baru") + " · " + selected.ownerEmail;
          document.querySelector("#correctedDate").value = selected.date || "";
          document.querySelector("#correctionReason").value = "";
          document.querySelector("#dateCorrectionFeedback").textContent = "";
          dialog.showModal();
        }),
    );
    document.querySelector("#cancelCorrection").onclick = () => dialog.close();
    document.querySelector("#dateCorrectionForm").onsubmit = async (e) => {
      e.preventDefault();
      const b = document.querySelector("#submitCorrection");
      b.disabled = true;
      try {
        await api("/api/admin/events/" + selected.id + "/date", {
          method: "PATCH",
          body: JSON.stringify({
            date: document.querySelector("#correctedDate").value,
            reason: document.querySelector("#correctionReason").value,
            expectedUpdated: selected.updated,
          }),
        });
        dialog.close();
        await renderAdmin();
        toast("Tanggal dikoreksi dan dicatat.");
      } catch (error) {
        document.querySelector("#dateCorrectionFeedback").textContent =
          error.message;
      } finally {
        b.disabled = false;
      }
    };
    document.querySelector("#adminMusicForm").onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      const file = document.querySelector("#adminTrackFile").files[0],
        b = document.querySelector("#adminUpload"),
        feedback = document.querySelector("#adminMusicFeedback");
      if (file.size > appLimits.audioMB * 1024 * 1024) {
        feedback.textContent = "File melebihi batas ukuran.";
        return;
      }
      const form = new FormData(e.target);
      busy++;
      b.disabled = true;
      feedback.textContent = "Mengunggah dan memeriksa audio…";
      try {
        await api("/api/admin/music", { method: "POST", body: form });
        await renderAdmin();
        toast("Lagu ditambahkan ke pustaka pelanggan.");
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        busy--;
        b.disabled = false;
      }
    };
    document.querySelectorAll("[data-remove-library]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (
            !confirm(
              "Hapus lagu dari pustaka bersama? Lagu yang masih dipakai tidak dapat dihapus.",
            )
          )
            return;
          b.disabled = true;
          try {
            const result = await api(
              "/api/admin/music/" + b.dataset.removeLibrary,
              { method: "DELETE" },
            );
            await renderAdmin();
            toast(
              result.cleanupPending
                ? "Lagu dinonaktifkan. Pembersihan file menunggu penyimpanan."
                : "Lagu dihapus.",
            );
          } catch (error) {
            document.querySelector("#adminFeedback").textContent =
              error.message;
            toast(error.message);
          } finally {
            b.disabled = false;
          }
        }),
    );
    await mountAdminShop();
    if (location.hash)
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: "start" });
  } catch (error) {
    document.querySelector("#adminFeedback").textContent = error.message;
  }
}
