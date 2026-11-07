function eventDashboardCard(e) {
  const paid = !e.license || e.license.paid,
    expired = e.status === "expired";
  const status = expired
    ? "Masa aktif berakhir"
    : !paid
      ? "Belum aktif"
      : e.status === "ready"
        ? "Aktif"
        : e.license?.lockedDate
          ? "Lengkapi data acara"
          : "Sudah dibayar";
  const payLink =
    e.license?.orderId &&
    ["pending_payment", "awaiting_verification", "rejected"].includes(
      e.license.orderStatus,
    )
      ? "/pesanan/" + e.license.orderId
      : "/pesanan?acara=" + e.id;
  const action = expired
    ? "<span>Arsip baca saja</span>"
    : !paid
      ? `<a class="button event-pay" href="${esc(payLink)}">${e.license?.orderStatus === "awaiting_verification" ? "Cek pembayaran" : "Aktifkan / Bayar"}</a>`
      : e.status === "ready"
        ? `<button class="event-share" data-share="${esc(e.id)}">Bagikan</button>`
        : `<button class="event-pay" data-edit="${esc(e.id)}">${e.license?.lockedDate ? "Lengkapi acara" : "Tetapkan tanggal"}</button><button class="event-share" data-share="${esc(e.id)}">Bagikan</button>`;
  return `<article class="card event-card"><details class="event-menu"><summary aria-label="Menu ${esc(e.name || "undangan")}">⋮</summary><button data-delete="${esc(e.id)}">Hapus undangan</button></details><h3>${esc(e.name || "Undangan baru")}</h3><div class="event-summary"><img class="event-portrait" src="${esc(e.cover || "/assets/demo-couple.svg")}" alt="${e.cover ? "Foto acara" : "Ilustrasi — foto belum diisi"}"><div><p>Status: <strong class="event-state ${paid ? "paid" : "unpaid"}">${status}</strong></p><p>Tanggal: ${e.date ? date(e.date) : "Belum ditetapkan"}</p><p>Tema: ${esc(themeNames[e.theme] || "Navy Ivory")}</p>${e.license?.orderId ? `<a href="/pesanan/${esc(e.license.orderId)}">Lihat pembayaran acara</a>` : ""}</div></div><div class="event-links">${!paid ? `<a href="/pesanan?acara=${esc(e.id)}">Pilih tema</a>` : ""}<a href="${paid ? "/preview/" + esc(e.id) : "/tema/" + esc(e.theme || "navy")}" target="_blank" rel="noopener">${paid ? "Preview undangan" : "Preview tema"}</a></div><div class="event-card-actions"><button data-edit="${esc(e.id)}">${expired ? "Lihat arsip" : "Edit form"}</button>${action}</div></article>`;
}
function openNewEvent() {
  let dialog = document.querySelector("#newEventDialog");
  if (dialog) dialog.remove();
  dialog = document.createElement("dialog");
  dialog.id = "newEventDialog";
  dialog.className = "bank-dialog";
  dialog.innerHTML = `<form id="newEventForm"><h2>Tambah acara</h2><p>Satu akun dapat mengelola banyak acara, termasuk pernikahan orang lain. Setiap acara memiliki pembayaran sendiri.</p><label>Nama acara<input name="name" placeholder="Pernikahan Rudi & Dian" maxlength="120" required></label><label>Tanggal rencana (opsional)<input name="date" type="date"></label><p id="newEventError" role="alert"></p><div class="actions"><button type="button" id="cancelNewEvent">Batal</button><button class="primary" id="createEvent">Buat acara</button></div></form>`;
  document.body.append(dialog);
  dialog.showModal();
  document.querySelector("#cancelNewEvent").onclick = () => dialog.close();
  document.querySelector("#newEventForm").onsubmit = async (e) => {
    e.preventDefault();
    const b = document.querySelector("#createEvent");
    b.disabled = true;
    try {
      const event = await api("/api/events", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
      });
      dialog.close();
      dirty = false;
      step = 0;
      await edit(event.id);
    } catch (error) {
      document.querySelector("#newEventError").textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
}
function renderAdminAccess() {
  document.title = "Aktivasi akses admin — Temu";
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  root.innerHTML = `<main class="admin-access"><a href="/dashboard">← Dashboard</a><h1>Akun ini belum memiliki akses admin</h1><p>Login: <strong>${esc(me.email)}</strong>. Akses admin diberikan melalui terminal server kepada akun pemilik, bukan otomatis kepada setiap pengguna.</p><ol><li>${local ? "Buka terminal VS Code pada folder proyek. Jalankan aplikasi melalui Node.js, lalu buka " + esc(location.origin) + "/admin." : "Buka terminal hosting pada folder aplikasi."}</li><li>Pastikan terminal menggunakan database dan DATA_DIR yang sama dengan aplikasi.</li><li>Jalankan perintah berikut, lalu muat ulang halaman ini:</li></ol><pre>npm run admin:grant -- ${esc(me.email)}</pre>${local ? `<p>Jika .env masih memakai domain hosting, atur untuk pengujian lokal:</p><pre>APP_URL=${esc(location.origin)}\nNODE_ENV=development</pre><p>Restart Node.js sesudah mengubah .env. Jangan mengganti database atau menghapus folder data.</p>` : ""}<button class="primary" id="recheckAdmin">Saya sudah memberi akses, periksa ulang</button><p id="adminAccessFeedback" role="status"></p></main>`;
  document.querySelector("#recheckAdmin").onclick = async () => {
    try {
      const info = await api("/api/me");
      me = info.user;
      csrf = info.csrf;
      if (me?.isAdmin) renderAdmin();
      else
        document.querySelector("#adminAccessFeedback").textContent =
          "Hak admin belum ditemukan di database aplikasi ini. Periksa email dan konfigurasi database terminal.";
    } catch (e) {
      toast(e.message);
    }
  };
}
