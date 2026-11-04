const root = document.querySelector("#app");
let me,
  csrf,
  events = [],
  current = null,
  step = 0,
  filter = "all",
  query = "",
  busy = 0,
  dirty = false;
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const labels = {
  name: "Nama acara",
  cover: "Foto sampul",
  groomPhoto: "Foto mempelai pria",
  groomName: "Nama lengkap pria",
  groomNick: "Nama panggilan pria",
  bridePhoto: "Foto mempelai wanita",
  brideName: "Nama lengkap wanita",
  brideNick: "Nama panggilan wanita",
  religion: "Agama",
  date: "Tanggal",
  start: "Waktu mulai",
  end: "Waktu selesai",
  address: "Alamat",
  maps: "Link Maps",
  opening: "Ucapan pembuka",
  closing: "Ucapan penutup",
};
const steps = [
  "Info & tampilan",
  "Mempelai",
  "Waktu & tempat",
  "Galeri foto",
  "Ucapan",
  "Love story",
  "Susunan acara",
  "Titip Hadiah",
  "RSVP",
];
const greetings = {
  Islam:
    "Assalamu’alaikum warahmatullahi wabarakatuh. Dengan memohon rahmat dan rida Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri pernikahan kami.",
  Kristen:
    "Salam sejahtera dalam kasih Tuhan. Dengan penuh syukur, kami mengundang Anda untuk merayakan pernikahan kami.",
  Katolik:
    "Salam damai dalam kasih Kristus. Dengan penuh syukur, kami mengundang Anda untuk menghadiri pernikahan kami.",
  Hindu:
    "Om Swastiastu. Dengan memohon anugerah Ida Sang Hyang Widhi Wasa, kami mengundang Anda untuk menghadiri pernikahan kami.",
  Buddha:
    "Namo Buddhaya. Dengan penuh sukacita, kami mengundang Anda untuk menghadiri pernikahan kami.",
  Konghucu:
    "Wei De Dong Tian. Dengan penuh rasa syukur, kami mengundang Anda untuk merayakan pernikahan kami.",
  Umum: "Dengan penuh kebahagiaan, kami mengundang Anda untuk menjadi bagian dari hari pernikahan kami.",
};
function toast(t) {
  const el = document.querySelector("#toast");
  el.textContent = t;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 6000);
}
async function api(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-CSRF-Token": csrf || "",
      ...options.headers,
    },
  });
  const d = await r
    .json()
    .catch(() => ({ error: "Koneksi ke server bermasalah." }));
  if (!r.ok) {
    if (r.status === 401 && url.startsWith("/api/")) {
      me = null;
      login();
    }
    throw Error(d.error || "Tindakan gagal. Coba kembali.");
  }
  return d;
}
const logo = '<a href="/dashboard" class="brand">temu<span>✳</span></a>';
function shell(content) {
  root.innerHTML = `<aside>${logo}<div class="workspace">RUANG PERNIKAHAN ANDA</div><nav><button class="nav active" id="dashboardLink">▦ <span>Undangan saya</span></button></nav><div class="aside-bottom"><div class="tiny-flower">✳</div><h3>Awal cerita indah.</h3><p>Satu undangan, sejuta kenangan.</p></div><div class="user"><span class="avatar">${esc((me.name || "U")[0])}</span><div><strong>${esc(me.name)}</strong><small>Akun pribadi</small></div><button id="logout" title="Keluar akun" aria-label="Keluar akun">↗</button></div></aside><div class="main"><header><span>Ruang pribadi <i>/</i> <b>Undangan saya</b></span><span class="header-note">Dibuat dengan sepenuh hati ♡</span></header>${content}<footer>temu ✳ <span>Tempat cerita bahagia dimulai.</span><small>Undangan pernikahan digital</small></footer></div>`;
  document.querySelector("#dashboardLink").onclick = () => leave(dashboard);
  document.querySelector("#logout").onclick = async () =>
    leave(async () => {
      await api("/api/logout", { method: "POST" });
      location.href = "/";
    });
}
function leave(fn) {
  if (busy) return toast("Tunggu hingga unggahan selesai.");
  if (
    dirty &&
    !confirm("Ada perubahan yang belum disimpan. Tinggalkan halaman?")
  )
    return;
  dirty = false;
  fn();
}
function login(info = {}) {
  renderLogin(info);
}
async function dashboard() {
  current = null;
  try {
    events = await api("/api/events");
    renderDashboard();
  } catch (e) {
    toast(e.message);
  }
}
function renderDashboard() {
  const ready = events.filter((e) => e.status === "ready").length;
  shell(
    `<main><div class="page-heading"><div><p class="eyebrow">SETIAP CERITA PUNYA AWAL</p><h1>Undangan saya<span class="serif-dot">.</span></h1><p>Kelola undangan, rangkai momen yang tak terlupakan.</p></div><button class="primary" id="add">＋ &nbsp; Tambah Acara</button></div><section class="hero"><div><span class="pill">✧ &nbsp; SEBUAH AWAL YANG INDAH</span><h2>Hari istimewa.<br>Undangan penuh cerita.</h2><p>Hadirkan kehangatan hari bahagia Anda,<br>bahkan sebelum para tamu tiba.</p><button id="heroAdd">Buat undangan Anda &nbsp; ↗</button></div><div class="hero-art" aria-hidden="true"><div class="sun"></div><div class="invite-paper"><div class="paper-border"><small>THE WEDDING OF</small><div>Anda<br><i>&</i><br>Pasangan</div><span>SEBUAH JANJI, SELAMANYA</span><b>✳</b></div></div><div class="stem stem-one"></div><div class="stem stem-two"></div><span class="art-caption">a little love, a lasting memory</span></div></section><section class="stats"><div><span class="stat-icon">▦</span><div><small>Total undangan</small><strong>${events.length.toString().padStart(2, "0")}</strong></div></div><div><span class="stat-icon green">↗</span><div><small>Siap dibagikan</small><strong>${ready.toString().padStart(2, "0")}</strong></div></div><div><span class="stat-icon gold">✎</span><div><small>Masih dirangkai</small><strong>${(events.length - ready).toString().padStart(2, "0")}</strong></div></div></section><div class="list-heading"><h2>Koleksi undangan <span>${events.length}</span></h2><label class="search"><span>⌕</span><input id="search" aria-label="Cari undangan" placeholder="Cari nama acara…" value="${esc(query)}"></label></div><div class="tabs"><button data-filter="all" class="${filter === "all" ? "selected" : ""}">Semua undangan</button><button data-filter="ready" class="${filter === "ready" ? "selected" : ""}">Siap dibagikan</button><button data-filter="draft" class="${filter === "draft" ? "selected" : ""}">Draft</button></div><div id="cards" class="cards"></div><div class="bottom-note"><span>✧</span><div><strong>Tak perlu sempurna untuk memulai.</strong><p>Simpan sebagai draft, lalu lanjutkan kapan pun Anda siap.</p></div></div></main>`,
  );
  document.querySelector("#add").onclick = add;
  document.querySelector("#heroAdd").onclick = add;
  document.querySelector("#search").oninput = (e) => {
    query = e.target.value;
    cards();
  };
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        renderDashboard();
      }),
  );
  cards();
}
function cards() {
  const list = events.filter(
    (e) =>
      (filter === "all" || e.status === filter) &&
      (e.name || "Undangan baru").toLowerCase().includes(query.toLowerCase()),
  );
  document.querySelector("#cards").innerHTML =
    list
      .map(
        (e) =>
          `<article class="card"><div class="card-cover">${e.cover ? `<img src="${esc(e.cover)}" alt="Sampul ${esc(e.name)}">` : '<div class="blank-cover">✳<small>YOUR STORY STARTS HERE</small></div>'}<span class="status ${e.status}">${e.status === "ready" ? "● Siap Dibagikan" : "● Draft"}</span><button class="delete" data-delete="${e.id}" aria-label="Hapus ${esc(e.name || "undangan")}">⌫</button></div><div class="card-body"><p class="eyebrow">PERNIKAHAN</p><h3>${esc(e.name || "Undangan baru")}</h3><p class="card-date">◷ &nbsp; ${e.date ? date(e.date) : "Tanggal belum ditentukan"}</p><div class="card-actions"><button data-edit="${e.id}">✎ &nbsp; Edit undangan</button><a href="/preview/${e.id}" target="_blank" aria-label="Pratinjau ${esc(e.name)}">◉</a><button data-share="${e.id}" aria-label="Sebar ${esc(e.name)}">↗</button></div></div></article>`,
      )
      .join("") +
    `<button class="new-card" id="newCard"><span>＋</span><h3>Mulai cerita baru</h3><p>Buat undangan pernikahan<br>yang terasa seperti Anda.</p><b>Tambah acara &nbsp; ↗</b></button>`;
  if (!list.length && events.length)
    document
      .querySelector("#cards")
      .insertAdjacentHTML(
        "afterbegin",
        '<p class="notice">Tidak ada undangan yang sesuai pencarian.</p>',
      );
  document.querySelector("#newCard").onclick = add;
  document
    .querySelectorAll("[data-edit]")
    .forEach((b) => (b.onclick = () => edit(b.dataset.edit)));
  document
    .querySelectorAll("[data-delete]")
    .forEach((b) => (b.onclick = () => remove(b.dataset.delete)));
  document
    .querySelectorAll("[data-share]")
    .forEach(
      (b) =>
        (b.onclick = () => share(events.find((e) => e.id === b.dataset.share))),
    );
}
async function add() {
  try {
    const e = await api("/api/events", { method: "POST", body: "{}" });
    step = 0;
    await edit(e.id);
  } catch (e) {
    toast(e.message);
  }
}
function date(d) {
  return new Date(d + "T12:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function remove(id) {
  const dialog = document.querySelector("#confirm");
  dialog.showModal();
  document.querySelector("#cancelDelete").onclick = () => dialog.close();
  document.querySelector("#doDelete").onclick = async () => {
    try {
      await api("/api/events/" + id, { method: "DELETE" });
      dialog.close();
      toast("Undangan berhasil dihapus.");
      await dashboard();
    } catch (e) {
      toast(e.message);
    }
  };
}
function share(e) {
  if (e.status !== "ready")
    return toast(
      "Lengkapi dan simpan undangan terlebih dahulu: " +
        (e.missing || []).map((k) => labels[k] || k).join(", "),
    );
  renderSharing(e);
}
async function edit(id) {
  try {
    current = await api("/api/events/" + id);
    current.gallery ||= [];
    await refreshMedia();
    renderEditor();
  } catch (e) {
    toast(e.message);
  }
}
function field(k, label = labels[k], type = "text", hint = "") {
  return `<label class="field" for="${k}">${label}${labels[k] ? " <em>* untuk publikasi</em>" : ""}<input id="${k}" name="${k}" type="${type}" value="${esc(current[k] || "")}" ${type === "text" ? 'maxlength="6000"' : ""}><small>${hint}</small></label>`;
}
function area(k, label) {
  return `<label class="field" for="${k}">${label || labels[k]}<textarea id="${k}" name="${k}" rows="5" maxlength="6000">${esc(current[k] || "")}</textarea></label>`;
}
function photo(k, label) {
  return `<div class="field"><label for="${k}">${label} <em>* untuk publikasi</em></label><label class="upload" for="${k}">${current[k] ? `<img src="${esc(current[k])}" alt="Pratinjau ${label}">` : "<span>＋<small>Unggah foto</small></span>"}<input id="${k}" type="file" accept="image/jpeg,image/png,image/webp" data-photo="${k}"></label><small>JPEG, PNG, WebP • Maks. ${appLimits.imageMB} MB</small></div>`;
}
function renderEditor() {
  let body = "";
  if (step === 0)
    body = `${field("name")}<div class="form-grid">${photo("cover", "Foto sampul")}<div><label class="field" for="religion">Agama * untuk publikasi<select id="religion" name="religion"><option value="">Pilih agama</option>${Object.keys(
      greetings,
    )
      .map(
        (v) =>
          `<option ${current.religion === v ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select><small>Menentukan saran salam. Teks tetap dapat Anda edit.</small></label><label class="field" for="music">Musik latar<select id="music" name="music">${musicOptions()}</select></label><p class="notice">Musik hanya diputar setelah tamu menekan tombol putar.</p></div></div>${musicUploadForm()}`;
  if (step === 1)
    body = `<div class="form-grid"><section><h3>Mempelai pria</h3>${photo("groomPhoto", "Foto mempelai pria")}${field("groomName")}${field("groomNick")}${area("groomInfo", "Informasi lainnya (keluarga, alamat)")}</section><section><h3>Mempelai wanita</h3>${photo("bridePhoto", "Foto mempelai wanita")}${field("brideName")}${field("brideNick")}${area("brideInfo", "Informasi lainnya (keluarga, alamat)")}</section></div>`;
  if (step === 2)
    body = `${field("ceremony", "Nama rangkaian acara (contoh: Akad & Resepsi)")}${field("date", labels.date, "date")}<div class="form-grid">${field("start", labels.start, "time")}${field("end", labels.end, "time")}</div><label class="field" for="timezone">Zona waktu acara<select id="timezone" name="timezone"><option value="Asia/Jakarta" ${(current.timezone || "Asia/Jakarta") === "Asia/Jakarta" ? "selected" : ""}>WIB — Jakarta (UTC+7)</option><option value="Asia/Makassar" ${current.timezone === "Asia/Makassar" ? "selected" : ""}>WITA — Makassar (UTC+8)</option><option value="Asia/Jayapura" ${current.timezone === "Asia/Jayapura" ? "selected" : ""}>WIT — Jayapura (UTC+9)</option></select><small>Digunakan untuk countdown dan file kalender. Berlaku juga untuk rangkaian tambahan.</small></label>${area("address")}${field("maps", labels.maps, "url", "Gunakan tautan HTTPS dari Google Maps atau penyedia peta Anda.")}`;
  if (step === 3)
    body = `<p>Abadikan potongan cerita Anda. Maksimal ${appLimits.galleryPhotos} foto, masing-masing ${appLimits.imageMB} MB.</p><label class="button" for="gallery">＋ Tambah foto galeri</label><input id="gallery" class="gallery-input" type="file" multiple accept="image/jpeg,image/png,image/webp"><p id="galleryUploadStatus" role="status"></p><div class="gallery-edit">${current.gallery.map((p, i) => `<div><img loading="lazy" src="${esc(p)}" alt="Foto galeri ${i + 1}"><div><button type="button" data-up="${i}" ${!i ? "disabled" : ""} aria-label="Pindahkan foto ${i + 1} ke kiri">←</button><button type="button" data-down="${i}" ${i === current.gallery.length - 1 ? "disabled" : ""} aria-label="Pindahkan foto ${i + 1} ke kanan">→</button><button type="button" data-rm="${i}" aria-label="Hapus foto ${i + 1}">Hapus</button></div></div>`).join("")}</div>`;
  if (step === 4)
    body = `<p class="notice">Saran salam untuk ${esc(current.religion || "agama yang belum dipilih")}. Anda bebas mengedit seluruh teks.</p><button type="button" id="suggest">Gunakan saran salam</button>${area("opening")}${area("closing")}`;
  if (step === 3) body += photoLibrary();
  if (step >= 5) body = weddingExtraForm();
  shell(
    `<main><button id="back" class="text-button">← Semua undangan</button><div class="page-heading"><div><p class="eyebrow">RANGKAI CERITA ANDA</p><h1>${esc(current.name || "Undangan baru")}</h1><p id="saveStatus">${current.status === "ready" ? "Siap Dibagikan" : "Draft — lengkapi informasi untuk membagikan"}</p></div><a class="button" target="_blank" href="/preview/${current.id}">Pratinjau ↗</a></div><div class="editor-tabs">${steps.map((s, i) => `<button data-step="${i}" class="${i === step ? "selected" : ""}"><span>${i + 1}</span>${s}</button>`).join("")}</div><form id="editor" class="editor"><div class="section-heading"><span>0${step + 1}</span><div><h2>${steps[step]}</h2><p>Anda dapat menyimpan draft kapan saja.</p></div></div>${body}<p class="form-error" id="formError" role="alert"></p><div class="savebar"><span id="dirtyText">Perubahan disimpan saat Anda menekan Simpan.</span><div><button type="button" id="next">${step === steps.length - 1 ? "← Sebelumnya" : "Lanjut →"}</button><button class="primary" type="submit" id="save">Simpan</button></div></div></form></main>`,
  );
  const f = document.querySelector("#editor");
  f.oninput = (e) => {
    if (e.target.name) {
      current[e.target.name] =
        e.target.type === "checkbox" ? e.target.checked : e.target.value;
      dirty = true;
      document.querySelector("#dirtyText").textContent =
        "Ada perubahan yang belum disimpan.";
    }
  };
  f.onsubmit = save;
  document.querySelector("#back").onclick = () => leave(dashboard);
  document.querySelectorAll("[data-step]").forEach(
    (b) =>
      (b.onclick = () => {
        step = +b.dataset.step;
        renderEditor();
      }),
  );
  document.querySelector("#next").onclick = () => {
    step = step === steps.length - 1 ? step - 1 : step + 1;
    renderEditor();
  };
  document.querySelectorAll("[data-photo]").forEach(
    (el) =>
      (el.onchange = async () => {
        if (el.files[0]) {
          const url = await upload(el.files[0]);
          if (url) {
            current[el.dataset.photo] = url;
            dirty = true;
            await refreshMedia();
            renderEditor();
          }
        }
      }),
  );
  bindWeddingEditor();
  bindMediaEditor();
  if (step === 3) {
    document.querySelector("#gallery").onchange = async (e) => {
      if (busy) return toast("Tunggu hingga unggahan selesai.");
      const input = e.target,
        files = Array.from(input.files),
        progress = document.querySelector("#galleryUploadStatus");
      input.disabled = true;
      let completed = 0;
      try {
        for (const [i, file] of files.entries()) {
          if (current.gallery.length >= appLimits.galleryPhotos) {
            toast(`Maksimal ${appLimits.galleryPhotos} foto galeri.`);
            break;
          }
          if (progress.isConnected)
            progress.textContent = `Mengunggah foto ${i + 1} dari ${files.length}…`;
          const url = await upload(file);
          if (url) {
            current.gallery.push(url);
            dirty = true;
            completed++;
          }
        }
        await refreshMedia();
        if (completed)
          toast(
            `${completed} foto diunggah. Tekan Simpan untuk menyimpan galeri.`,
          );
      } catch (error) {
        toast(error.message);
      } finally {
        if (input.isConnected) input.disabled = false;
        renderEditor();
      }
    };
    for (const [a, fn] of [
      ["rm", (i) => current.gallery.splice(i, 1)],
      [
        "up",
        (i) => {
          [current.gallery[i - 1], current.gallery[i]] = [
            current.gallery[i],
            current.gallery[i - 1],
          ];
        },
      ],
      [
        "down",
        (i) => {
          [current.gallery[i + 1], current.gallery[i]] = [
            current.gallery[i],
            current.gallery[i + 1],
          ];
        },
      ],
    ])
      document.querySelectorAll("[data-" + a + "]").forEach(
        (b) =>
          (b.onclick = () => {
            fn(+b.dataset[a]);
            dirty = true;
            renderEditor();
          }),
      );
  }
  if (step === 4)
    document.querySelector("#suggest").onclick = () => {
      if (!current.religion)
        return toast(
          "Pilih agama pada bagian Info & tampilan terlebih dahulu.",
        );
      if (
        current.opening &&
        !confirm("Ganti ucapan pembuka dengan saran salam?")
      )
        return;
      current.opening = greetings[current.religion];
      current.closing =
        "Merupakan kebahagiaan bagi kami apabila Anda berkenan hadir dan memberikan doa restu. Terima kasih atas kasih dan perhatian Anda.";
      dirty = true;
      renderEditor();
    };
}
async function upload(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > appLimits.imageMB * 1024 * 1024
  ) {
    toast(`Gunakan JPEG, PNG, atau WebP maksimal ${appLimits.imageMB} MB.`);
    return;
  }
  busy++;
  const button = document.querySelector("#save");
  if (button) button.disabled = true;
  toast("Mengunggah " + file.name + "…");
  try {
    const f = new FormData();
    f.append("photo", file);
    const r = await api("/api/events/" + current.id + "/photos", {
      method: "POST",
      body: f,
    });
    toast("Foto berhasil diunggah. Tekan Simpan untuk menyimpan susunan.");
    return r.url;
  } catch (e) {
    toast(e.message);
  } finally {
    busy--;
    if (button) button.disabled = !!busy;
  }
}
async function save(e) {
  e.preventDefault();
  if (busy) return toast("Tunggu hingga unggahan selesai.");
  const b = document.querySelector("#save");
  b.disabled = true;
  b.textContent = "Menyimpan…";
  try {
    current = await api("/api/events/" + current.id, {
      method: "PUT",
      body: JSON.stringify(current),
    });
    dirty = false;
    renderEditor();
    toast(
      current.status === "ready"
        ? "Tersimpan. Undangan siap dibagikan!"
        : "Draft tersimpan. Masih perlu: " +
            current.missing.map((k) => labels[k] || k).join(", "),
    );
  } catch (e) {
    document.querySelector("#formError").textContent = e.message;
    b.disabled = false;
    b.textContent = "Simpan";
  }
}
async function invitation(preview, id) {
  return renderWedding(preview, id);
}
window.addEventListener("beforeunload", (e) => {
  if (dirty || busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
(async () => {
  try {
    const info = await api("/api/me");
    me = info.user;
    csrf = info.csrf;
    appLimits = { ...appLimits, ...info.limits };
    const parts = location.pathname.split("/");
    if (parts[1] === "u") return invitation(false, parts[2]);
    if (parts[1] === "preview") {
      if (!me) return login(info);
      return invitation(true, parts[2]);
    }
    if (parts[1] === "layar-tamu") return renderGuestScreen();
    if (parts[1] === "login" || parts[1] === "daftar") {
      if (me) {
        location.replace("/dashboard");
        return;
      }
      return renderLogin(info, parts[1] === "daftar");
    }
    if (parts[1] === "dashboard") {
      if (!me) {
        location.replace("/login");
        return;
      }
      return dashboard();
    }
    renderLanding(info);
  } catch (e) {
    root.innerHTML =
      '<p class="loading">Tidak dapat menghubungi server. Muat ulang halaman untuk mencoba kembali.</p>';
  }
})();
