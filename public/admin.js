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
  "theme.ornament.add": "Ornamen tema ditambahkan",
  "theme.ornament.update": "Ornamen tema diperbarui",
  "theme.ornament.delete": "Ornamen tema dihapus",
  "music.upload": "Lagu ditambahkan",
  "music.delete": "Lagu dihapus",
  "admin.grant": "Akses admin diberikan",
  "admin.revoke": "Akses admin dicabut",
  "order.approve": "Pembayaran disetujui",
  "order.bank": "Pembeli mengganti bank tujuan",
  "order.reject": "Konfirmasi pembayaran ditolak",
  "shop.update": "Pengaturan penjualan diperbarui",
  "event.activate": "Tanggal diaktifkan",
};
let adminPage = 1,
  adminQuery = "",
  adminView = "overview";
async function renderAdmin() {
  document.title = "Panel Admin — Temu";
  shell(
    `<main class="admin-panel"><a href="/dashboard" class="text-button">← Dashboard undangan</a><div class="page-heading"><div><p class="eyebrow">KHUSUS PEMILIK</p><h1>Panel admin</h1><p>Bantu pelanggan dan kelola musik untuk seluruh undangan.</p></div></div><p id="adminFeedback" role="status">Memuat data…</p><div id="adminContent"></div></main>`,
  );
  try {
    const [listing, tracks, audit, overview] = await Promise.all([
      api(
        "/api/admin/events?q=" +
          encodeURIComponent(adminQuery) +
          "&page=" +
          adminPage,
      ),
      api("/api/admin/music"),
      api("/api/admin/audit"),
      api("/api/admin/overview"),
    ]);
    document.querySelector("#adminFeedback").textContent =
      window.appOrigin && window.appOrigin !== location.origin
        ? `Konfigurasi APP_URL (${window.appOrigin}) berbeda dari alamat ini (${location.origin}). Untuk localhost, ubah APP_URL menjadi ${location.origin} dan restart Node.js sebelum menyimpan pengaturan.`
        : "";
    document.querySelector("#adminContent").innerHTML =
      `<section class="admin-section" id="adminEvents"><h2>Bantuan tanggal undangan</h2><p>Koreksi tanggal utama juga memindahkan jadwal tambahan yang bertanggal sama. Jadwal di hari lain tetap dipertahankan.</p><form id="adminSearch" class="admin-search"><label for="adminQuery">Cari nama, email, atau undangan<input id="adminQuery" type="search" maxlength="100" value="${esc(adminQuery)}"></label><button>Cari</button></form><div class="admin-event-list">${listing.events.length ? listing.events.map((e) => `<article><div><h3>${esc(e.name || "Undangan baru")}</h3><p>${esc(e.ownerName)} · ${esc(e.ownerEmail)}</p><p>Tanggal: <strong>${esc(e.date || "Belum diisi")}</strong> · ${esc(e.timezone || "Asia/Jakarta")} · ${esc(e.status === "expired" ? "Masa aktif berakhir" : e.status === "ready" ? "Siap dibagikan" : "Draft")}</p></div><button ${e.status === "expired" ? "disabled" : ""} data-correct-date="${esc(e.id)}">${e.status === "expired" ? "Arsip kedaluwarsa" : "Koreksi tanggal"}</button></article>`).join("") : "<p>Tidak ada undangan yang cocok.</p>"}</div><div class="admin-pagination"><button id="adminPrev" ${listing.page <= 1 ? "disabled" : ""}>Sebelumnya</button><span>Halaman ${listing.page} · ${listing.total} undangan</span><button id="adminNext" ${listing.page * 20 >= listing.total ? "disabled" : ""}>Berikutnya</button></div></section><section class="admin-section" id="adminMusic"><h2>Pustaka musik bersama</h2><p>Lagu di sini dapat dipilih semua pelanggan. Unggah hanya musik yang Anda memiliki izin penggunaannya. Maksimal ${appLimits.audioMB} MB dan 30 menit per lagu.</p><form id="adminMusicForm"><label for="adminTrackName">Judul lagu<input id="adminTrackName" name="name" maxlength="140" required></label><label for="adminTrackFile">File MP3, M4A, OGG, atau WAV<input id="adminTrackFile" name="audio" type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav" required></label><button class="primary" id="adminUpload">Unggah lagu</button><p id="adminMusicFeedback" role="status"></p></form><div class="admin-track-list">${tracks.length ? tracks.map((t) => `<article><h3>${esc(t.name)}</h3><p>${Math.round(t.duration)} detik · ${readableBytes(t.size_bytes)}</p><audio controls preload="none" src="/audio/${esc(t.id)}" aria-label="Pratinjau ${esc(t.name)}"></audio><button data-remove-library="${esc(t.id)}">Hapus lagu</button></article>`).join("") : "<p>Belum ada lagu unggahan. Pelanggan tetap dapat memilih Melodi Temu atau tanpa musik.</p>"}</div><p>Lagu yang masih digunakan undangan dilindungi dari penghapusan agar musik pelanggan tidak terputus.</p></section><section class="admin-section" id="adminActivity"><h2>Riwayat tindakan admin</h2><p>50 tindakan terbaru. Koreksi tanggal menyimpan alasan dan tanggal sebelum/sesudah.</p><div class="admin-audit">${audit.map((a) => `<article><strong>${esc(adminActionNames[a.action] || "Tindakan pengelola")}</strong><small>${esc(a.created)} · ${esc(a.actor_name || "Pengelola server")}</small>${adminAuditDetails(a)}</article>`).join("") || "<p>Belum ada riwayat.</p>"}</div></section><dialog id="dateCorrection" class="bank-dialog"><form id="dateCorrectionForm"><h2>Koreksi tanggal</h2><p id="dateCorrectionSummary"></p><label for="correctedDate">Tanggal pernikahan baru<input id="correctedDate" name="date" type="date" required></label><label for="correctionReason">Alasan koreksi<textarea id="correctionReason" name="reason" minlength="5" maxlength="1000" rows="3" required></textarea></label><p id="dateCorrectionFeedback" role="alert"></p><div class="actions"><button type="button" id="cancelCorrection">Batal</button><button class="primary" id="submitCorrection">Simpan koreksi</button></div></form></dialog>`;
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
        toast("Tanggal dikoreksi dan dicatat.", "success");
      } catch (error) {
        toast(error.message || "Tindakan gagal. Coba kembali.", "error");

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
        toast("File melebihi batas ukuran.", "warning");
        return;
      }
      const form = new FormData(e.target);
      busy++;
      b.disabled = true;
      feedback.textContent = "Mengunggah dan memeriksa audio…";
      try {
        await api("/api/admin/music", { method: "POST", body: form });
        await renderAdmin();
        toast("Lagu ditambahkan ke pustaka pelanggan.", "success");
      } catch (error) {
        toast(error.message || "Tindakan gagal. Coba kembali.", "error");

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
              "success",
            );
          } catch (error) {
            document.querySelector("#adminFeedback").textContent =
              error.message;
            toast(error.message, "error");
          } finally {
            b.disabled = false;
          }
        }),
    );
    await mountAdminShop();
    await mountThemeAssets();
    mountAdminWorkspace(overview, tracks, audit);
  } catch (error) {
    toast(error.message || "Tindakan gagal. Coba kembali.", "error");

    document.querySelector("#adminFeedback").textContent = error.message;
  }
}

