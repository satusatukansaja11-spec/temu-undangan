(function () {
  const titles = {
    success: "Berhasil!",
    info: "Informasi",
    warning: "Perhatian!",
    error: "Terjadi kesalahan",
  };
  const icons = {
    success: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    warning:
      '<path d="M10.3 4.3 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5m0 3v.1"/>',
    error: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  const items = [];
  let region,
    sequence = 0;
  function ensureRegion() {
    if (!region) {
      region =
        document.getElementById("toast") || document.createElement("div");
      region.id = "toast";
      region.className = "snackbar-stack";
      region.setAttribute("role", "region");
      region.setAttribute("aria-label", "Notifikasi");
      region.removeAttribute("aria-live");
    }
    const dialogs = Array.from(document.querySelectorAll("dialog[open]")),
      target = dialogs.at(-1) || document.body;
    if (region.parentElement !== target) target.append(region);
    return region;
  }
  function remove(item) {
    if (!items.includes(item)) return;
    clearTimeout(item.timer);
    item.el.remove();
    items.splice(items.indexOf(item), 1);
  }
  function paused(item) {
    return document.hidden || item.hover || item.focus;
  }
  function stopTimer(item) {
    if (item.timer) {
      clearTimeout(item.timer);
      item.timer = null;
      item.remaining = Math.max(
        0,
        item.remaining - (performance.now() - item.started),
      );
    }
  }
  function startTimer(item) {
    if (!items.includes(item)) return;
    stopTimer(item);
    if (paused(item)) return;
    item.started = performance.now();
    item.timer = setTimeout(() => remove(item), item.remaining);
  }
  function show(message, type = "info", options = {}) {
    const text = String(message || "").trim();
    if (!text) return;
    type = Object.hasOwn(titles, type) ? type : "info";
    const key = options.key || type + ":" + text;
    const duplicate = items.find((item) => item.key === key);
    if (duplicate) {
      duplicate.remaining = duplicate.duration;
      clearTimeout(duplicate.timer);
      duplicate.timer = null;
      startTimer(duplicate);
      return duplicate.id;
    }
    while (items.length >= 4)
      remove(items.find((item) => !item.focus) || items[0]);
    const el = document.createElement("div");
    el.className = "snackbar snackbar-" + type;
    el.dataset.type = type;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.setAttribute("aria-atomic", "true");
    const icon = document.createElement("span");
    icon.className = "snackbar-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg viewBox="0 0 24 24">' + icons[type] + "</svg>";
    const content = document.createElement("div");
    content.className = "snackbar-content";
    const title = document.createElement("strong");
    title.textContent = options.title || titles[type];
    const body = document.createElement("p");
    body.textContent = text;
    content.append(title, body);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "snackbar-close";
    close.setAttribute("aria-label", "Tutup notifikasi " + titles[type]);
    close.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';
    el.append(icon, content, close);
    const duration =
        Number.isFinite(options.duration) && options.duration > 0
          ? options.duration
          : type === "error"
            ? 10000
            : type === "warning"
              ? 8000
              : 6000,
      item = {
        id: ++sequence,
        key,
        el,
        duration,
        remaining: duration,
        timer: null,
        started: 0,
        hover: false,
        focus: false,
      };
    items.push(item);
    ensureRegion().append(el);
    close.onclick = () => remove(item);
    el.onpointerenter = () => {
      item.hover = true;
      stopTimer(item);
    };
    el.onpointerleave = () => {
      item.hover = false;
      startTimer(item);
    };
    el.addEventListener("focusin", () => {
      item.focus = true;
      stopTimer(item);
    });
    el.addEventListener("focusout", (e) => {
      if (!el.contains(e.relatedTarget)) {
        item.focus = false;
        startTimer(item);
      }
    });
    startTimer(item);
    return item.id;
  }
  function flash(message, type = "success") {
    try {
      sessionStorage.setItem(
        "temu-snackbar-flash",
        JSON.stringify({ message, type, time: Date.now() }),
      );
    } catch {
      show(message, type);
    }
  }
  function requestSuccess(url, method, data, body) {
    method = method.toUpperCase();
    if (["GET", "HEAD"].includes(method)) return;
    if (
      ["/auth/login", "/auth/register", "/auth/demo", "/api/logout"].includes(
        url,
      )
    ) {
      flash(
        url === "/api/logout"
          ? "Anda berhasil keluar akun."
          : url === "/auth/register"
            ? "Akun berhasil dibuat. Selamat datang di Temu!"
            : "Anda berhasil masuk.",
      );
      return;
    }
    let message;
    if (method === "POST" && url === "/api/events")
      message = "Acara baru berhasil dibuat.";
    else if (method === "PUT" && url === "/api/admin/shop")
      message = "Rekening, harga dan pengaturan paket berhasil disimpan.";
    else if (method === "POST" && url.startsWith("/api/admin/theme-assets/"))
      message = "Latar tema berhasil disimpan.";
    else if (url.startsWith("/api/admin/theme-ornaments/") && method !== "POST")
      message =
        method === "DELETE"
          ? "Ornamen berhasil dihapus."
          : "Pengaturan ornamen berhasil disimpan.";
    else if (method === "POST" && url === "/api/orders")
      message = "Pesanan berhasil dibuat. Lanjutkan pembayaran sesuai tagihan.";
    else if (method === "POST" && /^\/api\/orders\/[^/]+\/cancel$/.test(url))
      message = "Pesanan berhasil dibatalkan.";
    else if (method === "PATCH" && /^\/api\/orders\/[^/]+\/bank$/.test(url))
      message = "Pilihan bank pembayaran berhasil disimpan.";
    else if (/\/recipients(?:\/[^/]+)?$/.test(url))
      message =
        method === "DELETE"
          ? "Nama penerima berhasil dihapus."
          : "Nama penerima berhasil ditambahkan.";
    else if (method === "PUT" && /\/sharing$/.test(url))
      message = "Pesan undangan berhasil disimpan.";
    else if (method === "PATCH" && /\/wishes\/[^/]+$/.test(url))
      message = "Tampilan ucapan berhasil diperbarui.";
    else if (method === "POST" && /^\/api\/public\/[^/]+\/rsvp$/.test(url))
      message = data.updated
        ? "Konfirmasi kehadiran berhasil diperbarui. Terima kasih!"
        : "Konfirmasi kehadiran berhasil disimpan. Terima kasih!";
    if (message) show(message, "success");
  }
  function init() {
    ensureRegion();
    new MutationObserver(() => {
      if (items.length) ensureRegion();
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    document.addEventListener("visibilitychange", () =>
      items.forEach((item) =>
        document.hidden ? stopTimer(item) : startTimer(item),
      ),
    );
    document.addEventListener("click", (event) => {
      if (event.target.closest?.('a[href^="https://wa.me/"]'))
        show("Lanjutkan pengiriman di WhatsApp dengan menekan Kirim.", "info");
    });
    document.addEventListener(
      "invalid",
      () =>
        show("Periksa isian formulir sebelum melanjutkan.", "warning", {
          key: "form-validation",
        }),
      true,
    );
    try {
      const raw = sessionStorage.getItem("temu-snackbar-flash");
      sessionStorage.removeItem("temu-snackbar-flash");
      if (raw) {
        const value = JSON.parse(raw);
        if (Date.now() - value.time < 30000) show(value.message, value.type);
      }
    } catch {}
  }
  window.snackbar = {
    show,
    flash,
    requestSuccess,
    dismiss: (id) => {
      const item = items.find((item) => item.id === id);
      if (item) remove(item);
    },
    clear: () => items.slice().forEach(remove),
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
