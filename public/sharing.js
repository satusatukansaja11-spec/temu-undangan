async function renderSharing(event) {
  try {
    event = await api("/api/events/" + event.id);
    if (event.status !== "ready") {
      toast(
        "Undangan belum siap dibagikan. Lengkapi dan simpan terlebih dahulu.",
        "warning",
      );
      return;
    }
    const state = await api(`/api/events/${event.id}/sharing`);
    const universal =
      "Yth. {nama},\n\nDengan bahagia kami mengundang Anda untuk menghadiri {acara}.\n\nSilakan buka undangan berikut:\n{link}\n\nKami menantikan kehadiran dan doa restu Anda.";
    const templates = {
      Universal: universal,
      Formal:
        "Kepada Yth. {nama},\n\nDengan hormat, kami mengundang Bapak/Ibu/Saudara/i pada {acara}. Informasi acara tersedia melalui:\n{link}\n\nTerima kasih atas perhatian dan kehadirannya.",
    };
    templates["Sesuai agama"] = weddingShareTemplate(event.religion);
    const defaultTemplate =
      event.religion && event.religion !== "Umum"
        ? "Sesuai agama"
        : "Universal";
    shell(
      `<main class="share-page"><button class="text-button" id="shareBack">← Undangan saya</button><section class="share-heading"><p class="eyebrow">HADIRKAN ORANG TERKASIH</p><h1>Sebar undangan</h1><p>Tema <strong>Navy Ivory</strong></p>${event.cover ? `<img src="${esc(event.cover)}" alt="Sampul acara">` : ""}<h2>${esc(event.name)}</h2></section><p class="share-notice">Tambahkan nama penerima, tinjau pesan, lalu buka WhatsApp. Foto sampul dipakai sebagai pratinjau tautan WhatsApp. Pratinjau memerlukan URL publik HTTPS dan dapat tersimpan dalam cache WhatsApp. Pengiriman dilakukan sendiri oleh Anda, satu penerima setiap kali.</p><div class="share-tools"><label class="button" for="importRecipients">Import nama</label><input id="importRecipients" type="file" accept="application/json,.json" hidden><button id="exportRecipients">Export nama</button></div><section class="share-compose"><h2>Sesuaikan kata-kata pengiriman</h2><label for="messageTemplate">Pilih template kalimat sebar</label><div class="share-template-options" id="messageTemplate">${[...Object.keys(templates), "Custom"].map((name, i) => `<label><input type="radio" name="shareTemplate" value="${esc(name)}" ${name === defaultTemplate ? "checked" : ""}> ${name}</label>`).join("")}</div><label for="shareMessage">Pesan undangan</label><textarea id="shareMessage" rows="8" maxlength="4000"></textarea><small>Gunakan {nama}, {acara}, {tanggal}, {waktu}, {lokasi}, dan {link_undangan} (atau {link}). Nama dan tautan personal akan diganti untuk setiap penerima.</small><button id="saveShareMessage" class="primary">Simpan pesan</button><p id="messageStatus" role="status"></p></section><section class="share-recipients"><h2>Daftar penerima <span id="recipientCount"></span></h2><p>Nama tersimpan di akun Anda dan tidak ditampilkan sebagai daftar publik.</p><form id="recipientForm"><label class="sr-only" for="recipientName">Nama penerima</label><input id="recipientName" placeholder="Tambah nama penerima" maxlength="100" required><button class="primary" id="addRecipient">Tambah</button></form><p id="recipientStatus" role="status"></p><div id="recipientList"></div></section><dialog id="recipientPreview" aria-labelledby="recipientPreviewTitle"><h2 id="recipientPreviewTitle">Tinjau pesan WhatsApp</h2>${event.cover ? `<img class="share-preview-photo" src="${esc(event.cover)}" alt="Foto sampul untuk pratinjau tautan"><small>Foto pratinjau tautan; tampilan akhirnya mengikuti WhatsApp.</small>` : ""}<label for="recipientPreviewMessage">Pesan untuk penerima</label><textarea id="recipientPreviewMessage" rows="10"></textarea><p>Anda dapat mengedit pesan ini sebelum membuka WhatsApp.</p><div class="actions"><button id="closeRecipientPreview">Batal</button><a class="button share-wa" id="openRecipientWa" target="_blank" rel="noopener noreferrer">Buka WhatsApp</a></div></dialog></main>`,
    );
    const message = document.querySelector("#shareMessage");
    message.value = state.message || templates[defaultTemplate];
    if (state.message)
      document.querySelector("[name=shareTemplate][value=Custom]").checked =
        true;
    let recipients = state.recipients;
    const personalUrl = (name) => {
      const url = new URL("/u/" + event.slug, location.origin);
      url.searchParams.set("to", name);
      return url.href;
    };
    const textFor = (name) =>
      fillWeddingShareMessage(message.value, event, name, personalUrl(name));
    const feedback = (text) =>
      (document.querySelector("#recipientStatus").textContent = text);
    const copy = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        feedback("Berhasil disalin.");
        toast("Pesan berhasil disalin.", "success");
      } catch {
        feedback(
          "Browser tidak mengizinkan salin otomatis. Gunakan pratinjau pesan untuk menyalin manual.",
        );
        toast(
          "Browser tidak mengizinkan salin otomatis. Salin pesan secara manual.",
          "warning",
        );
      }
    };
    const draw = () => {
      document.querySelector("#recipientCount").textContent =
        `(${recipients.length}/1000)`;
      document.querySelector("#recipientList").innerHTML = recipients.length
        ? recipients
            .map(
              (r) =>
                `<article class="recipient-card"><div><h3>${esc(r.name)}</h3><button class="recipient-delete" data-remove-recipient="${r.id}">Hapus</button></div><div class="recipient-actions"><button data-copy-recipient="${r.id}">Salin pesan</button><button class="share-wa" data-wa-recipient="${r.id}">Kirim WA</button><button data-link-recipient="${r.id}">Bagikan tautan</button></div></article>`,
            )
            .join("")
        : '<p class="notice">Belum ada penerima. Tambahkan nama pertama untuk membuat tautan undangan personal.</p>';
      document.querySelectorAll("[data-remove-recipient]").forEach(
        (b) =>
          (b.onclick = async () => {
            if (!confirm("Hapus nama penerima ini?")) return;
            try {
              await api(
                `/api/events/${event.id}/recipients/${b.dataset.removeRecipient}`,
                { method: "DELETE" },
              );
              recipients = recipients.filter(
                (r) => r.id !== b.dataset.removeRecipient,
              );
              draw();
              feedback("Penerima dihapus.");
            } catch (e) {
              toast(e.message || "Tindakan gagal. Coba kembali.", "error");

              feedback(e.message);
            }
          }),
      );
      document
        .querySelectorAll("[data-copy-recipient]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              copy(
                textFor(
                  recipients.find((r) => r.id === b.dataset.copyRecipient).name,
                ),
              )),
        );
      document.querySelectorAll("[data-wa-recipient]").forEach(
        (b) =>
          (b.onclick = () => {
            const r = recipients.find((r) => r.id === b.dataset.waRecipient);
            const input = document.querySelector("#recipientPreviewMessage"),
              link = document.querySelector("#openRecipientWa");
            input.value = textFor(r.name);
            const update = () =>
              (link.href =
                "https://wa.me/?text=" + encodeURIComponent(input.value));
            input.oninput = update;
            update();
            document.querySelector("#recipientPreview").showModal();
          }),
      );
      document.querySelectorAll("[data-link-recipient]").forEach(
        (b) =>
          (b.onclick = async () => {
            const r = recipients.find((r) => r.id === b.dataset.linkRecipient);
            try {
              if (navigator.share) {
                await navigator.share({
                  title: event.name,
                  url: personalUrl(r.name),
                });
                toast("Tautan undangan berhasil dibagikan.", "success");
              } else await copy(personalUrl(r.name));
            } catch (e) {
              if (e.name !== "AbortError") {
                feedback("Bagikan belum berhasil. Gunakan Salin pesan.");
                toast(
                  "Bagikan belum berhasil. Gunakan Salin pesan.",
                  "warning",
                );
              }
            }
          }),
      );
    };
    document.querySelector("#shareBack").onclick = dashboard;
    document.querySelector("#closeRecipientPreview").onclick = () =>
      document.querySelector("#recipientPreview").close();
    document.querySelectorAll("[name=shareTemplate]").forEach(
      (r) =>
        (r.onchange = () => {
          if (r.value !== "Custom") {
            if (
              message.value !== templates[r.value] &&
              !confirm("Ganti isi pesan dengan template yang dipilih?")
            )
              return;
            message.value = templates[r.value];
          }
        }),
    );
    message.oninput = () => {
      document.querySelector("[name=shareTemplate][value=Custom]").checked =
        true;
      document.querySelector("#messageStatus").textContent =
        "Perubahan pesan belum disimpan.";
    };
    document.querySelector("#saveShareMessage").onclick = async (e) => {
      const button = e.target;
      button.disabled = true;
      try {
        await api(`/api/events/${event.id}/sharing`, {
          method: "PUT",
          body: JSON.stringify({ message: message.value }),
        });
        document.querySelector("#messageStatus").textContent =
          "Pesan berhasil disimpan.";
      } catch (e) {
        toast(e.message || "Tindakan gagal. Coba kembali.", "error");

        document.querySelector("#messageStatus").textContent = e.message;
      } finally {
        button.disabled = false;
      }
    };
    async function add(names) {
      await api(`/api/events/${event.id}/recipients`, {
        method: "POST",
        body: JSON.stringify({ names }),
      });
      recipients = (await api(`/api/events/${event.id}/sharing`)).recipients;
      draw();
    }
    document.querySelector("#recipientForm").onsubmit = async (e) => {
      e.preventDefault();
      const button = document.querySelector("#addRecipient");
      button.disabled = true;
      try {
        await add([document.querySelector("#recipientName").value]);
        document.querySelector("#recipientName").value = "";
        feedback("Nama penerima berhasil ditambahkan.");
      } catch (e) {
        toast(e.message || "Tindakan gagal. Coba kembali.", "error");

        feedback(e.message);
      } finally {
        button.disabled = false;
      }
    };
    document.querySelector("#importRecipients").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (file.size > 200000) throw Error("File maksimal 200 KB.");
        const names = JSON.parse(await file.text());
        await add(names);
        feedback("Nama berhasil diimpor.");
      } catch (e) {
        toast(e.message || "Tindakan gagal. Coba kembali.", "error");

        feedback(e.message || "File tidak valid. Gunakan JSON array nama.");
      } finally {
        e.target.value = "";
      }
    };
    document.querySelector("#exportRecipients").onclick = () => {
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              recipients.map((r) => r.name),
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "nama-penerima.json";
      a.click();
      toast("Daftar penerima siap diunduh.", "success");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    draw();
  } catch (error) {
    toast(error.message, "error");
  }
}

