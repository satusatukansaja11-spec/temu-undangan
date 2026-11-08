const weddingZones = {
  "Asia/Jakarta": ["+07:00", "WIB"],
  "Asia/Makassar": ["+08:00", "WITA"],
  "Asia/Jayapura": ["+09:00", "WIT"],
};
const weddingZone = (e) =>
  weddingZones[e.timezone] || weddingZones["Asia/Jakarta"];
const weddingInstant = (e) =>
  e.date && e.start
    ? new Date(`${e.date}T${e.start}:00${weddingZone(e)[0]}`)
    : null;
const weddingIcon = (name) => {
  const paths = {
    calendar: "M8 3v4m8-4v4M4 10h16M5 5h14v15H5z",
    heart: "M20 5c-3-3-6 0-8 2-2-2-5-5-8-2s0 7 8 14c8-7 11-11 8-14Z",
    map: "M12 21s7-7 7-12A7 7 0 0 0 5 9c0 5 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    photos: "M4 4h16v16H4zM4 16l5-5 5 5 3-3 3 3M15 8h.01",
    check: "m5 12 4 4L19 6",
    copy: "M9 9h11v12H9zM15 9V3H3v12h6",
    music:
      "M9 18V5l12-2v13M9 8l12-2M9 18c0 2-6 4-6 1s6-5 6-1Zm12-2c0 2-6 4-6 1s6-5 6-1Z",
    arrow: "m5 19 14-14M5 5h14v14",
  };
  return `<svg viewBox="0 0 24 24" class="w-icon" aria-hidden="true"><path d="${paths[name] || paths.heart}"/></svg>`;
};
function weddingExtraForm() {
  if (step === 5)
    return `<p class="notice">Bagikan perjalanan cinta Anda. Bagian ini opsional; maksimal 12 cerita. Tidak ada cerita yang ditampilkan sebelum Anda mengisinya.</p>${(current.stories || []).map((row, i) => `<fieldset class="repeat-row"><legend>Love story ${i + 1}</legend>${extraInput("stories", i, "title", "Judul cerita", "text", 120)}${extraInput("stories", i, "date", "Tanggal (opsional)", "date")}${extraInput("stories", i, "text", "Cerita Anda", "textarea", 2000)}<button type="button" data-remove-extra="stories:${i}">Hapus cerita ${i + 1}</button></fieldset>`).join("")}<button type="button" data-add-extra="stories" ${(current.stories || []).length >= 12 ? "disabled" : ""}>＋ Tambah cerita</button>`;
  if (step === 6)
    return `<p class="notice">Jadwal utama tetap di bagian Waktu & tempat. Tambahkan rangkaian lain, misalnya akad, pemberkatan, atau resepsi. Maksimal 8 rangkaian tambahan.</p>${(current.schedules || []).map((row, i) => `<fieldset class="repeat-row"><legend>Rangkaian acara ${i + 1}</legend>${extraInput("schedules", i, "title", "Nama rangkaian", "text", 120)}${extraInput("schedules", i, "date", "Tanggal rangkaian", "date")}<div class="form-grid">${extraInput("schedules", i, "start", "Mulai", "time")}${extraInput("schedules", i, "end", "Selesai", "time")}</div>${extraInput("schedules", i, "description", "Deskripsi rangkaian (opsional)", "textarea", 1000)}${extraInput("schedules", i, "address", "Lokasi rangkaian", "textarea", 1000)}${extraInput("schedules", i, "maps", "Link Maps rangkaian", "url", 2000)}<button type="button" data-remove-extra="schedules:${i}">Hapus rangkaian ${i + 1}</button></fieldset>`).join("")}<button type="button" data-add-extra="schedules" ${(current.schedules || []).length >= 8 ? "disabled" : ""}>＋ Tambah rangkaian</button>`;
  if (step === 7) return giftManager();
  if (step === 8)
    return `<label class="rsvp-setting"><input id="rsvpEnabled" type="checkbox" name="rsvpEnabled" ${current.rsvpEnabled !== false ? "checked" : ""}> Aktifkan formulir RSVP pada undangan publik</label><p class="notice">Nama tamu, jumlah kehadiran, dan ucapan hanya dapat dilihat pemilik acara. Tamu dapat memperbarui jawaban dari browser yang sama selama cookie masih tersedia. Pratinjau tidak mengirim RSVP.</p><div id="rsvpReport" aria-live="polite"><p>Memuat rekap RSVP…</p></div>`;
  return "";
}
function extraInput(key, i, fieldName, label, type = "text", max = 2000) {
  const id = `${key}-${i}-${fieldName}`,
    value = esc(current[key]?.[i]?.[fieldName] || "");
  const locked =
    key === "schedules" && fieldName === "date" && current.license?.lockedDate;
  const attributes = `id="${id}" data-extra="${key}:${i}:${fieldName}" maxlength="${max}" ${locked ? "disabled" : ""}`;
  return `<label class="field" for="${id}">${label}${type === "textarea" ? `<textarea ${attributes} rows="4">${value}</textarea>` : `<input ${attributes} type="${type}" value="${value}">`}</label>`;
}
function bindWeddingEditor() {
  const agenda = document.querySelector("#agendaDescription");
  if (agenda) agenda.maxLength = 1000;
  bindGiftManager();
  document.querySelectorAll("[data-extra]").forEach(
    (input) =>
      (input.oninput = () => {
        const [key, i, field] = input.dataset.extra.split(":");
        current[key][i][field] = input.value;
        dirty = true;
        document.querySelector("#dirtyText").textContent =
          "Ada perubahan yang belum disimpan.";
      }),
  );
  document.querySelectorAll("[data-add-extra]").forEach(
    (b) =>
      (b.onclick = () => {
        const key = b.dataset.addExtra;
        current[key] ||= [];
        current[key].push(
          key === "schedules" && current.license?.lockedDate
            ? { date: current.license.lockedDate }
            : {},
        );
        dirty = true;
        renderEditor();
      }),
  );
  document.querySelectorAll("[data-remove-extra]").forEach(
    (b) =>
      (b.onclick = () => {
        const [key, i] = b.dataset.removeExtra.split(":");
        current[key].splice(Number(i), 1);
        dirty = true;
        renderEditor();
      }),
  );
  if (step === 8) {
    loadRsvpReport(current.id);
    loadWishModeration(current.id);
  }
}
async function loadRsvpReport(id, page = 1) {
  if (!document.querySelector("#wishModeration"))
    document
      .querySelector("#rsvpReport")
      ?.insertAdjacentHTML("afterend", '<div id="wishModeration"></div>');
  const target = document.querySelector("#rsvpReport");
  if (!target) return;
  try {
    const result = await api(`/api/events/${id}/rsvps?page=${page}`);
    if (!target.isConnected) return;
    const labels = {
        attending: "Hadir",
        not_attending: "Tidak hadir",
        unsure: "Belum pasti",
      },
      s = result.summary;
    target.innerHTML = `<div class="rsvp-summary"><div><strong>${s.responses}</strong><span>Respons</span></div><div><strong>${s.attending}</strong><span>Hadir</span></div><div><strong>${s.guests}</strong><span>Total tamu hadir</span></div><div><strong>${s.not_attending}</strong><span>Tidak hadir</span></div><div><strong>${s.unsure}</strong><span>Belum pasti</span></div></div>${result.rows.length ? `<ul class="rsvp-responses">${result.rows.map((row) => `<li><div><strong>${esc(row.name)}</strong><span>${labels[row.attendance]}${row.attendance === "attending" ? ` · ${row.guests} orang` : ""}</span></div><p class="prose">${esc(row.message)}</p><small>${new Date(row.updated).toLocaleString("id-ID")}</small></li>`).join("")}</ul>` : "<p>Belum ada respons. Simpan undangan lengkap, lalu bagikan tautannya kepada tamu.</p>"}<div class="rsvp-pagination"><button type="button" id="refreshRsvp">Muat ulang rekap</button><button type="button" id="previousRsvp" ${result.page <= 1 ? "disabled" : ""}>Sebelumnya</button><span>${result.page} / ${result.pages}</span><button type="button" id="nextRsvp" ${result.page >= result.pages ? "disabled" : ""}>Berikutnya</button></div>`;
    target.querySelector("#refreshRsvp").onclick = () =>
      loadRsvpReport(id, page);
    target.querySelector("#previousRsvp").onclick = () =>
      loadRsvpReport(id, page - 1);
    target.querySelector("#nextRsvp").onclick = () =>
      loadRsvpReport(id, page + 1);
  } catch (e) {
    if (target.isConnected) {
      target.textContent = e.message;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Coba lagi";
      button.onclick = () => loadRsvpReport(id, page);
      target.append(button);
    }
  }
}
async function renderWedding(preview, id, themeDemo = false) {
  window.themeMotionCleanup?.();
  if (window.weddingCountdown) clearInterval(window.weddingCountdown);
  try {
    const e = await api(
        themeDemo
          ? "/api/themes/" + id + "/preview"
          : preview
            ? "/api/events/" + id
            : "/api/public/" + id,
      ),
      zone = weddingZone(e)[1];
    if (!themeDemo && preview && e.license && !e.license.paid) {
      root.innerHTML = `<main><h1>Tema acara belum aktif</h1><p>Preview tema dapat dicoba dengan data ilustrasi. Preview pribadi dan publikasi tersedia setelah pembayaran acara disetujui.</p><a class="button" href="/tema/${esc(e.theme)}">Preview tema</a><a class="button" href="/pesanan?acara=${esc(id)}">Pilih tema & bayar acara</a><a href="/dashboard">Dashboard</a></main>`;
      return;
    }
    const calendarUrl = preview
      ? `/api/events/${id}/calendar.ics`
      : `/api/public/${id}/calendar.ics`;
    const schedules = [
      {
        description: e.agendaDescription,
        title: e.ceremony || "Pernikahan kami",
        date: e.date,
        start: e.start,
        end: e.end,
        untilFinished: e.untilFinished,
        address: e.address,
        maps: e.maps,
      },
      ...(e.schedules || []),
    ];
    const hasGifts = (e.gifts || []).length || e.giftAddress,
      hasStories = (e.stories || []).length;
    document.title = `${e.groomNick || "Mempelai pria"} & ${e.brideNick || "Mempelai wanita"} — Undangan Pernikahan`;
    root.innerHTML = `<div class="invitation wedding-v2">${preview ? `<div class="preview-banner">${themeDemo ? "PRATINJAU TEMA · DATA ILUSTRASI" : e.license?.expired ? "ARSIP · MASA AKTIF BERAKHIR" : "PRATINJAU PEMILIK"} · ${e.status === "ready" ? "Siap Dibagikan" : "Draft — belum dapat dibuka publik"}</div>` : ""}
      <section class="wedding-hero" id="weddingHome">${e.cover ? `<img class="wedding-cover" src="${esc(e.cover)}" alt="Foto sampul pernikahan" fetchpriority="high">` : ""}<div class="wedding-title"><p>THE WEDDING OF</p><h1>${esc(e.groomNick || "Mempelai pria")}<i>&</i>${esc(e.brideNick || "Mempelai wanita")}</h1><span>${e.date ? date(e.date) : "Tanggal akan diumumkan"}</span><a class="button wedding-open" href="#saveDate">Buka undangan ${weddingIcon("heart")}</a><small>Dengan bahagia, kami mengundang Anda.</small></div><span class="cover-caption">SEBUAH JANJI, UNTUK SELAMANYA</span></section>
      <section class="w-section save-date" id="saveDate"><p class="w-eyebrow">SAVE THE DATE</p><h2>Menuju hari bahagia.</h2><p>${e.date ? date(e.date) : "Tanggal belum diisi"}${e.start ? ` · ${esc(e.start)} ${zone}` : ""}</p><div class="countdown" role="timer" aria-label="Hitung mundur hari pernikahan"><div><strong id="countDays">00</strong><span>Hari</span></div><div><strong id="countHours">00</strong><span>Jam</span></div><div><strong id="countMinutes">00</strong><span>Menit</span></div><div><strong id="countSeconds">00</strong><span>Detik</span></div></div><p id="countdownStatus" class="countdown-status"></p>${!themeDemo && e.date && e.start && e.end ? `<a class="button primary calendar-button" href="${calendarUrl}" download="undangan-pernikahan.ics">${weddingIcon("calendar")} Simpan ke kalender</a><small class="calendar-hint">Unduh file kalender, lalu buka untuk menambahkan pengingat.</small>` : ""}</section>
      <section class="w-section w-couple" id="couple"><p class="w-eyebrow">MEMPELAI</p><h2>Dua hati, satu perjalanan.</h2><p class="prose opening-text">${esc(e.opening)}</p><div class="couple">${[
        ["groom", "Mempelai pria"],
        ["bride", "Mempelai wanita"],
      ]
        .map(
          ([key, label]) =>
            `<article class="partner"><div class="partner-photo">${e[key + "Photo"] ? `<img loading="lazy" src="${esc(e[key + "Photo"])}" alt="${esc(e[key + "Name"] || label)}" width="280" height="350">` : "<span>Foto belum diisi</span>"}</div><p class="partner-role">${label}</p><h3>${esc(e[key + "Name"])}</h3><p class="prose">${esc(e[key + "Info"])}</p></article>`,
        )
        .join('<span class="amp" aria-hidden="true">&</span>')}</div></section>
      ${hasStories ? `<section class="w-section love-story" id="loveStory"><p class="w-eyebrow">LOVE STORY</p><h2>Cerita yang membawa kami ke sini.</h2><ol class="story-timeline">${e.stories.map((story, i) => `<li><span class="story-number">${String(i + 1).padStart(2, "0")}</span><div>${story.date ? `<time datetime="${esc(story.date)}">${date(story.date)}</time>` : ""}<h3>${esc(story.title)}</h3><p class="prose">${esc(story.text)}</p></div></li>`).join("")}</ol></section>` : ""}
      <section class="w-section schedule-section" id="schedule"><p class="w-eyebrow">HARI BAHAGIA KAMI</p><h2>Susunan Acara</h2>${scheduleTimeline(schedules, zone)}</section>
      <section class="w-section maps-section" id="maps"><p class="w-eyebrow">MAPS</p><h2>Sampai jumpa di sana.</h2><p>Buka petunjuk arah untuk menuju lokasi acara.</p><div class="map-locations">${schedules.map((row) => `<article>${weddingIcon("map")}<h3>${esc(row.title)}</h3><p class="prose">${esc(row.address)}</p>${row.maps ? `<a class="button primary" href="${esc(row.maps)}" target="_blank" rel="noopener noreferrer">Buka Maps ${weddingIcon("arrow")}</a>` : "<p>Lokasi belum diisi.</p>"}</article>`).join("")}</div></section>
      ${e.gallery?.length ? `<section class="w-section gallery-section" id="gallery"><p class="w-eyebrow">PHOTO GALLERY</p><h2>Kenangan yang kami simpan.</h2><p>Sentuh foto untuk melihat lebih dekat.</p><div class="public-gallery">${e.gallery.map((photo, i) => `<button type="button" data-gallery="${i}" aria-label="Perbesar foto galeri ${i + 1}"><img loading="lazy" src="${esc(photo)}" alt="Kenangan kedua mempelai ${i + 1}" width="480" height="600"></button>`).join("")}</div></section>` : ""}
      ${hasGifts ? `<section class="w-section gift-section" id="gift"><p class="w-eyebrow">WEDDING GIFT</p><h2>Doa Anda adalah hadiah terindah.</h2><p>Jika ingin memberikan tanda kasih, Anda dapat menggunakan informasi berikut.</p><div class="gift-list">${(e.gifts || []).map((gift, i) => `<article><span>${esc(gift.bank)}</span><label class="sr-only" for="giftAccount${i}">Nomor ${esc(gift.bank)}</label><input id="giftAccount${i}" class="gift-number" value="${esc(gift.account)}" readonly><p>Atas nama ${esc(gift.holder)}</p><button type="button" class="button" data-copy-gift="${i}">${weddingIcon("copy")} Salin nomor</button></article>`).join("")}</div>${e.giftAddress ? `<div class="gift-address"><h3>Pengiriman hadiah</h3><p class="prose">${esc(e.giftAddress)}</p></div>` : ""}<small>Pastikan nomor dan nama penerima sesuai sebelum mengirim. Temu tidak memproses transfer.</small></section>` : ""}
      ${e.rsvpEnabled !== false ? `<section class="w-section rsvp-section" id="rsvp"><p class="w-eyebrow">RSVP</p><h2>Kami menantikan kehadiran Anda.</h2><p>Konfirmasikan kehadiran dan titipkan doa untuk kami.</p><form id="rsvpForm"><label for="guestRsvpName">Nama Anda *</label><input id="guestRsvpName" name="name" maxlength="100" autocomplete="name" required><label for="guestAttendance">Konfirmasi kehadiran *</label><select id="guestAttendance" name="attendance" required><option value="">Pilih kehadiran</option><option value="attending">Ya, saya akan hadir</option><option value="not_attending">Maaf, saya tidak dapat hadir</option><option value="unsure">Saya belum dapat memastikan</option></select><label for="guestMessage">Ucapan untuk mempelai (opsional)</label><textarea id="guestMessage" name="message" rows="4" maxlength="1000"></textarea><label class="wish-consent"><input id="guestPublish" name="publishMessage" type="checkbox"> Saya mengizinkan nama dan ucapan saya tampil publik di undangan ini.</label><p id="rsvpFeedback" role="status" aria-live="polite"></p><button class="button primary" id="sendRsvp" ${preview ? "disabled" : ""}>${weddingIcon("check")} ${preview ? "RSVP tidak dikirim dari pratinjau" : "Kirim konfirmasi"}</button><small>Respons kehadiran tetap privat. Nama dan ucapan hanya ditampilkan publik jika Anda menyetujuinya. Ubah jawaban/persetujuan dari browser yang sama selama cookie tersedia.</small></form></section>` : ""}
      ${e.rsvpEnabled !== false ? `<section class="w-section wishes-section" id="wishes"><p class="w-eyebrow">TITIPKAN DOA UNTUK MEMPELAI</p><h2>Ucapan dan Doa Para Tamu</h2><div id="publicWishes" aria-live="polite"><p>Memuat ucapan…</p></div></section>` : ""}
      <section class="w-section closing"><div class="invitation-brand">${siteBrand}</div><p class="prose">${esc(e.closing)}</p><h2>${esc(e.groomNick)} & ${esc(e.brideNick)}</h2><small>Dirangkai dengan sepenuh hati bersama temu.</small></section>
      <nav class="wedding-nav" aria-label="Navigasi undangan"><a href="#weddingHome">${weddingIcon("heart")}<span>Awal</span></a><a href="#couple">${weddingIcon("heart")}<span>Mempelai</span></a><a href="#schedule">${weddingIcon("calendar")}<span>Acara</span></a><a href="#maps">${weddingIcon("map")}<span>Maps</span></a>${e.gallery?.length ? `<a href="#gallery">${weddingIcon("photos")}<span>Galeri</span></a>` : ""}${e.rsvpEnabled !== false ? `<a href="#rsvp">${weddingIcon("check")}<span>RSVP</span></a>` : ""}${e.music === "piano" || e.music?.startsWith("track:") ? `<button type="button" id="musicToggle" aria-pressed="false" aria-label="Putar musik">${weddingIcon("music")}<span>Musik</span></button>` : ""}</nav>
      ${e.music === "piano" || e.music?.startsWith("track:") ? `<audio id="audio" loop src="${e.music === "piano" ? "/music/piano.wav" : "/audio/" + esc(e.music.slice(6))}" preload="none"></audio>` : ""}
      <dialog class="gallery-lightbox" id="galleryLightbox" aria-labelledby="galleryTitle"><div class="lightbox-header"><span id="galleryTitle">Galeri foto</span><button id="closeGallery" aria-label="Tutup galeri">×</button></div><img id="galleryLarge" alt=""><div class="lightbox-controls"><button id="previousPhoto" aria-label="Foto sebelumnya">←</button><span id="galleryCounter"></span><button id="nextPhoto" aria-label="Foto berikutnya">→</button></div></dialog></div>`;
    applyNavyTheme(e);
    if (e.theme === "sakura") applySakuraTheme();
    applyDesignedTheme(e);
    if (themeDemo) {
      const banner = document.querySelector(".preview-banner");
      banner.insertAdjacentHTML(
        "beforeend",
        `<div class="demo-actions"><a href="/#tema">← Katalog</a><a href="/pesanan?tema=${esc(id)}">Select / Order</a></div>`,
      );
    }
    startWeddingCountdown(e);
    bindWeddingGallery(e.gallery || []);
    document.querySelectorAll("[data-copy-gift]").forEach(
      (button) =>
        (button.onclick = async () => {
          const input = document.querySelector(
            "#giftAccount" + button.dataset.copyGift,
          );
          try {
            if (!navigator.clipboard?.writeText) throw Error();
            await navigator.clipboard.writeText(input.value);
            toast("Nomor berhasil disalin.");
          } catch {
            input.focus();
            input.select();
            toast("Nomor sudah dipilih. Gunakan Salin pada perangkat Anda.");
          }
        }),
    );
    if (e.rsvpEnabled !== false) {
      bindGuestRsvp(id, preview);
      loadPublicWishes(id, preview, themeDemo);
    }
    if (e.music === "piano" || e.music?.startsWith("track:")) {
      const audio = document.querySelector("#audio"),
        button = document.querySelector("#musicToggle");
      const syncMusic = () => {
        const playing = !audio.paused;
        button.innerHTML =
          weddingIcon("music") + `<span>${playing ? "Jeda" : "Musik"}</span>`;
        button.setAttribute(
          "aria-label",
          playing ? "Jeda musik" : "Putar musik",
        );
        button.setAttribute("aria-pressed", String(playing));
      };
      audio.addEventListener("play", syncMusic);
      audio.addEventListener("pause", syncMusic);
      audio.addEventListener("error", () => {
        audio.pause();
        syncMusic();
      });
      button.onclick = async () => {
        button.disabled = true;
        try {
          if (audio.paused) await audio.play();
          else audio.pause();
        } catch {
          toast(
            "Musik belum dapat diputar. Tekan tombol Musik untuk mencoba lagi.",
          );
        } finally {
          syncMusic();
          button.disabled = false;
        }
      };
    }
  } catch (error) {
    root.innerHTML = `<div class="not-found"><h1>Undangan belum ditemukan.</h1><p>${esc(error.message)}</p><a class="button" href="/">Kembali ke beranda</a></div>`;
  }
}
function startWeddingCountdown(e) {
  const target = weddingInstant(e),
    status = document.querySelector("#countdownStatus");
  if (!target || Number.isNaN(target.getTime())) {
    status.textContent =
      "Lengkapi tanggal dan waktu acara untuk memulai hitung mundur.";
    return;
  }
  const update = () => {
    if (!status.isConnected) {
      clearInterval(window.weddingCountdown);
      return;
    }
    const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const values = [
      Math.floor(remaining / 86400),
      Math.floor(remaining / 3600) % 24,
      Math.floor(remaining / 60) % 60,
      remaining % 60,
    ];
    ["countDays", "countHours", "countMinutes", "countSeconds"].forEach(
      (key, i) =>
        (document.getElementById(key).textContent = String(values[i]).padStart(
          2,
          "0",
        )),
    );
    status.textContent = remaining
      ? `Menuju acara · ${weddingZone(e)[1]}`
      : "Hari bahagia telah tiba. Terima kasih atas doa Anda.";
    if (!remaining && window.weddingCountdown)
      clearInterval(window.weddingCountdown);
  };
  update();
  if (target > Date.now()) window.weddingCountdown = setInterval(update, 1000);
}
function bindWeddingGallery(photos) {
  const dialog = document.querySelector("#galleryLightbox");
  let index = 0;
  const show = (i) => {
    index = (i + photos.length) % photos.length;
    const image = document.querySelector("#galleryLarge");
    image.src = photos[index];
    image.alt = `Kenangan kedua mempelai ${index + 1}`;
    document.querySelector("#galleryCounter").textContent =
      `${index + 1} / ${photos.length}`;
  };
  document.querySelectorAll("[data-gallery]").forEach(
    (button) =>
      (button.onclick = () => {
        show(Number(button.dataset.gallery));
        dialog.showModal();
      }),
  );
  document.querySelector("#closeGallery").onclick = () => dialog.close();
  document.querySelector("#previousPhoto").onclick = () => show(index - 1);
  document.querySelector("#nextPhoto").onclick = () => show(index + 1);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      show(index + 1);
    }
  });
}
async function bindGuestRsvp(slug, preview) {
  const form = document.querySelector("#rsvpForm"),
    feedback = document.querySelector("#rsvpFeedback"),
    attendance = document.querySelector("#guestAttendance");
  let savedGuests = 1;
  const setResponse = (response) => {
    form.elements.name.value = response.name;
    attendance.value = response.attendance;
    savedGuests = Number(response.guests) || 1;
    form.elements.message.value = response.message;
    form.elements.publishMessage.checked = response.publishMessage === true;
  };
  if (preview) {
    feedback.textContent =
      "Mode pratinjau: formulir hanya contoh. Kirim melalui URL publik setelah undangan siap dibagikan.";
    form.onsubmit = (event) => event.preventDefault();
    return;
  }
  let editing = false;
  form.addEventListener("input", () => (editing = true));
  try {
    const result = await api(`/api/public/${slug}/rsvp`);
    if (form.isConnected && result.response && !editing) {
      setResponse(result.response);
      feedback.textContent =
        "Konfirmasi sebelumnya sudah dimuat. Anda dapat mengubahnya lalu mengirim kembali.";
    }
  } catch {
    if (form.isConnected)
      feedback.textContent =
        "Jawaban sebelumnya belum dapat dimuat. Periksa koneksi dan muat ulang halaman sebelum mengirim ulang.";
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = document.querySelector("#sendRsvp");
    button.disabled = true;
    feedback.textContent = "Menyimpan konfirmasi…";
    try {
      const result = await api(`/api/public/${slug}/rsvp`, {
        method: "POST",
        body: JSON.stringify({
          name: form.elements.name.value,
          attendance: attendance.value,
          guests:
            attendance.value === "attending" ? Math.max(1, savedGuests) : 0,
          message: form.elements.message.value,
          publishMessage: form.elements.publishMessage.checked,
        }),
      });
      setResponse(result.response);
      loadPublicWishes(slug, false, false);
      feedback.textContent = result.updated
        ? "Konfirmasi berhasil diperbarui. Terima kasih!"
        : "Konfirmasi berhasil disimpan. Terima kasih!";
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
