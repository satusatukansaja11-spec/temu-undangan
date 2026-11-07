function applyMeihuaTheme(event) {
  const invitation = document.querySelector(".wedding-v2");
  invitation.classList.add("wedding-meihua");
  for (const section of invitation.querySelectorAll(
    ".w-section,.wedding-hero",
  )) {
    const cover = section.matches(".wedding-hero,.wedding-intro");
    const image = cover
      ? event.themeImages?.cover || "/assets/meihua-cover.svg"
      : event.themeImages?.inside || "/assets/meihua-mountains.svg";
    const scenery = document.createElement("div");
    scenery.className = "meihua-scenery";
    scenery.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.loading = cover ? "eager" : "lazy";
    scenery.append(img);
    section.prepend(scenery);
  }
}
async function mountThemeAssets() {
  const rows = await api("/api/admin/theme-assets"),
    host = document.querySelector("#adminContent");
  host.insertAdjacentHTML(
    "beforeend",
    `<section class="admin-section"><h2>Latar Meihua Pavilion</h2><p>Unggah gambar pertama (bunga plum merah) untuk sampul dan gambar kedua (pegunungan/paviliun) untuk halaman isi. Tanpa unggahan, tema memakai ilustrasi vektor contoh, bukan gambar asli referensi.</p><div class="theme-upload-grid">${[
      ["cover", "Gambar pertama — sampul", "/assets/meihua-cover.svg"],
      ["inside", "Gambar kedua — isi", "/assets/meihua-mountains.svg"],
    ]
      .map(([slot, label, fallback]) => {
        const existing = rows.find(
          (r) => r.theme_id === "meihua" && r.slot === slot,
        );
        return `<form data-theme-image="${slot}"><h3>${label}</h3><img src="${existing ? "/theme-assets/" + esc(existing.id) : fallback}" alt="${label}" class="theme-image-preview"><label>File JPG, PNG, WebP (maksimal 10 MB)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="primary">Unggah latar</button><p role="status"></p></form>`;
      })
      .join("")}</div></section>`,
  );
  const initial = rows.find(
    (row) => row.theme_id === "meihua" && row.slot === "cover",
  );
  const priceImage = document
    .querySelector('[name="price_meihua"]')
    ?.closest("article")
    ?.querySelector("img");
  if (initial && priceImage) priceImage.src = "/theme-assets/" + initial.id;
  host.querySelectorAll("[data-theme-image]").forEach(
    (form) =>
      (form.onsubmit = async (e) => {
        e.preventDefault();
        const b = form.querySelector("button"),
          feedback = form.querySelector('[role="status"]');
        b.disabled = true;
        try {
          const data = await api(
            "/api/admin/theme-assets/meihua/" + form.dataset.themeImage,
            { method: "POST", body: new FormData(form) },
          );
          form.querySelector("img").src = data.url;
          if (form.dataset.themeImage === "cover" && priceImage)
            priceImage.src = data.url;
          feedback.textContent =
            "Latar disimpan dan digunakan katalog/undangan.";
        } catch (e) {
          feedback.textContent = e.message;
        } finally {
          b.disabled = false;
        }
      }),
  );
}
