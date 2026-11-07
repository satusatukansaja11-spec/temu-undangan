const siteBrand =
  '<a class="site-brand" href="/" aria-label="Temu — beranda"><span class="brand-rings" aria-hidden="true"></span><span>temu<small>undangan untuk cerita Anda</small></span></a>';
function siteHeader(info = {}) {
  return `<header class="site-header">${siteBrand}<button class="menu-toggle" id="menuToggle" aria-label="Buka menu" aria-expanded="false" aria-controls="siteNav">☰</button><nav id="siteNav" aria-label="Navigasi utama"><a href="/#beranda">Beranda</a><a href="/#tema">Tema</a><a href="/#fitur">Fitur</a><a href="/#harga">Harga</a><a href="/layar-tamu">Layar Tamu</a><a class="site-button" href="${info.user ? "/dashboard" : "/login"}">${info.user ? "Dashboard" : "Login"}</a></nav></header>`;
}
function bindSiteMenu() {
  const b = document.querySelector("#menuToggle");
  if (b)
    b.onclick = () => {
      const open = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!open));
      document.querySelector("#siteNav").classList.toggle("open", !open);
    };
  document.querySelectorAll("#siteNav a").forEach((a) =>
    a.addEventListener("click", () => {
      document.querySelector("#siteNav").classList.remove("open");
      b.setAttribute("aria-expanded", "false");
    }),
  );
}
const appleMark =
  '<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true"><path fill="currentColor" d="M17.1 12.5c0-2 1.6-3 1.7-3.1-1-1.5-2.5-1.7-3-1.7-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.9.9-3.6 2.2-1.5 2.6-.4 6.4 1 8.4.7 1 1.4 2 2.5 1.9 1 0 1.4-.6 2.8-.6s1.7.6 2.9.6 1.8-1 2.4-1.9c.8-1.2 1.1-2.4 1.1-2.5-.1 0-1.8-.7-1.8-3.3ZM15 6.4c.6-.8 1.1-1.9 1-3-1 .1-2.1.7-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3Z"/></svg>';
