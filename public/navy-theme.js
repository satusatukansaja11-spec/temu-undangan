function applyNavyTheme(event) {
  const invitation = document.querySelector(".wedding-v2");
  invitation.classList.add("wedding-navy");
  const layout = document.createElement("div");
  layout.className = "wedding-layout";
  const backdrop = document.createElement("div");
  backdrop.className = "wedding-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.innerHTML = `${event.cover ? `<img src="${esc(event.cover)}" alt="">` : ""}<div><p>The Wedding of</p><span>${esc(event.groomNick || "Mempelai pria")} & ${esc(event.brideNick || "Mempelai wanita")}</span></div>`;
  const panel = document.createElement("div");
  panel.className = "wedding-panel";
  invitation.replaceWith(layout);
  layout.append(backdrop, panel);
  panel.append(invitation);
  const hero = invitation.querySelector(".wedding-hero"),
    title = hero.querySelector(".wedding-title");
  hero.querySelector(".wedding-cover")?.remove();
  if (event.cover) {
    const photo = document.createElement("img");
    photo.className = "cover-portrait";
    photo.src = event.cover;
    photo.alt = "Foto kedua mempelai";
    title.prepend(photo);
  }
  const label = document.createElement("p");
  label.className = "guest-salutation";
  label.textContent = "Kepada Yth. Bapak/Ibu/Saudara/i";
  const guest = document.createElement("p");
  guest.className = "cover-guest personal-recipient";
  guest.textContent = (
    new URLSearchParams(location.search).get("to") || "Tamu Undangan"
  ).slice(0, 100);
  const open = title.querySelector(".wedding-open");
  open.before(label, guest);
  open.href = "#weddingIntro";
  const love = document.createElement("section");
  love.id = "withLove";
  love.className = "w-section with-love";
  love.innerHTML = `${event.gallery?.[0] || event.cover ? `<img src="${esc(event.gallery?.[0] || event.cover)}" alt="Momen kedua mempelai" loading="lazy">` : ""}<p class="w-eyebrow">WITH LOVE</p><h2>Awal indah untuk selamanya.</h2><p class="prose">${esc(event.opening)}</p>`;
  const intro = document.createElement("section");
  intro.id = "weddingIntro";
  intro.className = "w-section wedding-intro";
  intro.innerHTML = `<p>The Wedding Of</p><h2>${esc(event.groomNick || "Mempelai pria")}</h2><span>AND</span><h2>${esc(event.brideNick || "Mempelai wanita")}</h2><a class="button" href="#withLove">Lanjutkan undangan ↓</a>`;
  hero.after(intro, love);
  const maps = invitation.querySelector("#maps");
  if (!invitation.querySelector("#gallery")) {
    const gallery = document.createElement("section");
    gallery.id = "gallery";
    gallery.className = "w-section gallery-section";
    gallery.innerHTML =
      '<p class="w-eyebrow">GALERI FOTO</p><h2>Kenangan yang kami simpan.</h2><p>Belum ada foto galeri.</p>';
    maps.after(gallery);
    const nav = invitation.querySelector(".wedding-nav");
    const link = document.createElement("a");
    link.href = "#gallery";
    link.innerHTML = weddingIcon("photos") + "<span>Galeri</span>";
    nav.insertBefore(
      link,
      nav.querySelector('[href="#rsvp"]') || nav.querySelector("#musicToggle"),
    );
  }
  let gift = invitation.querySelector("#gift");
  if (!gift) {
    gift = document.createElement("section");
    gift.id = "gift";
    gift.className = "w-section gift-section";
  }
  gift.innerHTML = publicGifts(event);
  invitation.querySelector(".closing").before(gift);
  const addressButton = gift.querySelector("#showGiftAddress");
  if (addressButton)
    addressButton.onclick = () => {
      const address = gift.querySelector("#physicalGiftAddress");
      address.hidden = !address.hidden;
      addressButton.setAttribute("aria-expanded", String(!address.hidden));
    };
  invitation.querySelector(".opening-text")?.remove();
  const firstLink = invitation.querySelector(".wedding-nav a");
  if (firstLink) firstLink.href = "#weddingIntro";
  open.onclick = (e) => {
    e.preventDefault();
    invitation.classList.add("is-open");
    hero.hidden = true;
    panel.scrollTop = 0;
    intro.scrollIntoView({ block: "start", behavior: "instant" });
    intro.setAttribute("tabindex", "-1");
    intro.focus({ preventScroll: true });
  };
  const sectionTitle = invitation.querySelector("#couple h2");
  if (sectionTitle) sectionTitle.textContent = "Bride & Groom";
}
