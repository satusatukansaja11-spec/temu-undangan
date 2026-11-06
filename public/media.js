let appLimits = {
  galleryPhotos: 200,
  eventPhotos: 1000,
  imageMB: 10,
  audioMB: 30,
  eventStorageMB: 2048,
  eventTracks: 20,
};
let mediaCache = { photos: [], tracks: [], usedBytes: 0 };
const readableBytes = (bytes) =>
  bytes >= 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(1) + " MB"
    : Math.ceil(bytes / 1024) + " KB";
function musicOptions() {
  return (
    `<option value="none" ${!current.music || current.music === "none" ? "selected" : ""}>None — tanpa musik</option><option value="piano" ${current.music === "piano" ? "selected" : ""}>Melodi Temu — instrumental orisinal</option>` +
    mediaCache.tracks
      .map(
        (track) =>
          `<option value="track:${esc(track.id)}" ${current.music === "track:" + track.id ? "selected" : ""}>${esc(track.name)}</option>`,
      )
      .join("")
  );
}
function musicUploadForm() {
  return `<div class="media-box"><h3>Pustaka musik</h3><p>Pilih lagu yang disediakan pengelola pada Musik latar, lalu tekan Simpan. Untuk permintaan lagu baru, hubungi admin.</p>${me?.isAdmin ? '<a class="button" href="/admin">Kelola musik di panel admin</a>' : ""}</div>`;
}
function photoLibrary() {
  return `<details class="photo-library"><summary>Penyimpanan acara — ${readableBytes(mediaCache.usedBytes)} dari ${appLimits.eventStorageMB} MB</summary><p>Foto yang dihapus dari galeri tetap tersimpan di pustaka hingga dihapus permanen. Simpan perubahan susunan terlebih dahulu.</p><div class="library-photos">${mediaCache.photos.map((photo) => `<article><img loading="lazy" src="${esc(photo.url)}" alt="Foto dalam pustaka acara"><small>${readableBytes(photo.size_bytes)}</small><button type="button" data-reuse-photo="${esc(photo.url)}">Tambah ke galeri</button><button type="button" data-delete-photo="${esc(photo.id)}">Hapus permanen</button></article>`).join("")}</div></details>`;
}
async function refreshMedia() {
  mediaCache = await api("/api/events/" + current.id + "/media");
}
function bindMediaEditor() {
  if (step === 3) {
    document.querySelectorAll("[data-reuse-photo]").forEach(
      (button) =>
        (button.onclick = () => {
          if (busy) return toast("Tunggu hingga unggahan selesai.");
          if (current.gallery.includes(button.dataset.reusePhoto))
            return toast("Foto sudah ada di galeri.");
          if (current.gallery.length >= appLimits.galleryPhotos)
            return toast("Batas galeri tercapai.");
          current.gallery.push(button.dataset.reusePhoto);
          dirty = true;
          renderEditor();
        }),
    );
    document.querySelectorAll("[data-delete-photo]").forEach(
      (button) =>
        (button.onclick = async () => {
          if (
            busy ||
            !confirm(
              "Hapus foto dari penyimpanan secara permanen? Foto yang masih dipakai harus dilepas dari formulir lalu disimpan terlebih dahulu.",
            )
          )
            return;
          try {
            await api(
              `/api/events/${current.id}/photos/${button.dataset.deletePhoto}`,
              { method: "DELETE" },
            );
            await refreshMedia();
            renderEditor();
            toast("Foto dihapus permanen.");
          } catch (error) {
            toast(error.message);
          }
        }),
    );
  }
}
