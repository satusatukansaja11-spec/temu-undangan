function applyThemeBackgrounds(event, defaults, skin) {
  const invitation = document.querySelector(".wedding-v2");
  if (skin) invitation.classList.add(skin);
  for (const section of invitation.querySelectorAll(
    ".w-section,.wedding-hero",
  )) {
    const slot = section.matches(".wedding-hero,.wedding-intro")
        ? "cover"
        : "inside",
      image = event.themeImages?.[slot] || defaults[slot];
    if (!image) continue;
    section.classList.add("has-theme-background");
    const layer = document.createElement("div");
    layer.className = "theme-scenery meihua-scenery";
    layer.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.loading = slot === "cover" ? "eager" : "lazy";
    layer.append(img);
    section.prepend(layer);
  }
}
function applyMeihuaTheme(event) {
  applyThemeBackgrounds(event, themeDesigns.meihua, "wedding-meihua");
}
function applyDesignedTheme(event) {
  const id = event.theme || "navy";
  if (id === "meihua") return applyMeihuaTheme(event);
  if (id === "jawa" || id === "islami")
    return applyThemeBackgrounds(event, themeDesigns[id], "wedding-" + id);
  if (event.themeImages?.cover || event.themeImages?.inside)
    return applyThemeBackgrounds(
      event,
      id === "navy"
        ? { cover: themeDesigns.navy.cover, inside: null }
        : themeDesigns[id],
      "wedding-custom-" + id,
    );
}
let adminBackgroundTheme = "navy";
async function mountThemeAssets() {
  const rows = await api("/api/admin/theme-assets"),
    host = document.querySelector("#adminContent");
  host.insertAdjacentHTML(
    "beforeend",
    `<section class="admin-section" id="adminBackgrounds"><h2>Menu Latar</h2><label for="adminThemeSelect">Pilih tema<select id="adminThemeSelect">${Object.entries(
      themeNames,
    )
      .map(
        ([id, name]) =>
          `<option value="${id}" ${id === adminBackgroundTheme ? "selected" : ""}>${esc(name)}</option>`,
      )
      .join(
        "",
      )}</select></label><p>Atur gambar sampul dan isi per tema. Foto pribadi mempelai tetap berasal dari data acara masing-masing. Gunakan JPG/PNG/WebP maksimal 10 MB.</p><div id="themeBackgroundFields"></div></section>`,
  );
  function previewPrices() {
    for (const row of rows) {
      if (row.slot !== "cover") continue;
      const img = document
        .querySelector(`[name="price_${row.theme_id}"]`)
        ?.closest("article")
        ?.querySelector("img");
      if (img) img.src = "/theme-assets/" + row.id;
    }
  }
  function renderFields() {
    const id = adminBackgroundTheme,
      design = themeDesigns[id];
    document.querySelector("#themeBackgroundFields").innerHTML =
      `<h3>Latar ${esc(design.name)}</h3><div class="theme-upload-grid">${[
        ["cover", "Sampul / halaman pertama"],
        ["inside", "Isi undangan"],
      ]
        .map(([slot, label]) => {
          const current = rows.find(
            (r) => r.theme_id === id && r.slot === slot,
          );
          return `<form data-theme-image="${slot}" data-theme="${id}"><h3>${label}</h3><img class="theme-image-preview" src="${current ? "/theme-assets/" + esc(current.id) : design[slot]}" alt="Latar ${esc(design.name)} — ${label}"><label>File latar<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="primary">Unggah latar</button><p role="status"></p></form>`;
        })
        .join("")}</div>`;
    host.querySelectorAll("[data-theme-image]").forEach(
      (form) =>
        (form.onsubmit = async (e) => {
          e.preventDefault();
          const b = form.querySelector("button"),
            feedback = form.querySelector('[role="status"]');
          b.disabled = true;
          feedback.textContent = "Mengunggah latar…";
          try {
            const data = await api(
              "/api/admin/theme-assets/" +
                form.dataset.theme +
                "/" +
                form.dataset.themeImage,
              { method: "POST", body: new FormData(form) },
            );
            form.querySelector("img").src = data.url;
            const index = rows.findIndex(
              (r) =>
                r.theme_id === form.dataset.theme &&
                r.slot === form.dataset.themeImage,
            );
            if (index >= 0) rows.splice(index, 1);
            rows.push({
              theme_id: form.dataset.theme,
              slot: form.dataset.themeImage,
              id: data.url.split("/").pop(),
            });
            previewPrices();
            feedback.textContent =
              "Latar disimpan dan digunakan katalog/undangan.";
          } catch (error) {
            feedback.textContent = error.message;
          } finally {
            b.disabled = false;
          }
        }),
    );
  }
  document.querySelector("#adminThemeSelect").onchange = (e) => {
    adminBackgroundTheme = e.target.value;
    renderFields();
  };
  renderFields();
  previewPrices();
}
