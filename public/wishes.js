async function loadPublicWishes(id, preview = false, demo = false, page = 1) {
  const target = document.querySelector("#publicWishes");
  if (!target) return;
  try {
    const data = demo
      ? {
          rows: [
            {
              name: "Tamu Contoh",
              message:
                "Semoga menjadi keluarga yang penuh cinta, kebahagiaan, dan keberkahan. 🌸",
              updated: "2028-06-01T10:00:00Z",
            },
          ],
          total: 1,
          attending: 1,
          page: 1,
          pages: 1,
        }
      : await api(
          preview
            ? `/api/events/${id}/wishes?public=1&page=${page}`
            : `/api/public/${id}/wishes?page=${page}`,
        );
    if (!target.isConnected) return;
    target.innerHTML = `${demo ? '<p class="notice">Ucapan ilustrasi untuk preview tema.</p>' : ""}<div class="wish-totals"><span>Jumlah: ${data.total} Ucapan</span><span>${data.attending} orang menyatakan hadir</span></div><div class="wishes-list" tabindex="0" role="region" aria-label="Daftar ucapan dan doa yang bisa digulir">${data.rows.length ? data.rows.map((w) => `<article><h3>${esc(w.name)}</h3><p>${esc(w.message)}</p><time datetime="${esc(w.updated)}">${esc(new Date(w.updated).toLocaleString("id-ID"))}</time></article>`).join("") : "<p>Belum ada ucapan publik. Jadilah yang pertama menitipkan doa melalui formulir RSVP di atas.</p>"}</div><div class="wish-pagination"><button type="button" id="wishPrevious" ${data.page <= 1 ? "disabled" : ""}>Sebelumnya</button><span>${data.page} / ${data.pages}</span><button type="button" id="wishNext" ${data.page >= data.pages ? "disabled" : ""}>Berikutnya</button><button type="button" id="wishRefresh">Muat ulang</button></div>`;
    target.querySelector("#wishPrevious").onclick = () =>
      loadPublicWishes(id, preview, demo, page - 1);
    target.querySelector("#wishNext").onclick = () =>
      loadPublicWishes(id, preview, demo, page + 1);
    target.querySelector("#wishRefresh").onclick = () =>
      loadPublicWishes(id, preview, demo, page);
  } catch (e) {
    if (target.isConnected) {
      target.innerHTML = `<p role="alert">${esc(e.message)}</p><button type="button" id="retryWishes">Coba lagi</button>`;
      target.querySelector("#retryWishes").onclick = () =>
        loadPublicWishes(id, preview, demo, page);
    }
  }
}
async function loadWishModeration(id, page = 1) {
  const target = document.querySelector("#wishModeration");
  if (!target) return;
  try {
    const data = await api(`/api/events/${id}/wishes?page=${page}`);
    if (!target.isConnected) return;
    target.innerHTML = `<h3>Ucapan yang disetujui untuk publik</h3><p>Ucapan RSVP lama tanpa persetujuan tidak ditampilkan. Anda dapat menyembunyikan ucapan yang tidak sesuai.</p>${data.rows.map((w) => `<article class="moderation-wish"><strong>${esc(w.name)}</strong><p>${esc(w.message)}</p><button type="button" data-moderate-wish="${esc(w.id)}" data-hidden="${w.hidden}">${w.hidden ? "Tampilkan kembali" : "Sembunyikan"}</button></article>`).join("") || "<p>Belum ada ucapan yang mendapat persetujuan publik.</p>"}<div class="wish-pagination"><button type="button" id="moderationPrev" ${data.page <= 1 ? "disabled" : ""}>Sebelumnya</button><span>${data.page}/${data.pages}</span><button type="button" id="moderationNext" ${data.page >= data.pages ? "disabled" : ""}>Berikutnya</button></div>`;
    target.querySelector("#moderationPrev").onclick = () =>
      loadWishModeration(id, page - 1);
    target.querySelector("#moderationNext").onclick = () =>
      loadWishModeration(id, page + 1);
    target.querySelectorAll("[data-moderate-wish]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          try {
            await api(`/api/events/${id}/wishes/${b.dataset.moderateWish}`, {
              method: "PATCH",
              body: JSON.stringify({ visible: b.dataset.hidden === "1" }),
            });
            await loadWishModeration(id, page);
          } catch (e) {
            toast(e.message);
            b.disabled = false;
          }
        }),
    );
  } catch (e) {
    if (target.isConnected)
      target.innerHTML = `<p role="alert">${esc(e.message)}</p>`;
  }
}
