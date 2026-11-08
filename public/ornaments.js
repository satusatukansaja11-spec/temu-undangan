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
async function mountOrnamentEditor(theme) {
  const host = document.querySelector("#ornamentEditor");
  if (!host || document.querySelector("#adminThemeSelect")?.value !== theme)
    return;
  host.dataset.theme = theme;
  host.innerHTML = '<p role="status">Memuat ornamen…</p>';
  try {
    const data = await api("/api/admin/theme-ornaments/" + theme);
    if (!host.isConnected || host.dataset.theme !== theme) return;
    host.innerHTML = `<h3>Gambar bergerak — ${esc(themeNames[theme])}</h3><p>Ornamen hanya tampil pada tema ini. Pilih beberapa PNG/WebP transparan (maksimal 5 MB per gambar, ${data.limit} gambar per tema). Gambar latar utuh perlu dipisahkan dahulu agar daunnya bergerak sendiri.</p><form id="ornamentUpload"><label>Gambar ornamen<input name="images" type="file" accept="image/png,image/webp" multiple required></label><div class="ornament-settings">${ornamentFields()}</div><button class="primary">Tambah gambar bergerak</button><p role="status"></p></form><div class="ornament-list">${data.ornaments.map((o) => `<form data-ornament="${esc(o.id)}"><img src="${esc(o.url)}" alt="Ornamen ${esc(themeNames[theme])}" class="ornament-thumb"><div class="ornament-settings">${ornamentFields(o)}</div><label class="check-row"><input name="enabled" type="checkbox" ${o.enabled ? "checked" : ""}> Tampilkan ornamen</label><div class="actions"><button class="primary">Simpan ornamen</button><button type="button" data-delete-ornament="${esc(o.id)}">Hapus</button></div><p role="status"></p></form>`).join("") || "<p>Belum ada ornamen tambahan untuk tema ini.</p>"}</div><a class="button" href="/tema/${esc(theme)}" target="_blank" rel="noopener">Preview gerakan tema</a>`;
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
    host.querySelector("#ornamentUpload").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target,
        feedback = form.querySelector("[role=status]"),
        button = form.querySelector("button"),
        files = Array.from(form.elements.images.files);
      if (files.length + data.ornaments.length > data.limit) {
        feedback.textContent = "Maksimal 12 ornamen per tema.";
        return;
      }
      if (files.some((f) => f.size > 5 * 1024 * 1024)) {
        feedback.textContent = "Setiap gambar maksimal 5 MB.";
        return;
      }
      button.disabled = true;
      let uploaded = 0;
      try {
        for (const file of files) {
          feedback.textContent = `Mengunggah ${uploaded + 1} dari ${files.length}…`;
          const body = new FormData();
          body.append("image", file);
          body.append("config", JSON.stringify(config(form)));
          await api("/api/admin/theme-ornaments/" + theme, {
            method: "POST",
            body,
          });
          uploaded++;
        }
        await mountOrnamentEditor(theme);
        toast(`${uploaded} ornamen ditambahkan.`);
      } catch (error) {
        feedback.textContent = `${uploaded} gambar berhasil. ${error.message} Muat ulang daftar sebelum mencoba lagi.`;
        if (uploaded) {
          const retry = document.createElement("button");
          retry.type = "button";
          retry.textContent = "Muat ulang daftar";
          retry.onclick = () => mountOrnamentEditor(theme);
          feedback.append(retry);
        }
      } finally {
        button.disabled = false;
      }
    };
    host.querySelectorAll("[data-ornament]").forEach((form) => {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const b = form.querySelector("button"),
          feedback = form.querySelector("[role=status]");
        b.disabled = true;
        try {
          await api(
            "/api/admin/theme-ornaments/" + theme + "/" + form.dataset.ornament,
            { method: "PATCH", body: JSON.stringify(config(form)) },
          );
          feedback.textContent = "Pengaturan ornamen disimpan.";
        } catch (error) {
          feedback.textContent = error.message;
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
          await mountOrnamentEditor(theme);
        } catch (error) {
          form.querySelector("[role=status]").textContent = error.message;
          b.disabled = false;
        }
      };
    });
  } catch (error) {
    if (host.isConnected && host.dataset.theme === theme) {
      host.textContent = error.message;
      const retry = document.createElement("button");
      retry.textContent = "Coba lagi";
      retry.onclick = () => mountOrnamentEditor(theme);
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
