const giftIntro =
  "Doa restu Bapak/Ibu sekalian merupakan karunia yang sangat berarti bagi kami. Dan jika memberi merupakan ungkapan tanda kasih, Bapak/Ibu dapat memberi kado secara cashless. Terima kasih";
function bankCard(gift, i) {
  return `<article class="bank-card"><span class="bank-brand">${esc(gift.bank)}</span><span class="bank-chip" aria-hidden="true"></span><label class="sr-only" for="giftAccount${i}">Nomor rekening ${esc(gift.bank)}</label><input id="giftAccount${i}" class="gift-number" value="${esc(gift.account)}" readonly><p>${esc(gift.holder)}</p>${gift.note ? `<small>${esc(gift.note)}</small>` : ""}<button type="button" class="button" data-copy-gift="${i}">${weddingIcon("copy")} Salin nomor</button></article>`;
}
function publicGifts(event) {
  return `<p class="w-eyebrow">TITIP HADIAH</p><h2>Tanda kasih untuk kami.</h2><p class="prose gift-intro">${giftIntro}</p><div class="gift-list">${(event.gifts || []).map(bankCard).join("")}</div>${event.giftAddress ? `<div class="physical-gift"><h3>Kado fisik</h3><p>Informasi pengiriman kado untuk mempelai.</p><button class="button" type="button" id="showGiftAddress" aria-expanded="false" aria-controls="physicalGiftAddress">Lihat alamat pengiriman</button><p id="physicalGiftAddress" class="prose" hidden>${esc(event.giftAddress)}</p></div>` : ""}`;
}
function giftManager() {
  return `<div class="gift-manager"><p class="eyebrow">DATA REKENING</p><h3>Kelola Titip Hadiah</h3><p class="notice">Maksimal 3 rekening/e-wallet. Informasi yang disimpan akan tampil di undangan publik. Periksa nomor dan nama penerima sebelum menyimpan.</p><button type="button" class="primary" id="addBank" ${(current.gifts || []).length >= 3 ? "disabled" : ""}>Tambah Rekening</button><div class="manager-banks">${(current.gifts || []).map((gift, i) => `<article><span class="bank-brand">${esc(gift.bank)}</span><h4>Rekening ${i + 1}</h4><strong>${esc(gift.account)}</strong><p>Atas nama ${esc(gift.holder)}</p><small>Keterangan: ${esc(gift.note || "—")}</small><div><button type="button" data-edit-bank="${i}">Edit</button><button type="button" data-delete-bank="${i}">Hapus</button></div></article>`).join("") || "<p>Belum ada rekening. Tambahkan rekening pertama Anda.</p>"}</div><label class="field" for="giftAddress">Alamat pengiriman kado fisik (opsional)<textarea id="giftAddress" name="giftAddress" maxlength="1000" rows="4">${esc(current.giftAddress || "")}</textarea><small>Tekan Simpan pada formulir utama untuk menyimpan perubahan alamat.</small></label></div>`;
}
function bindGiftManager() {
  if (step !== 7) return;
  document.querySelector("#addBank").onclick = () => editBank();
  document
    .querySelectorAll("[data-edit-bank]")
    .forEach((b) => (b.onclick = () => editBank(Number(b.dataset.editBank))));
  document.querySelectorAll("[data-delete-bank]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          !confirm(
            "Hapus rekening ini dari undangan? Semua perubahan formulir saat ini juga akan disimpan.",
          )
        )
          return;
        const gifts = (current.gifts || []).filter(
          (_, i) => i !== Number(b.dataset.deleteBank),
        );
        try {
          current = await api("/api/events/" + current.id, {
            method: "PUT",
            body: JSON.stringify({ ...current, gifts }),
          });
          dirty = false;
          renderEditor();
          toast("Rekening dihapus.");
        } catch (e) {
          toast(e.message);
        }
      }),
  );
}
function editBank(index) {
  const gift = current.gifts?.[index] || {},
    dialog = document.createElement("dialog");
  dialog.className = "bank-dialog";
  dialog.setAttribute("aria-labelledby", "bankDialogTitle");
  const banks = [
    "BRI",
    "BCA",
    "BNI",
    "Mandiri",
    "BSI",
    "BTN",
    "CIMB Niaga",
    "Permata",
    "DANA",
    "OVO",
    "GoPay",
    "ShopeePay",
  ];
  const custom = gift.bank && !banks.includes(gift.bank);
  dialog.innerHTML = `<form id="bankForm"><div class="bank-dialog-heading"><h2 id="bankDialogTitle">${index === undefined ? "Tambah" : "Edit"} Rekening</h2><button type="button" id="closeBank" aria-label="Tutup dialog rekening">×</button></div><label for="bankSelect">Pilih Bank / E-Money</label><select id="bankSelect">${banks.map((bank) => `<option ${gift.bank === bank ? "selected" : ""}>${bank}</option>`).join("")}<option value="other" ${custom ? "selected" : ""}>Lainnya</option></select><label for="customBank" id="customBankLabel" ${custom ? "" : "hidden"}>Nama bank / e-wallet</label><input id="customBank" maxlength="80" value="${esc(custom ? gift.bank : "")}" ${custom ? "" : "hidden"}><label for="bankAccount">NoRek / E-Money</label><input id="bankAccount" maxlength="80" value="${esc(gift.account || "")}" required><label for="bankHolder">Atas Nama</label><input id="bankHolder" maxlength="120" value="${esc(gift.holder || "")}" required><label for="bankNote">Keterangan (opsional)</label><input id="bankNote" maxlength="200" value="${esc(gift.note || "")}"><p class="bank-help">Simpan Perubahan juga menyimpan perubahan lain pada formulir undangan.</p><p id="bankError" role="alert"></p><div class="actions"><button id="cancelBank" type="button">Batal</button><button class="primary" id="saveBank">Simpan Perubahan</button></div></form>`;
  root.append(dialog);
  const close = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("#closeBank").onclick = close;
  dialog.querySelector("#cancelBank").onclick = close;
  const select = dialog.querySelector("#bankSelect"),
    customInput = dialog.querySelector("#customBank");
  select.onchange = () => {
    customInput.hidden = select.value !== "other";
    customInput.required = select.value === "other";
    dialog.querySelector("#customBankLabel").hidden = customInput.hidden;
  };
  select.onchange();
  dialog.querySelector("#bankForm").onsubmit = async (e) => {
    e.preventDefault();
    const bank =
        select.value === "other" ? customInput.value.trim() : select.value,
      account = dialog.querySelector("#bankAccount").value.trim(),
      holder = dialog.querySelector("#bankHolder").value.trim(),
      note = dialog.querySelector("#bankNote").value.trim();
    if (!bank || !account || !holder) {
      dialog.querySelector("#bankError").textContent =
        "Bank, nomor rekening dan atas nama wajib diisi.";
      return;
    }
    const gifts = [...(current.gifts || [])];
    if (index === undefined) gifts.push({ bank, account, holder, note });
    else gifts[index] = { bank, account, holder, note };
    const button = dialog.querySelector("#saveBank");
    button.disabled = true;
    try {
      current = await api("/api/events/" + current.id, {
        method: "PUT",
        body: JSON.stringify({ ...current, gifts }),
      });
      dirty = false;
      dialog.close();
      renderEditor();
      toast("Rekening dan perubahan undangan berhasil disimpan.");
    } catch (error) {
      dialog.querySelector("#bankError").textContent = error.message;
      button.disabled = false;
    }
  };
  dialog.showModal();
}
