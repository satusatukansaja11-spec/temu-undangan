function adminThemePricing(cfg) {
  return `<div class="admin-theme-prices">${Object.entries(themeNames)
    .map(
      ([id, name]) =>
        `<article><img src="${themeDesigns[id].cover}" alt="Tema ${esc(name)}"><div><h3>${esc(name)}</h3><strong data-price-summary="${id}">${cfg.prices[id] ? rupiah(cfg.prices[id]) : "Belum dijual"}</strong><label>Harga jual ${esc(name)} (rupiah)<input name="price_${id}" type="number" min="0" max="100000000" step="1" value="${cfg.prices[id] || 0}" required></label><label>Harga normal sebelum promo (opsional)<input name="compare_${id}" type="number" min="0" max="100000000" step="1" value="${cfg.comparePrices?.[id] || 0}"></label><p>Isi 0 pada harga normal jika tidak ada promo. Harga jual 0 berarti pembayaran tema belum dibuka.</p><a class="button" href="/tema/${id}" target="_blank" rel="noopener">Preview</a></div></article>`,
    )
    .join("")}</div>`;
}
const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n));
const orderStatuses = {
  pending_payment: "Menunggu pembayaran",
  awaiting_verification: "Menunggu pemeriksaan admin",
  paid: "Pembayaran disetujui",
  rejected: "Konfirmasi ditolak",
  expired: "Batas pembayaran berakhir",
  cancelled: "Dibatalkan",
};
const themeDesigns = {
  navy: {
    name: "Navy Ivory",
    cover: "/assets/navy-pavilion.webp",
    inside: "/assets/navy-pavilion.webp",
  },
  sakura: {
    name: "Sakura & Butterfly",
    cover: "/assets/sakura-landscape.svg",
    inside: "/assets/sakura-landscape.svg",
  },
  meihua: {
    name: "Meihua Pavilion",
    cover: "/assets/meihua-cover.svg",
    inside: "/assets/meihua-mountains.svg",
  },
  jawa: {
    name: "Jawa Heritage",
    cover: "/assets/jawa-cover.svg",
    inside: "/assets/jawa-inside.svg",
  },
  islami: {
    name: "Islamic Serenity",
    cover: "/assets/islami-cover.svg",
    inside: "/assets/islami-inside.svg",
  },
};
const themeNames = Object.fromEntries(
  Object.entries(themeDesigns).map(([id, d]) => [id, d.name]),
);
function themePrice(t) {
  if (!t.price)
    return '<span class="theme-price-pending">Harga belum ditetapkan</span>';
  const price = (n) =>
    "Rp. " +
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
      Number(n),
    );
  return `<div class="theme-price-line"><strong class="theme-sale-price">${price(t.price)}</strong>${t.comparePrice > t.price ? `<del class="theme-original-price">${price(t.comparePrice)}</del>` : ""}</div>`;
}
function catalogCards(themes, eventId = "") {
  return `<div class="catalog-grid">${themes.map((t) => `<article class="theme-product"><a href="/tema/${esc(t.id)}" aria-label="Preview ${esc(t.name)}"><img src="${esc(t.image)}" alt="Tema ${esc(t.name)}" loading="lazy"></a><div><h3>${esc(t.name)}</h3>${themePrice(t)}<div class="catalog-actions"><a class="site-button" href="/tema/${esc(t.id)}">Preview</a><a class="site-button secondary" href="/pesanan?tema=${esc(t.id)}${eventId ? "&acara=" + esc(eventId) : ""}">Select</a></div></div></article>`).join("")}</div>`;
}
async function mountCatalog() {
  const section = document.querySelector("#tema");
  if (!section) return;
  try {
    const data = await api("/api/themes");
    section.innerHTML = `<p class="site-kicker">KATALOG TEMA</p><h2>Pilih suasana hari bahagia Anda.</h2><p>Preview bebas dicoba. Tema dapat digunakan setelah pembayaran transfer diverifikasi admin.</p>${catalogCards(data.themes)}`;
    const price = document.querySelector("#harga");
    if (price)
      price.innerHTML = `<p class="site-kicker">HARGA</p><h2>Satu undangan untuk satu hari bahagia.</h2><p>Harga tercantum pada katalog. Pembayaran melalui transfer bank; tema aktif setelah verifikasi admin. Tanggal dikunci saat aktivasi pertama dan masa aktif berakhir setelah hari pernikahan.</p><a class="site-button" href="#tema">Lihat tema dan harga</a>`;
  } catch (e) {
    section.innerHTML = `<h2>Katalog tema</h2><p role="alert">${esc(e.message)}</p><button id="retryCatalog">Coba lagi</button>`;
    document.querySelector("#retryCatalog").onclick = mountCatalog;
  }
}
async function renderOrders(selectedTheme) {
  document.title = "Pesanan saya — Temu";
  if (!me) {
    if (selectedTheme && themeNames[selectedTheme])
      sessionStorage.setItem("pendingTheme", selectedTheme);
    const eventId = new URLSearchParams(location.search).get("acara");
    if (eventId) sessionStorage.setItem("pendingEvent", eventId);
    location.href = "/login";
    return;
  }
  shell(
    '<main class="shop-page"><a href="/dashboard">← Dashboard</a><h1>Pesanan saya</h1><p id="shopFeedback" role="status">Memuat pesanan…</p><div id="shopContent"></div></main>',
  );
  try {
    const eventId = new URLSearchParams(location.search).get("acara");
    if (selectedTheme && themeNames[selectedTheme]) {
      const catalog = await api("/api/themes"),
        theme = catalog.themes.find((t) => t.id === selectedTheme);
      document.querySelector("#shopFeedback").textContent = "";
      if (!theme.purchasable) {
        document.querySelector("#shopContent").innerHTML =
          `<section class="order-card"><h2>${esc(theme.name)} dipilih</h2><p>Pembayaran belum tersedia karena pemilik belum melengkapi harga, rekening, atau aktivasi penjualan. Tema tetap dapat dicoba melalui Preview.</p><a class="button" href="/tema/${esc(theme.id)}">Preview tema</a>${me.isAdmin ? '<a class="button" href="/admin#themePricing">Atur harga & rekening di panel admin</a>' : ""}<a class="button" href="/dashboard">Kembali ke dashboard</a></section>`;
        return;
      }
      const [events, payment] = await Promise.all([
        api("/api/events"),
        api("/api/payment-accounts"),
      ]);
      const unpaid = events.filter(
        (e) => e.license && !e.license.paid && !e.license.expired,
      );
      if (eventId && !unpaid.some((e) => e.id === eventId))
        throw Error(
          "Acara tidak tersedia untuk pembayaran baru. Buka riwayat pesanan untuk pembayaran yang sudah dibuat.",
        );
      document.querySelector("#shopContent").innerHTML =
        `<section class="order-card"><h2>Pesan ${esc(theme.name)}</h2>${themePrice(theme)}<p>Pilih acara yang belum dibayar atau buat acara baru untuk pasangan lain. Setiap acara dibayar terpisah.</p><form id="checkoutEvent"><label>Acara<select name="eventId">${unpaid.map((e) => `<option value="${esc(e.id)}" ${e.id === eventId ? "selected" : ""}>${esc(e.name || "Undangan baru")}</option>`).join("")}<option value="__new">＋ Buat acara baru</option></select></label><div id="checkoutNewFields"><label>Nama acara baru<input name="name" maxlength="120" placeholder="Pernikahan Rudi & Dian"></label><label>Tanggal rencana (opsional)<input name="date" type="date"></label></div>${bankSelect(payment.accounts)}<button class="primary" id="continueCheckout">Lanjutkan pembayaran</button></form></section>`;
      const f = document.querySelector("#checkoutEvent"),
        toggle = () => {
          const create = f.elements.eventId.value === "__new";
          document.querySelector("#checkoutNewFields").hidden = !create;
          f.elements.name.required = create;
        };
      f.elements.eventId.onchange = toggle;
      toggle();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const button = document.querySelector("#continueCheckout");
        button.disabled = true;
        try {
          let id = f.elements.eventId.value;
          if (id === "__new") {
            const created = await api("/api/events", {
              method: "POST",
              body: JSON.stringify({
                name: f.elements.name.value,
                date: f.elements.date.value,
              }),
            });
            id = created.id;
            f.elements.eventId.add(
              new Option(f.elements.name.value, id, true, true),
            );
            toggle();
          }
          const o = await api("/api/orders", {
            method: "POST",
            body: JSON.stringify({
              theme: selectedTheme,
              eventId: id,
              bankId: f.elements.bankId.value,
            }),
          });
          sessionStorage.removeItem("pendingTheme");
          sessionStorage.removeItem("pendingEvent");
          history.replaceState({}, "", "/pesanan/" + o.id);
          await renderOrder(o.id);
        } catch (error) {
          document.querySelector("#shopFeedback").textContent = error.message;
        } finally {
          button.disabled = false;
        }
      };
      return;
    }
    const [orders, catalog] = await Promise.all([
      api("/api/orders"),
      api("/api/themes"),
    ]);
    document.querySelector("#shopFeedback").textContent = "";
    if (eventId) {
      const selected = await api("/api/events/" + eventId);
      document.querySelector("#shopContent").innerHTML =
        `<h2>Pilih tema untuk ${esc(selected.name || "acara ini")}</h2><p>Acara ini memiliki pembayaran sendiri. Tema yang dibeli untuk acara lain tidak mengaktifkan acara ini.</p>${catalogCards(catalog.themes, eventId)}`;
      return;
    }
    document.querySelector("#shopContent").innerHTML =
      `<h2>Riwayat pesanan</h2>${orders.length ? orders.map((o) => `<article class="order-card"><h3>${esc(themeNames[o.theme_id] || o.theme_id)}</h3><p>${esc(o.id)} · ${rupiah(o.amount)}</p><p>${esc(orderStatuses[o.status])}</p><a class="button" href="/pesanan/${esc(o.id)}">Lihat pesanan</a></article>`).join("") : "<p>Belum ada pesanan. Pilih tema untuk memulai.</p>"}<h2>Katalog tema</h2>${catalogCards(catalog.themes, eventId)}`;
  } catch (e) {
    document.querySelector("#shopFeedback").textContent = e.message;
  }
}
async function renderOrder(id) {
  if (!me) {
    location.href = "/login";
    return;
  }
  document.title = "Detail pesanan — Temu";
  shell(
    '<main class="shop-page"><a href="/pesanan">← Semua pesanan</a><h1>Detail pesanan</h1><p id="shopFeedback" role="status">Memuat pesanan…</p><div id="shopContent"></div></main>',
  );
  try {
    const payment = await api("/api/payment-accounts");
    const o = await api("/api/orders/" + encodeURIComponent(id)),
      canConfirm = ["pending_payment", "rejected"].includes(o.status),
      paid = o.status === "paid",
      bank = o.bank,
      c = o.confirmation;
    document.querySelector("#shopFeedback").textContent = "";
    const wa = bank.whatsapp
      ? "https://wa.me/" +
        bank.whatsapp +
        "?text=" +
        encodeURIComponent(
          `Halo Admin Temu, saya ingin konfirmasi order ${o.id}, tema ${themeNames[o.theme_id]}, total ${rupiah(o.amount)}. Nama akun: ${me.name}.${c.sender ? ` Pengirim: ${c.sender}, bank ${c.bank}, waktu ${c.transferredAt}.` : ""} Mohon diperiksa. Bukti transfer akan saya lampirkan.`,
        )
      : "";
    document.querySelector("#shopContent").innerHTML =
      `<section class="order-card"><p class="eyebrow">${esc(o.id)}</p><h2>${esc(o.eventName || themeNames[o.theme_id])}</h2><p>${esc(themeNames[o.theme_id])}</p><p class="order-total">${rupiah(o.amount)}</p><strong>${esc(orderStatuses[o.status])}</strong>${o.reason ? `<p role="alert">Alasan: ${esc(o.reason)}</p>` : ""}<p>Batas transfer: ${esc(new Date(o.deadline).toLocaleString("id-ID"))}</p>${paid && o.event_id ? `<p>Pembelian Anda berlaku untuk satu undangan. Tetapkan dan konfirmasikan tanggal pernikahan di editor.</p><button class="primary" id="openPurchased">Buka undangan saya</button>` : ""}${["expired", "cancelled"].includes(o.status) && o.event_id ? `<a class="button" href="/pesanan?acara=${esc(o.event_id)}">Pilih tema & buat pesanan baru untuk acara ini</a>` : ""}<button id="refreshOrder">Perbarui status</button></section><section class="order-card"><h2>Transfer bank</h2>${o.status === "pending_payment" && payment.enabled ? `<form id="changePaymentBank" class="bank-choice">${bankSelect(payment.accounts, bank.id)}<button>Simpan pilihan bank</button><p>Ubah hanya sebelum transfer. Gunakan rekening tujuan yang tampil setelah disimpan.</p></form>` : ""}<p>Bank: <strong>${esc(bank.bank)}</strong></p><p>Nomor rekening: <strong id="sellerAccount">${esc(bank.account)}</strong></p><p>Atas nama: <strong>${esc(bank.holder)}</strong></p><button id="copySellerAccount">Salin nomor rekening</button><p>${esc(bank.instructions)}</p><p>Transfer sesuai total tagihan, lalu kirim konfirmasi. Pembayaran diperiksa manual melalui mutasi rekening oleh admin.</p>${wa ? `<a class="button" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">Konfirmasi via WhatsApp</a><p>WhatsApp membuka pesan siap kirim. Anda tetap perlu menekan Kirim dan melampirkan bukti sendiri.</p>` : ""}</section>${canConfirm ? `<section class="order-card"><h2>Konfirmasi pembayaran</h2><form id="paymentConfirmation"><label>Nama pengirim<input name="sender" maxlength="120" required value="${esc(c.sender || "")}"></label><label>Bank pengirim<input name="bank" maxlength="60" required value="${esc(c.bank || "")}"></label><label>Waktu transfer<input name="transferredAt" type="datetime-local" required></label><label>Nominal transfer (rupiah)<input name="amount" type="number" min="1" step="1" value="${o.amount}" required></label><label>Bukti transfer (opsional; JPEG/PNG/WebP, maksimal 5 MB)<input id="paymentProof" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="primary" id="sendConfirmation">Kirim konfirmasi pembayaran</button></form><button id="cancelOrder">Batalkan pesanan</button></section>` : ""}${o.proof ? `<p><a href="/api/orders/${esc(o.id)}/proof" target="_blank" rel="noopener">Lihat bukti transfer saya</a></p>` : ""}`;
    const changeBank = document.querySelector("#changePaymentBank");
    if (changeBank)
      changeBank.onsubmit = async (e) => {
        e.preventDefault();
        const button = changeBank.querySelector("button");
        button.disabled = true;
        try {
          await api("/api/orders/" + encodeURIComponent(id) + "/bank", {
            method: "PATCH",
            body: JSON.stringify({ bankId: changeBank.elements.bankId.value }),
          });
          await renderOrder(id);
        } catch (error) {
          document.querySelector("#shopFeedback").textContent = error.message;
        } finally {
          button.disabled = false;
        }
      };
    document.querySelector("#refreshOrder").onclick = () => renderOrder(id);
    document.querySelector("#copySellerAccount").onclick = async () => {
      try {
        await navigator.clipboard.writeText(bank.account);
        toast("Nomor rekening disalin.");
      } catch {
        toast("Salin nomor rekening yang ditampilkan di atas.");
      }
    };
    if (paid && o.event_id)
      document.querySelector("#openPurchased").onclick = () => edit(o.event_id);
    if (canConfirm) {
      document.querySelector("#cancelOrder").onclick = async () => {
        if (!confirm("Batalkan pesanan ini?")) return;
        try {
          await api("/api/orders/" + id + "/cancel", {
            method: "POST",
            body: "{}",
          });
          renderOrder(id);
        } catch (e) {
          toast(e.message);
        }
      };
      document.querySelector("#paymentConfirmation").onsubmit = async (e) => {
        e.preventDefault();
        const b = document.querySelector("#sendConfirmation");
        b.disabled = true;
        try {
          const file = document.querySelector("#paymentProof").files[0];
          if (file) {
            if (file.size > 5 * 1024 * 1024)
              throw Error("Bukti maksimal 5 MB.");
            const f = new FormData();
            f.append("proof", file);
            await api("/api/orders/" + id + "/proof", {
              method: "POST",
              body: f,
            });
          }
          const d = Object.fromEntries(new FormData(e.target));
          d.transferredAt = new Date(d.transferredAt).toISOString();
          await api("/api/orders/" + id + "/confirm", {
            method: "POST",
            body: JSON.stringify(d),
          });
          await renderOrder(id);
          toast(
            "Konfirmasi masuk antrean admin. Tema belum aktif sampai dana disetujui.",
          );
        } catch (error) {
          document.querySelector("#shopFeedback").textContent = error.message;
        } finally {
          b.disabled = false;
        }
      };
    }
  } catch (e) {
    document.querySelector("#shopFeedback").textContent = e.message;
  }
}
async function mountAdminShop() {
  const [cfg, data] = await Promise.all([
    api("/api/admin/shop"),
    api("/api/admin/orders?page=" + adminOrderPage),
  ]);
  const host = document.querySelector("#adminContent");
  host.insertAdjacentHTML(
    "afterbegin",
    `<section class="admin-section"><h2>Pesanan produk <span class="order-badge">${data.pending} menunggu</span></h2><p>Order muncul sejak dibuat. Periksa mutasi rekening sebelum menyetujui, termasuk bila pelanggan menghubungi lewat WhatsApp.</p><div class="admin-orders">${data.orders.map((o) => `<article class="order-card"><h3>${esc(o.id)}</h3>${o.eventName ? `<p>Acara: <strong>${esc(o.eventName)}</strong></p>` : ""}<p>${esc(o.customer_name)} · ${esc(o.customer_email)}</p><p>${esc(themeNames[o.theme_id])} · ${rupiah(o.amount)} · <strong>${esc(orderStatuses[o.status])}</strong></p><p>Tujuan: ${esc(o.bank.bank)} · ${esc(o.bank.account)} · ${esc(o.bank.holder)}</p><p>Pengirim: ${esc(o.confirmation.sender || "Belum konfirmasi")} · ${esc(o.confirmation.bank || "")} · ${esc(o.confirmation.transferredAt || "")}</p>${o.proof ? `<a class="button" href="/api/orders/${esc(o.id)}/proof" target="_blank" rel="noopener">Lihat bukti</a>` : ""}${["pending_payment", "awaiting_verification", "rejected", "expired"].includes(o.status) ? `<button data-review-order="${esc(o.id)}">Periksa pembayaran</button>` : ""}${o.reason ? `<p>${esc(o.reason)}</p>` : ""}</article>`).join("") || "<p>Belum ada pesanan.</p>"}</div><div class="admin-pagination"><button id="ordersPrev" ${data.page <= 1 ? "disabled" : ""}>Pesanan sebelumnya</button><span>Halaman ${data.page} · ${data.total} pesanan</span><button id="ordersNext" ${data.page * 20 >= data.total ? "disabled" : ""}>Pesanan berikutnya</button><button id="refreshOrders">Perbarui pesanan</button></div></section><section class="admin-section"><h2 id="themePricing">Rekening dan harga per tema</h2><p>Rekening ini untuk pembayaran pembelian undangan, terpisah dari Titip Hadiah mempelai. Isi rekening Anda sendiri. Contoh format saja: BCA 0000000000 / BRI 000000000000000 / Mandiri 0000000000000 atas nama CONTOH; jangan gunakan untuk transaksi nyata.</p><form id="shopSettings"><label class="check-row"><input type="checkbox" name="enabled" ${cfg.enabled ? "checked" : ""}> Aktifkan penjualan — saya sudah memeriksa rekening dan harga</label>${[
      ["bank", "Nama bank", 60],
      ["account", "Nomor rekening", 40],
      ["holder", "Atas nama", 120],
      ["whatsapp", "WhatsApp admin (62..., tanpa +)", 20],
      ["instructions", "Petunjuk transfer", 1000],
    ]
      .map(
        ([name, label, max]) =>
          `<label>${label}<input name="${name}" maxlength="${max}" value="${esc(cfg[name])}"></label>`,
      )
      .join(
        "",
      )}<div id="extraPaymentAccounts"></div><button type="button" id="addPaymentAccount">＋ Tambah rekening</button><p>Maksimal 10 rekening. Pelanggan memilih bank sebelum membuat tagihan.</p><label>Batas pembayaran (jam)<input name="hours" type="number" min="1" max="168" value="${cfg.hours}" required></label>${adminThemePricing(cfg)}<button class="primary">Simpan rekening & harga</button><p id="shopSettingsFeedback" role="status"></p></form></section><dialog id="reviewPayment" class="bank-dialog"><form id="reviewPaymentForm"><h2>Periksa pembayaran</h2><p id="reviewSummary"></p><label>Keputusan<select name="decision"><option value="approve">Setujui & aktifkan</option><option value="reject">Tolak konfirmasi</option></select></label><label>Nominal yang masuk (rupiah)<input name="amount" type="number" min="1" step="1"></label><label>Referensi mutasi bank (unik)<input name="transferRef" maxlength="140"></label><label class="check-row"><input type="checkbox" name="fundsChecked"> Saya sudah memeriksa dana masuk di mutasi rekening</label><label>Alasan penolakan / persetujuan transfer terlambat<textarea name="reason" maxlength="1000" rows="3"></textarea></label><p id="reviewFeedback" role="alert"></p><div class="actions"><button type="button" id="closeReview">Batal</button><button class="primary" id="submitReview">Simpan keputusan</button></div></form></dialog>`,
  );
  const extra = document.querySelector("#extraPaymentAccounts");
  const addAccount = (row = {}) => {
    const box = document.createElement("fieldset");
    box.className = "additional-payment-account";
    box.dataset.id = row.id || "";
    box.innerHTML = `<legend>Rekening tambahan</legend>${[
      ["bank", "Nama bank", 60],
      ["account", "Nomor rekening", 40],
      ["holder", "Atas nama", 120],
    ]
      .map(
        ([key, label, max]) =>
          `<label>${label}<input data-account-field="${key}" maxlength="${max}" value="${esc(row[key] || "")}" required></label>`,
      )
      .join("")}<button type="button">Hapus rekening</button>`;
    box.querySelector("button").onclick = () => box.remove();
    extra.append(box);
  };
  (cfg.accounts || []).slice(1).forEach(addAccount);
  document.querySelector("#addPaymentAccount").onclick = () => {
    if (extra.children.length >= 9) return toast("Maksimal 10 rekening.");
    addAccount();
  };
  document.querySelector("#refreshOrders").onclick = renderAdmin;
  document.querySelector("#ordersPrev").onclick = () => {
    adminOrderPage--;
    renderAdmin();
  };
  document.querySelector("#ordersNext").onclick = () => {
    adminOrderPage++;
    renderAdmin();
  };
  document.querySelector("#shopSettings").onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    d.enabled = e.target.elements.enabled.checked;
    d.accounts = [
      {
        id: cfg.accounts?.[0]?.id || "primary",
        bank: d.bank,
        account: d.account,
        holder: d.holder,
      },
      ...Array.from(extra.children).map((box) => ({
        id: box.dataset.id,
        ...Object.fromEntries(
          Array.from(box.querySelectorAll("[data-account-field]")).map((i) => [
            i.dataset.accountField,
            i.value,
          ]),
        ),
      })),
    ];
    d.prices = Object.fromEntries(
      Object.keys(themeNames).map((id) => [id, d["price_" + id]]),
    );
    d.comparePrices = Object.fromEntries(
      Object.keys(themeNames).map((id) => [id, d["compare_" + id]]),
    );
    const b = e.target.querySelector("button.primary");
    b.disabled = true;
    try {
      const saved = await api("/api/admin/shop", {
        method: "PUT",
        body: JSON.stringify(d),
      });
      cfg.accounts = saved.accounts;
      for (const key of ["bank", "account", "holder"])
        e.target.elements[key].value = saved[key];
      extra.replaceChildren();
      saved.accounts.slice(1).forEach(addAccount);
      for (const id of Object.keys(themeNames))
        document.querySelector(`[data-price-summary="${id}"]`).textContent =
          saved.prices[id] ? rupiah(saved.prices[id]) : "Belum dijual";
      document.querySelector("#shopSettingsFeedback").textContent =
        "Rekening dan harga disimpan.";
    } catch (error) {
      document.querySelector("#shopSettingsFeedback").textContent =
        error.message;
    } finally {
      b.disabled = false;
    }
  };
  let selected;
  const dialog = document.querySelector("#reviewPayment");
  document.querySelectorAll("[data-review-order]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = data.orders.find((o) => o.id === b.dataset.reviewOrder);
        document.querySelector("#reviewPaymentForm").reset();
        document.querySelector("#reviewSummary").textContent =
          selected.id +
          " · " +
          rupiah(selected.amount) +
          " · Tujuan: " +
          selected.bank.bank +
          " " +
          selected.bank.account;
        document.querySelector("#reviewPaymentForm").elements.amount.value =
          selected.amount;
        document.querySelector("#reviewFeedback").textContent = "";
        dialog.showModal();
      }),
  );
  document.querySelector("#closeReview").onclick = () => dialog.close();
  document.querySelector("#reviewPaymentForm").onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    d.fundsChecked = e.target.elements.fundsChecked.checked;
    d.lateReason = d.reason;
    const b = document.querySelector("#submitReview");
    b.disabled = true;
    try {
      await api("/api/admin/orders/" + selected.id + "/review", {
        method: "POST",
        body: JSON.stringify(d),
      });
      dialog.close();
      await renderAdmin();
      toast(
        d.decision === "approve"
          ? "Pembayaran disetujui, satu undangan diaktifkan."
          : "Konfirmasi ditolak dengan alasan.",
      );
    } catch (error) {
      document.querySelector("#reviewFeedback").textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
}
let adminOrderPage = 1;
function renderArchive(e) {
  shell(
    `<main><a href="/dashboard">← Dashboard</a><h1>Arsip undangan</h1><h2>${esc(e.name || "Undangan")}</h2><p>Tanggal: ${esc(e.date)} · ${esc(e.timezone || "Asia/Jakarta")}</p><p>Masa aktif telah berakhir. Undangan ini tidak dapat diedit, dipublikasikan atau dipakai untuk acara baru. Akun dan data Anda tetap disimpan.</p><a class="button" href="/preview/${esc(e.id)}">Lihat arsip lengkap</a><a class="button" href="/pesanan">Beli undangan baru</a></main>`,
  );
}
async function activateWeddingDate() {
  if (dirty)
    return toast("Simpan perubahan terlebih dahulu, lalu aktifkan tanggal.");
  if (!current.date)
    return toast("Isi tanggal pada Waktu & tempat, lalu Simpan.");
  const zone = current.timezone || "Asia/Jakarta";
  if (
    !confirm(
      `Kunci tanggal ${current.date} (${zone})? Pembelian berlaku sekali untuk pernikahan ini. Masa aktif berakhir pukul 00.00 hari berikutnya. Perubahan tanggal hanya melalui admin.`,
    )
  )
    return;
  try {
    await api("/api/events/" + current.id + "/activate", {
      method: "POST",
      body: JSON.stringify({
        date: current.date,
        timezone: zone,
        confirm: true,
      }),
    });
    await edit(current.id);
    toast("Tanggal dikunci dan masa aktif ditetapkan.");
  } catch (e) {
    toast(e.message);
  }
}

function bankSelect(accounts, selected = "") {
  return `<label>Bank tujuan pembayaran<select name="bankId" required>${accounts.length !== 1 ? '<option value="">Pilih bank tujuan</option>' : ""}${accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === selected ? "selected" : ""}>${esc(a.bank)} · ${esc(a.account)} · ${esc(a.holder)}</option>`).join("")}</select></label>`;
}