function adminIcon(name) {
  const shapes = {
    overview:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    orders: '<path d="M5 5h14v16H5zM9 3v4m6-4v4M8 11h8m-8 4h6"/>',
    events:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    music:
      '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
    pricing: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7" cy="7" r="1"/>',
    backgrounds:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="16" cy="8" r="2"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${shapes[name] || shapes.overview}</svg>`;
}
function mountAdminWorkspace(stats, tracks, audit) {
  const panel = document.querySelector(".admin-panel"),
    shellRoot = document.querySelector("#app");
  shellRoot.classList.add("admin-shell");
  const nav = shellRoot.querySelector("aside nav");
  const tabs = [
    ["overview", "Ringkasan"],
    ["orders", "Pesanan"],
    ["events", "Undangan"],
    ["music", "Pustaka musik"],
    ["pricing", "Rekening & harga"],
    ["backgrounds", "Menu latar"],
    ["activity", "Aktivitas"],
  ];
  nav.innerHTML =
    tabs
      .map(
        ([id, label]) =>
          `<a class="admin-nav" data-admin-view="${id}" href="#${id}">${adminIcon(id)}<span>${label}</span>${id === "orders" && stats.pending ? `<b>${stats.pending}</b>` : ""}</a>`,
      )
      .join("") +
    '<a class="admin-nav customer-dashboard" href="/dashboard">← Dashboard pengguna</a>';
  shellRoot.querySelector(".workspace").textContent = "PANEL PEMILIK";
  shellRoot.querySelector(".user small").textContent = "Pemilik website";
  shellRoot.querySelector(".aside-bottom").innerHTML =
    '<img src="/assets/admin-studio.svg" alt="" width="160" height="110"><h3>Ruang cerita bahagia.</h3><a href="/" target="_blank" rel="noopener">Lihat website ↗</a>';
  shellRoot.querySelector("header").innerHTML =
    `<span>Workspace <i>/</i> <b>Admin Temu</b></span><a class="admin-owner" href="/dashboard"><span class="avatar">${esc((me.name || "A")[0])}</span>${esc(me.name)}</a>`;
  panel.querySelector(".page-heading").remove();
  panel.querySelector(":scope > a.text-button").remove();
  panel.insertAdjacentHTML(
    "afterbegin",
    `<div class="admin-topline"><p class="eyebrow">TEMU / OWNER STUDIO</p><time>${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date())}</time></div><div class="admin-workspace"><div class="admin-center"><section class="admin-welcome" id="adminWelcome"><div><p>Selamat datang, ${esc(me.name)}.</p><h1>Di balik setiap<br>cerita bahagia.</h1><p>Kelola undangan, bantu pelanggan,<br>dan siapkan hari istimewa mereka.</p><a class="button primary" href="#orders" data-admin-shortcut="orders">Periksa pesanan ${adminIcon("orders")}</a></div><img src="/assets/admin-studio.svg" alt="" width="290" height="240"></section><section class="admin-metrics" aria-label="Ringkasan website"><div><span>Undangan</span><strong>${stats.events}</strong></div><div><span>Pelanggan</span><strong>${stats.customers}</strong></div><div><span>Pesanan</span><strong>${stats.orders}</strong></div></section></div><aside class="admin-detail" aria-label="Ringkasan pengelolaan"><p class="eyebrow">PUSAT PENGELOLAAN</p><h2>Setiap momen,<br>terkelola baik.</h2><p>Ringkasan langsung dari data website Anda.</p><div class="admin-detail-stat">${adminIcon("orders")}<div><small>Perlu verifikasi</small><strong>${stats.pending} pembayaran</strong></div></div><div class="admin-detail-stat">${adminIcon("pricing")}<div><small>Pembayaran disetujui</small><strong>${rupiah(stats.revenue)}</strong></div></div><div class="admin-detail-stat">${adminIcon("music")}<div><small>Pustaka bersama</small><strong>${tracks.length} lagu unggahan</strong></div></div><a class="button primary" href="#backgrounds" data-admin-shortcut="backgrounds">Atur latar tema →</a><div class="admin-recent"><h3>Aktivitas terbaru</h3>${
      audit
        .slice(0, 3)
        .map(
          (a) =>
            `<p><strong>${esc(adminActionNames[a.action] || "Tindakan pengelola")}</strong><small>${esc(new Date(a.created).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }))}</small></p>`,
        )
        .join("") || "<p>Belum ada aktivitas.</p>"
    }</div></aside></div>`,
  );
  const center = panel.querySelector(".admin-center");
  center.append(
    document.querySelector("#adminFeedback"),
    document.querySelector("#adminContent"),
  );
  const sections = {
    orders: "adminOrders",
    events: "adminEvents",
    music: "adminMusic",
    pricing: "adminPricing",
    backgrounds: "adminBackgrounds",
    activity: "adminActivity",
  };
  function show(view, update = false) {
    if (!tabs.some(([id]) => id === view)) view = "overview";
    adminView = view;
    shellRoot.dataset.adminScreen = view;
    for (const [key, id] of Object.entries(sections))
      document.getElementById(id).hidden =
        view === "overview"
          ? !["orders", "events"].includes(key)
          : key !== view;
    document.querySelector("#adminWelcome").hidden = view !== "overview";
    document.querySelectorAll("[data-admin-view]").forEach((a) => {
      const active = a.dataset.adminView === view;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (update) history.replaceState({}, "", location.pathname + "#" + view);
  }
  nav.querySelectorAll("[data-admin-view]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        show(a.dataset.adminView, true);
      }),
  );
  panel.querySelectorAll("[data-admin-shortcut]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        show(a.dataset.adminShortcut, true);
      }),
  );
  const hash = location.hash.slice(1);
  show(hash === "themePricing" ? "pricing" : hash || adminView);
}