function weddingShareTemplate(religion) {
  const islam = religion === "Islam";
  const opening = islam
    ? "Assalamu'alaikum. Wr. Wb.\n\nDengan Rahmat dan Ridho Allah SWT. Kami bermaksud mengundang Bapak/Ibu/Saudara/i di acara kami,"
    : greetings[religion] || greetings.Umum;
  return `${opening}\n\nYth. {nama}\n\nPada Pernikahan\n{acara}\n🗓️ Tanggal: {tanggal}\n🕛 Pukul: {waktu}\n📍 Lokasi: {lokasi}\n\nLink undangan bisa diakses lengkap di:\n{link_undangan}\n\nMerupakan suatu kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan untuk hadir di acara kami\nMohon maaf perihal undangan hanya di bagikan melalui pesan ini\nTerima kasih banyak atas perhatiannya${islam ? "\n\nWassalamu'alaikum. Wr. Wb" : ""}`;
}
function fillWeddingShareMessage(template, event, name, link) {
  const zone =
    { "Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" }[
      event.timezone || "Asia/Jakarta"
    ] || "WIB";
  const values = {
    nama: name,
    acara: event.name,
    tanggal: event.date
      ? new Date(event.date + "T12:00:00").toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Tanggal akan diumumkan",
    waktu: event.start
      ? `${event.start} - ${event.untilFinished ? "Selesai" : event.end || "Selesai"} ${zone}`
      : "Waktu akan diumumkan",
    lokasi: event.address || "Lokasi akan diumumkan",
    link,
    link_undangan: link,
  };
  return template.replace(
    /\{(nama|acara|tanggal|waktu|lokasi|link_undangan|link)\}/g,
    (_, key) => values[key] || "",
  );
}
