function packageFeatureList(id) {
  const index = id === "premium" ? 2 : 1,
    features = window.TEMU_PACKAGE_FEATURES.features;
  const boundary =
    features.findIndex((row) => row[0] === "Revisi selama masa aktif") + 1;
  const list = (rows) =>
    `<ul class="package-feature-list">${rows.map((row) => `<li class="${row[index] ? "included" : "excluded"}"><span aria-hidden="true">${row[index] ? "✓" : "×"}</span><span>${esc(row[0])}${typeof row[index] === "string" ? `: <strong>${esc(row[index])}</strong>` : ""}${!row[index] ? "<small>Khusus Premium</small>" : ""}</span></li>`).join("")}</ul>`;
  return `${list(features.slice(0, boundary))}<details class="package-more"><summary><span class="package-expand-label">Tampilkan lebih banyak</span><span class="package-collapse-label">Tampilkan lebih sedikit</span><span aria-hidden="true" class="package-more-arrow">⌄</span></summary>${list(features.slice(boundary))}<p class="package-term">Satu acara, tanggal dikunci; masa aktif mengikuti hari pernikahan. Galeri tetap mengikuti batas penyimpanan hosting.</p><details class="package-pending"><summary>Fitur yang belum tersedia</summary><p>${window.TEMU_PACKAGE_FEATURES.pending.map(esc).join(" · ")}. Fitur ini belum termasuk layanan aktif.</p></details></details>`;
}
function premiumAppearanceForm() {
  if (!current.packageFeatures?.premium)
    return '<section class="premium-settings"><h3>Fitur Paket Premium</h3><p>Video/streaming, gulir otomatis, peta tertanam, pilihan font dan warna aksen tersedia pada Paket Premium.</p></section>';
  return `<fieldset class="premium-settings"><legend>Pengaturan Premium</legend><label>Font nama mempelai<select name="coverFont">${[
    ["great-vibes", "Great Vibes"],
    ["georgia", "Georgia Serif"],
    ["sans", "Sans Serif"],
  ]
    .map(
      ([id, name]) =>
        `<option value="${id}" ${(current.coverFont || "great-vibes") === id ? "selected" : ""}>${name}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Warna aksen (opsional)<input name="themeAccent" type="color" value="${esc(current.themeAccent || themeDesigns[current.theme]?.ink || "#385345")}"></label><button type="button" id="resetThemeAccent">Gunakan warna bawaan tema</button><label>Link video atau live streaming<input name="videoUrl" type="url" maxlength="2000" value="${esc(current.videoUrl || "")}" placeholder="https://..."></label><label class="check-row"><input name="autoScroll" type="checkbox" ${current.autoScroll ? "checked" : ""}> Tampilkan tombol gulir otomatis</label><label class="check-row"><input name="embedMaps" type="checkbox" ${current.embedMaps ? "checked" : ""}> Tampilkan peta Google Maps dari alamat acara</label><small>Musik tetap dipilih dari pustaka pengelola. Permintaan lagu baru melalui admin.</small></fieldset>`;
}
function bindPremiumAppearance() {
  const reset = document.querySelector("#resetThemeAccent");
  if (reset)
    reset.onclick = () => {
      current.themeAccent = "";
      dirty = true;
      renderEditor();
      toast(
        "Warna bawaan tema dipilih. Tekan Simpan untuk menyimpan perubahan.",
        "info",
      );
    };
}
function applyPackageExperience(event) {
  const root = document.querySelector(".wedding-v2"),
    allowed =
      event.packageFeatures?.premium ||
      (!event.license && event.packageFeatures === undefined);
  if (!allowed) return;
  if (event.themeAccent) {
    root.classList.add("has-custom-accent");
    root.style.setProperty("--user-accent", event.themeAccent);
    root.style.setProperty("--countdown-bg", event.themeAccent);
    const color = event.themeAccent
        .slice(1)
        .match(/../g)
        .map((v) => parseInt(v, 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)),
      l = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
    root.style.setProperty("--accent-text", l > 0.179 ? "#171717" : "#ffffff");
    root.style.setProperty(
      "--countdown-text",
      l > 0.179 ? "#171717" : "#ffffff",
    );
  }
  if (event.coverFont && event.coverFont !== "great-vibes") {
    const font =
      event.coverFont === "georgia" ? "Georgia,serif" : "Arial,sans-serif";
    root
      .querySelectorAll(".wedding-title h1,.wedding-intro h2")
      .forEach((el) => el.style.setProperty("font-family", font, "important"));
  }
  if (event.videoUrl) {
    const video = document.createElement("section");
    video.className = "w-section video-section";
    video.innerHTML = `<p class="w-eyebrow">VIDEO & LIVE STREAMING</p><h2>Berbagi momen bahagia.</h2><a class="button primary" href="${esc(event.videoUrl)}" target="_blank" rel="noopener noreferrer">Buka video / live streaming ↗</a>`;
    root.querySelector("#gift").before(video);
  }
  if (event.embedMaps && event.address) {
    const iframe = document.createElement("iframe");
    iframe.title = "Peta lokasi acara";
    iframe.className = "event-map-embed";
    iframe.src =
      "https://www.google.com/maps?q=" +
      encodeURIComponent(event.address) +
      "&output=embed";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer";
    root.querySelector("#maps").append(iframe);
  }
  if (!event.autoScroll) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "auto-scroll-control";
  button.textContent = "Mulai gulir";
  button.setAttribute("aria-pressed", "false");
  root.append(button);
  let running = false,
    frame = 0,
    previousTime = 0;
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
    button.textContent = "Mulai gulir";
    button.setAttribute("aria-pressed", "false");
  };
  const tick = (time) => {
    if (!running) return;
    const panel = document.querySelector(".wedding-panel"),
      scroller =
        panel && ["auto", "scroll"].includes(getComputedStyle(panel).overflowY)
          ? panel
          : document.scrollingElement;
    const delta = previousTime ? Math.min(50, time - previousTime) : 0;
    previousTime = time;
    scroller.scrollTop += delta * 0.035;
    if (
      scroller.scrollTop + scroller.clientHeight >=
      scroller.scrollHeight - 2
    ) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  button.onclick = () => {
    if (running) {
      stop();
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      toast(
        "Gulir otomatis dimatikan oleh pengaturan pengurangan gerakan perangkat.",
        "info",
      );
      return;
    }
    running = true;
    previousTime = 0;
    button.textContent = "Hentikan gulir";
    button.setAttribute("aria-pressed", "true");
    frame = requestAnimationFrame(tick);
  };
  const visibility = () => {
    if (document.hidden) stop();
  };
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("wheel", stop, { passive: true });
  document.addEventListener("touchstart", stop, { passive: true });
  const old = window.themeMotionCleanup;
  window.themeMotionCleanup = () => {
    old?.();
    stop();
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("wheel", stop);
    document.removeEventListener("touchstart", stop);
    button.remove();
  };
}
