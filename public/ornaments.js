const ornamentSections = {
  cover: "Sampul",
  intro: "Halaman nama",
  couple: "Mempelai",
  schedule: "Susunan acara",
  maps: "Lokasi",
  gallery: "Galeri",
};
function ornamentFields(o = {}) {
  return `<label>Halaman<select name="section">${Object.entries(
    ornamentSections,
  )
    .map(
      ([id, name]) =>
        `<option value="${id}" ${id === (o.section || "cover") ? "selected" : ""}>${name}</option>`,
    )
    .join("")}</select></label><label>Posisi<select name="position">${[
    ["top-left", "Kiri atas"],
    ["top-right", "Kanan atas"],
    ["bottom-left", "Kiri bawah"],
    ["bottom-right", "Kanan bawah"],
  ]
    .map(
      ([id, name]) =>
        `<option value="${id}" ${id === (o.position || "top-right") ? "selected" : ""}>${name}</option>`,
    )
    .join("")}</select></label><label>Gerakan<select name="motion">${[
    ["sway", "Berayun"],
    ["float", "Melayang"],
    ["still", "Diam"],
  ]
    .map(
      ([id, name]) =>
        `<option value="${id}" ${id === (o.motion || "sway") ? "selected" : ""}>${name}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Ukuran (px)<input name="size" type="number" min="60" max="240" value="${o.size || 140}" required></label><label>Durasi gerakan (detik)<input name="duration" type="number" min="4" max="20" step="0.5" value="${o.duration || 7}" required></label>`;
}
let ornamentPreviewCleanup;
async function mountOrnamentEditor(theme, notice = "") {
  const host = document.querySelector("#ornamentEditor");
  if (!host || document.querySelector("#adminThemeSelect")?.value !== theme)
    return;
  ornamentPreviewCleanup?.();
  ornamentPreviewCleanup = null;
  host.dataset.theme = theme;
  host.innerHTML = '<p role="status">Memuat ornamen…</p>';
  try {
    const data = await api("/api/admin/theme-ornaments/" + theme);
    if (!host.isConnected || host.dataset.theme !== theme) return;
    host.innerHTML = `<h3>Gambar bergerak — ${esc(themeNames[theme])}</h3><p>Pilih gambar, atur halaman dan gerakannya, lalu klik <strong>Simpan gambar ornamen</strong>. Gambar baru terpasang setelah pesan berhasil muncul.</p><p>PNG/WebP transparan, maksimal 5 MB per gambar dan ${data.limit} gambar per tema. Ornamen Sampul terlihat sebelum Buka Undangan; pilih Halaman nama atau halaman lain untuk menampilkannya di dalam undangan.</p><p id="ornamentEditorStatus" role="status">${esc(notice)}</p><form id="ornamentUpload"><label>Gambar ornamen<input name="images" type="file" accept="image/png,image/webp" multiple required></label><div id="pendingOrnaments" aria-live="polite"></div><div class="ornament-upload-actions"><button type="submit" class="primary" disabled>Simpan gambar ornamen</button><span>Pilih gambar untuk mengaktifkan tombol Simpan.</span></div><div class="ornament-settings">${ornamentFields()}</div><div class="ornament-upload-actions"><button type="submit" class="primary" disabled>Simpan gambar ornamen</button></div><p class="ornament-form-status" role="status"></p></form><div class="ornament-saved-heading"><h4>Ornamen tersimpan (${data.ornaments.length}/${data.limit})</h4><a class="button" href="/tema/${esc(theme)}" target="_blank" rel="noopener">Lihat hasil tema</a></div><div class="ornament-list">${data.ornaments.map((o, i) => `<form data-ornament="${esc(o.id)}"><h4>Ornamen ${i + 1} · ${esc(ornamentSections[o.section])}</h4><p class="ornament-saved-badge">Tersimpan · ${o.enabled ? "Ditampilkan pada tema" : "Tidak ditampilkan"}</p><img src="${esc(o.url)}" alt="Ornamen ${esc(themeNames[theme])}" class="ornament-thumb"><div class="ornament-settings">${ornamentFields(o)}</div><label class="check-row"><input name="enabled" type="checkbox" ${o.enabled ? "checked" : ""}> Tampilkan ornamen</label><div class="actions"><button type="submit" class="primary">Simpan perubahan ornamen</button><button type="button" data-delete-ornament="${esc(o.id)}">Hapus</button></div><p role="status"></p></form>`).join("") || "<p>Belum ada ornamen tersimpan untuk tema ini.</p>"}</div>`;
    const config = (form) => {
      const d = Object.fromEntries(new FormData(form));
      return {
        section: d.section,
        position: d.position,
        motion: d.motion,
        size: Number(d.size),
        duration: Number(d.duration),
        enabled: form.elements.enabled ? form.elements.enabled.checked : true,
      };
    };
    const upload = host.querySelector("#ornamentUpload"),
      picker = upload.elements.images,
      feedback = upload.querySelector(".ornament-form-status"),
      pending = host.querySelector("#pendingOrnaments"),
      submits = Array.from(upload.querySelectorAll("[type=submit]"));
    let files = [],
      urls = [],
      savedCount = data.ornaments.length,
      saving = false;
    const clearUrls = () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls = [];
    };
    ornamentPreviewCleanup = clearUrls;
    const renderPending = () => {
      clearUrls();
      submits.forEach((b) => (b.disabled = saving || !files.length));
      upload.querySelector(".ornament-upload-actions>span").textContent =
        files.length
          ? "Klik Simpan untuk memasang gambar pada tema ini."
          : "Pilih gambar untuk mengaktifkan tombol Simpan.";
      if (!files.length) {
        pending.innerHTML = "";
        return;
      }
      const settings = config(upload);
      pending.innerHTML = `<p><strong>${files.length} gambar dipilih — belum disimpan.</strong></p><div class="ornament-pending-grid">${files
        .map((file) => {
          const url = URL.createObjectURL(file);
          urls.push(url);
          return `<figure><div class="ornament-admin-preview"><img src="${url}" alt="Pratinjau ${esc(file.name)}" class="ornament-motion-${esc(settings.motion)}"></div><figcaption>${esc(file.name)}</figcaption></figure>`;
        })
        .join("")}</div>`;
      pending
        .querySelectorAll("img")
        .forEach((img) =>
          img.style.setProperty("--ornament-duration", settings.duration + "s"),
        );
    };
    picker.onchange = () => {
      files = Array.from(picker.files);
      feedback.textContent = "";
      const invalid = files.some(
        (file) =>
          !["image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024,
      );
      if (files.length + savedCount > data.limit || invalid) {
        feedback.textContent = invalid
          ? "Gunakan PNG/WebP transparan maksimal 5 MB per gambar."
          : "Maksimal 12 ornamen per tema. Pilih lebih sedikit gambar.";
        files = [];
        picker.value = "";
      }
      renderPending();
    };
    upload
      .querySelectorAll(".ornament-settings select,.ornament-settings input")
      .forEach((input) =>
        input.addEventListener("input", () => {
          if (!saving) renderPending();
        }),
      );
    upload.onsubmit = async (e) => {
      e.preventDefault();
      if (saving || !files.length) return;
      if (files.length + savedCount > data.limit) {
        feedback.textContent = "Maksimal 12 ornamen per tema.";
        return;
      }
      const settings = config(upload);
      saving = true;
      const total = files.length;
      let uploaded = 0;
      Array.from(upload.elements).forEach((input) => (input.disabled = true));
      try {
        while (files.length) {
          feedback.textContent = `Menyimpan gambar ${uploaded + 1} dari ${total}…`;
          const body = new FormData();
          body.append("image", files[0]);
          body.append("config", JSON.stringify(settings));
          await api("/api/admin/theme-ornaments/" + theme, {
            method: "POST",
            body,
          });
          files.shift();
          savedCount++;
          uploaded++;
        }
        const message = `${uploaded} gambar ornamen berhasil disimpan untuk ${themeNames[theme]}. Klik Lihat hasil tema untuk memeriksanya.`;
        clearUrls();
        await mountOrnamentEditor(theme, message);
        toast(message);
      } catch (error) {
        feedback.textContent = `${uploaded ? uploaded + " gambar sudah tersimpan. " : ""}${error.message}${uploaded ? " Gambar yang tersisa dapat disimpan ulang tanpa menggandakan yang berhasil." : ""}`;
        if (uploaded) {
          const info = host.querySelector("#ornamentEditorStatus");
          info.textContent = `${savedCount} ornamen tersimpan untuk ${themeNames[theme]}. Selesaikan sisa unggahan, lalu lihat hasil tema.`;
        }
        saving = false;
      } finally {
        saving = false;
        Array.from(upload.elements).forEach(
          (input) => (input.disabled = false),
        );
        submits.forEach((b) => (b.disabled = !files.length));
        if (upload.isConnected) renderPending();
      }
    };
    host.querySelectorAll("[data-ornament]").forEach((form, index) => {
      const status = form.querySelector("[role=status]");
      form.addEventListener(
        "input",
        () =>
          (status.textContent =
            "Perubahan belum disimpan. Klik Simpan perubahan ornamen."),
      );
      form.onsubmit = async (e) => {
        e.preventDefault();
        const b = form.querySelector("[type=submit]"),
          settings = config(form);
        b.disabled = true;
        status.textContent = "Menyimpan pengaturan…";
        try {
          await api(
            "/api/admin/theme-ornaments/" + theme + "/" + form.dataset.ornament,
            { method: "PATCH", body: JSON.stringify(settings) },
          );
          status.textContent =
            "Pengaturan ornamen berhasil disimpan. Muat ulang halaman tema untuk melihat hasilnya.";
          form.querySelector("h4").textContent =
            `Ornamen ${index + 1} · ${ornamentSections[settings.section]}`;
          form.querySelector(".ornament-saved-badge").textContent =
            "Tersimpan · " +
            (settings.enabled ? "Ditampilkan pada tema" : "Tidak ditampilkan");
        } catch (error) {
          status.textContent = error.message;
        } finally {
          b.disabled = false;
        }
      };
      form.querySelector("[data-delete-ornament]").onclick = async (e) => {
        if (!confirm("Hapus ornamen ini dari tema?")) return;
        const b = e.currentTarget;
        b.disabled = true;
        try {
          await api(
            "/api/admin/theme-ornaments/" + theme + "/" + form.dataset.ornament,
            { method: "DELETE" },
          );
          await mountOrnamentEditor(theme, "Ornamen berhasil dihapus.");
        } catch (error) {
          status.textContent = error.message;
          b.disabled = false;
        }
      };
    });
  } catch (error) {
    if (host.isConnected && host.dataset.theme === theme) {
      host.textContent = error.message;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Coba lagi";
      retry.onclick = () => mountOrnamentEditor(theme, notice);
      host.append(retry);
    }
  }
}
function applyThemeOrnaments(event) {
  const root = document.querySelector(".wedding-v2"),
    selectors = {
      cover: ".wedding-hero",
      intro: "#weddingIntro",
      couple: "#couple",
      schedule: "#schedule",
      maps: "#maps",
      gallery: "#gallery",
    },
    layers = [];
  for (const [i, o] of (event.themeOrnaments || []).entries()) {
    if (!o.enabled) continue;
    const host = root.querySelector(selectors[o.section]);
    if (!host) continue;
    host.classList.add("theme-decoration-host");
    const layer = document.createElement("div");
    layer.className = "theme-decoration ornament-" + o.position;
    layer.setAttribute("aria-hidden", "true");
    layer.style.setProperty("--ornament-size", o.size + "px");
    const img = document.createElement("img");
    img.src = o.url;
    img.alt = "";
    img.loading = o.section === "cover" ? "eager" : "lazy";
    img.className = "ornament-motion-" + o.motion;
    img.style.setProperty("--ornament-duration", o.duration + "s");
    img.style.setProperty("--ornament-delay", -i * 1.3 + "s");
    layer.append(img);
    host.prepend(layer);
    layers.push({ host, layer });
  }
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) =>
        e.target.classList.toggle("ornament-in-view", e.isIntersecting),
      ),
    { rootMargin: "50px" },
  );
  for (const { host } of layers) observer.observe(host);
  const pause = () =>
    root.classList.toggle("ornaments-paused", document.hidden);
  document.addEventListener("visibilitychange", pause);
  pause();
  const previous = window.themeMotionCleanup;
  window.themeMotionCleanup = () => {
    previous?.();
    observer.disconnect();
    document.removeEventListener("visibilitychange", pause);
    for (const { layer } of layers) layer.remove();
  };
}