function invitationArt(extra = "") {
  return `<div class="invitation-art ${extra}" aria-hidden="true"><div class="art-flower flower-left">✿</div><div class="art-flower flower-right">✿</div><div class="mini-phone"><div class="phone-notch"></div><div class="phone-page"><span class="phone-flower">❀</span><small>THE WEDDING OF</small><strong>Arif <i>&</i> Nisa</strong><div class="phone-rule"></div><small>MINGGU, 20 JUNI 2027</small><span class="phone-invite">Buka undangan</span><small>SEBUAH JANJI, SELAMANYA</small></div></div><span class="art-tag tag-love">♡ &nbsp; Personal, seperti cerita Anda</span><span class="art-tag tag-share"><svg class="site-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg> &nbsp; Siap dibagikan</span><div class="art-sparkle">✧</div></div>`;
}
function renderLanding(info) {
  document.title = "Temu — Undangan Pernikahan Digital";
  root.innerHTML = `<div class="website home-website">${siteHeader(info)}<main class="site-main"><section id="beranda" class="site-hero"><div class="site-hero-copy"><p class="site-kicker">SEBUAH AWAL, UNTUK SELAMANYA</p><h1>Cerita cinta Anda.<br>Undangan yang<br><em>terasa istimewa.</em></h1><p>Rangkai hari bahagia dalam undangan digital yang elegan. Mudah dibuat, personal, dan dekat dengan orang-orang tersayang.</p><div class="hero-links"><a class="site-button" href="${info.user ? "/dashboard" : "/daftar"}">Buat undangan Anda <span><svg class="site-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></a><a class="site-link" href="#tema">Lihat tema <span>↓</span></a></div><div class="hero-assurances"><span>✧ Tanpa perlu keahlian desain</span><span>♡ Nyaman dibuka di ponsel</span></div></div>${invitationArt()}<div class="hero-footnote">UNTUK JANJI YANG INGIN ANDA BAGIKAN</div></section><section class="site-section feature-section" id="fitur"><p class="site-kicker">SEDERHANA DIBUAT, BERARTI UNTUK DIKENANG</p><h2>Semua yang Anda butuhkan<br>untuk kabar bahagia.</h2><div class="feature-grid">${[
    [
      "design",
      "✧",
      "Desain elegan & personal",
      "Tampilan bersih yang memberi ruang bagi foto dan cerita cinta Anda.",
    ],
    [
      "edit",
      "✎",
      "Edit mudah, kapan saja",
      "Ubah nama, foto, musik, dan detail acara. Simpan draft lalu lanjutkan saat Anda siap.",
    ],
    [
      "share",
      '<svg class="site-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>',
      "Bagikan ke orang tersayang",
      "Satu tautan undangan, lengkap dengan pesan WhatsApp yang bisa Anda edit.",
    ],
    [
      "music",
      "♫",
      "Detail yang menghidupkan",
      "Galeri foto, petunjuk Maps, dan musik pilihan dengan kontrol putar untuk tamu.",
    ],
  ]
    .map(
      ([c, i, t, p]) =>
        `<article><div class="feature-art ${c}" aria-hidden="true"><span>${i}</span><div class="feature-device"><small>temu ♡</small><b>Arif & Nisa</b><i></i><i></i></div><span class="small-decoration">✿</span></div><h3>${t}</h3><p>${p}</p></article>`,
    )
    .join(
      "",
    )}</div></section><section class="site-section theme-section" id="tema"><p class="site-kicker">KATALOG TEMA</p><h2>Pilih suasana hari bahagia Anda.</h2><p role="status">Memuat katalog dan harga…</p></section><section class="site-section pricing-section" id="harga"><p class="site-kicker">HARGA</p><h2>Satu undangan untuk satu hari bahagia.</h2><p>Harga mengikuti katalog. Pembayaran melalui transfer bank dan pemeriksaan admin.</p><a class="site-button" href="#tema">Lihat katalog</a></section><section class="site-section guest-intro"><p class="site-kicker">LAYAR TAMU</p><h2>Sambut dengan nama.<br>Hangatkan setiap kedatangan.</h2><p>Tampilkan sapaan dan nama tamu di layar penyambutan.<br>Coba tampilan layar penuh untuk menyambut orang tersayang.</p><a class="site-button" href="/layar-tamu">Buka Layar Tamu <svg class="site-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></a></section></main><footer class="site-footer">${siteBrand}<p>Tempat cerita bahagia dimulai.</p><small>© ${new Date().getFullYear()} Temu</small></footer></div>`;
  bindSiteMenu();
  if (location.hash)
    requestAnimationFrame(() =>
      document.getElementById(location.hash.slice(1))?.scrollIntoView(),
    );
}
function renderLogin(info = {}, register = false) {
  document.title = (register ? "Buat Akun" : "Login") + " — Temu";
  root.innerHTML = `<div class="website auth-website">${siteHeader(info)}<main class="auth-page"><div class="auth-decoration" aria-hidden="true">✿</div><section class="auth-card"><a href="/" class="auth-home">← Kembali ke beranda</a><h1>${register ? "Buat akun di" : "Masuk ke"}<strong>Temu</strong></h1><p class="auth-subtitle">${register ? "Daftar dengan nama, email, dan password Anda sendiri." : "Masuk dengan email dan password akun Anda."}</p><form id="accountForm">${register ? '<label for="accountName">Nama lengkap</label><input id="accountName" name="name" autocomplete="name" maxlength="100" required>' : ""}<label for="accountEmail">Email</label><input id="accountEmail" name="email" type="email" autocomplete="email" maxlength="254" required><div class="password-label"><label for="accountPassword">Password</label>${!register ? '<button type="button" class="forgot-button" id="forgotPassword">Lupa password?</button>' : ""}</div><div class="password-input"><input id="accountPassword" name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="12" maxlength="128" required><button type="button" id="togglePassword" aria-label="Tampilkan password" aria-pressed="false">Lihat</button></div>${register ? '<small class="password-hint">Gunakan 12–128 karakter. Jangan gunakan password yang sama dengan akun lain.</small>' : ""}<p class="account-error" id="accountError" role="alert"></p><button class="site-button account-submit" type="submit" id="accountSubmit">${register ? "Buat akun baru" : "Masuk"}</button></form><div class="auth-divider"><span>ATAU</span></div><a class="social-button" href="/auth/apple">${appleMark} Masuk dengan Apple</a><a class="register-button" href="${register ? "/login" : "/daftar"}">${register ? "Sudah punya akun? Masuk" : "Buat Akun Baru"}</a>${info.demo ? '<button id="demo" class="demo-button">Coba akun demo lokal</button>' : ""}<p class="auth-footnote">Satu ruang untuk merangkai dan membagikan<br>kebahagiaan Anda.</p></section><dialog id="passwordHelp"><h2>Lupa password?</h2><p>Pemulihan password melalui email belum tersedia. Jika Anda membuat akun melalui Apple, masuk menggunakan tombol Apple.</p><button class="site-button" id="closePasswordHelp">Mengerti</button></dialog></main></div>`;
  bindSiteMenu();
  document.querySelector("#togglePassword").onclick = () => {
    const p = document.querySelector("#accountPassword"),
      b = document.querySelector("#togglePassword"),
      visible = p.type === "password";
    p.type = visible ? "text" : "password";
    b.textContent = visible ? "Sembunyikan" : "Lihat";
    b.setAttribute(
      "aria-label",
      visible ? "Sembunyikan password" : "Tampilkan password",
    );
    b.setAttribute("aria-pressed", String(visible));
  };
  document.querySelector("#accountForm").onsubmit = async (e) => {
    e.preventDefault();
    const b = document.querySelector("#accountSubmit"),
      error = document.querySelector("#accountError");
    error.textContent = "";
    b.disabled = true;
    b.textContent = register ? "Membuat akun…" : "Memeriksa…";
    try {
      const body = Object.fromEntries(new FormData(e.target));
      await api(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      location.href = sessionStorage.getItem("pendingTheme")
        ? "/pesanan?tema=" +
          (encodeURIComponent(sessionStorage.getItem("pendingTheme")) +
            (sessionStorage.getItem("pendingEvent")
              ? "&acara=" +
                encodeURIComponent(sessionStorage.getItem("pendingEvent"))
              : ""))
        : "/dashboard";
    } catch (e) {
      error.textContent = e.message;
      b.disabled = false;
      b.textContent = register ? "Buat akun baru" : "Masuk";
    }
  };
  const forgot = document.querySelector("#forgotPassword");
  if (forgot) {
    const d = document.querySelector("#passwordHelp");
    forgot.onclick = () => d.showModal();
    document.querySelector("#closePasswordHelp").onclick = () => d.close();
  }
  if (info.demo)
    document.querySelector("#demo").onclick = async () => {
      try {
        await api("/auth/demo", { method: "POST" });
        location.href = sessionStorage.getItem("pendingTheme")
          ? "/pesanan?tema=" +
            (encodeURIComponent(sessionStorage.getItem("pendingTheme")) +
              (sessionStorage.getItem("pendingEvent")
                ? "&acara=" +
                  encodeURIComponent(sessionStorage.getItem("pendingEvent"))
                : ""))
          : "/dashboard";
      } catch (e) {
        toast(e.message);
      }
    };
  const errors = {
    apple_config:
      "Login Apple belum diaktifkan. Pengelola perlu mengatur kredensial Apple Developer dan domain HTTPS.",
    apple_login: "Login Apple belum berhasil. Silakan coba kembali.",
  };
  const error = new URLSearchParams(location.search).get("error");
  if (errors[error])
    document.querySelector("#accountError").textContent = errors[error];
}
function renderGuestScreen() {
  document.title = "Layar Tamu — Temu";
  root.innerHTML = `<div class="website">${siteHeader({ user: me })}<main class="guest-page"><div class="guest-controls"><div><h1>Layar Tamu</h1><p>Masukkan nama tamu untuk sapaan penyambutan. Nama hanya ditampilkan pada perangkat ini.</p></div><form id="guestForm"><label for="guestName">Nama tamu</label><input id="guestName" name="guestName" maxlength="100" placeholder="Contoh: Bapak Arif & keluarga" required><button class="site-button">Tampilkan sapaan</button></form></div><section id="guestDisplay" class="guest-display" aria-live="polite"><span aria-hidden="true">❀</span><p>SELAMAT DATANG</p><h2 id="guestGreeting">Tamu istimewa kami</h2><p>Terima kasih telah menjadi bagian<br>dari hari yang penuh kebahagiaan.</p><small>Dengan hangat, temu ♡</small></section><div class="guest-actions"><button class="site-button" id="fullscreenGuest">Tampilkan layar penuh</button><button class="site-button secondary" id="resetGuest">Hapus nama</button></div></main></div>`;
  bindSiteMenu();
  document.querySelector("#guestForm").onsubmit = (e) => {
    e.preventDefault();
    document.querySelector("#guestGreeting").textContent =
      document.querySelector("#guestName").value.trim() || "Tamu istimewa kami";
  };
  document.querySelector("#resetGuest").onclick = () => {
    document.querySelector("#guestName").value = "";
    document.querySelector("#guestGreeting").textContent = "Tamu istimewa kami";
  };
  document.querySelector("#fullscreenGuest").onclick = async () => {
    try {
      await document.querySelector("#guestDisplay").requestFullscreen();
    } catch {
      toast("Layar penuh tidak tersedia pada browser ini.");
    }
  };
}
