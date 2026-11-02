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
  return `<div class="media-box"><h3>Lagu Anda</h3><p>Unggah MP3, M4A, OGG, atau WAV yang Anda miliki izin penggunaannya. Maksimal ${appLimits.audioMB} MB dan 30 menit per lagu.</p><label class="field" for="trackName">Judul lagu<input id="trackName" maxlength="140" placeholder="Contoh: Musik pernikahan kami"></label><label class="field" for="trackFile">File lagu<input id="trackFile" type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav"></label><button type="button" id="uploadTrack">Unggah lagu</button><p id="trackProgress" role="status"></p><div class="track-library">${mediaCache.tracks.map((track) => `<article><strong>${esc(track.name)}</strong><small>${Math.round(track.duration)} detik · ${readableBytes(track.size_bytes)}</small><audio controls preload="none" src="/audio/${esc(track.id)}" aria-label="Pratinjau ${esc(track.name)}"></audio><button type="button" data-delete-track="${esc(track.id)}">Hapus lagu</button></article>`).join("")}</div><small>Unggah tidak memutar musik otomatis. Pilih lagu pada Musik latar dan tekan Simpan.</small></div>`;
}
function photoLibrary() {
  return `<details class="photo-library"><summary>Penyimpanan acara — ${readableBytes(mediaCache.usedBytes)} dari ${appLimits.eventStorageMB} MB</summary><p>Foto yang dihapus dari galeri tetap tersimpan di pustaka hingga dihapus permanen. Simpan perubahan susunan terlebih dahulu.</p><div class="library-photos">${mediaCache.photos.map((photo) => `<article><img loading="lazy" src="${esc(photo.url)}" alt="Foto dalam pustaka acara"><small>${readableBytes(photo.size_bytes)}</small><button type="button" data-reuse-photo="${esc(photo.url)}">Tambah ke galeri</button><button type="button" data-delete-photo="${esc(photo.id)}">Hapus permanen</button></article>`).join("")}</div></details>`;
}
async function refreshMedia() {
  mediaCache = await api("/api/events/" + current.id + "/media");
}
function bindMediaEditor() {
  if (step === 0) {
    document.querySelector("#uploadTrack").onclick = async () => {
      if (busy) return toast("Tunggu hingga unggahan selesai.");
      const file = document.querySelector("#trackFile").files[0],
        name = document.querySelector("#trackName").value.trim(),
        progress = document.querySelector("#trackProgress"),
        button = document.querySelector("#uploadTrack");
      if (!name || !file) return toast("Isi judul lagu dan pilih file audio.");
      if (file.size > appLimits.audioMB * 1024 * 1024)
        return toast(`Lagu maksimal ${appLimits.audioMB} MB.`);
      busy++;
      button.disabled = true;
      document.querySelector("#save").disabled = true;
      progress.textContent = "Mengunggah dan memeriksa lagu…";
      try {
        const form = new FormData();
        form.append("name", name);
        form.append("audio", file);
        const track = await api("/api/events/" + current.id + "/tracks", {
          method: "POST",
          body: form,
        });
        current.music = "track:" + track.id;
        dirty = true;
        await refreshMedia();
        renderEditor();
        toast("Lagu berhasil diunggah. Tekan Simpan untuk menggunakannya.");
      } catch (error) {
        if (progress.isConnected) progress.textContent = error.message;
        else toast(error.message);
      } finally {
        busy--;
        if (button.isConnected) button.disabled = false;
        const save = document.querySelector("#save");
        if (save) save.disabled = !!busy;
      }
    };
    document.querySelectorAll("[data-delete-track]").forEach(
      (button) =>
        (button.onclick = async () => {
          if (
            busy ||
            !confirm(
              "Hapus lagu ini? Jika sedang digunakan, musik undangan langsung menjadi None.",
            )
          )
            return;
          try {
            await api(
              `/api/events/${current.id}/tracks/${button.dataset.deleteTrack}`,
              { method: "DELETE" },
            );
            if (current.music === "track:" + button.dataset.deleteTrack) {
              current.music = "none";
              dirty = true;
            }
            await refreshMedia();
            renderEditor();
            toast("Lagu dihapus.");
          } catch (error) {
            toast(error.message);
          }
        }),
    );
  }
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
