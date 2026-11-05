function startWeddingMotion(invitation, panel) {
  window.weddingMotion?.destroy();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    desktop = matchMedia("(min-width:1024px)");
  let observer;
  const targets = [
    ...invitation.querySelectorAll(
      ".w-section > h2,.w-section > .w-eyebrow,.partner,.story-timeline li,.schedule-timeline li,.map-locations article,.public-gallery button,.gift-list article",
    ),
  ];
  function reveal(el) {
    el.classList.add("float-visible");
    observer?.unobserve(el);
  }
  function setup() {
    observer?.disconnect();
    if (reduced.matches || !window.IntersectionObserver) {
      targets.forEach(reveal);
      return;
    }
    observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) reveal(entry.target);
        }),
      {
        root: desktop.matches ? panel : null,
        threshold: 0.08,
        rootMargin: "0px 0px -16px 0px",
      },
    );
    targets
      .filter((el) => !el.classList.contains("float-visible"))
      .forEach((el) => {
        el.classList.add("float-ready");
        observer.observe(el);
      });
  }
  const focus = (event) => {
    const target = event.target.closest(".float-ready");
    if (target) reveal(target);
  };
  invitation.addEventListener("focusin", focus);
  reduced.addEventListener("change", setup);
  desktop.addEventListener("change", setup);
  setup();
  window.weddingMotion = {
    destroy() {
      observer?.disconnect();
      invitation.removeEventListener("focusin", focus);
      reduced.removeEventListener("change", setup);
      desktop.removeEventListener("change", setup);
    },
  };
}
function scheduleTimeline(schedules, zone) {
  return `<ol class="schedule-timeline">${schedules.map((row, i) => `<li><div class="agenda-details"><h3>${esc(row.title)}</h3><p>${row.date ? date(row.date) : "Tanggal belum diisi"}</p><p class="prose">${esc(row.description || row.address || "")}</p></div><span class="agenda-marker" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div class="agenda-time"><span>${esc(row.start)}${row.untilFinished ? " – Selesai" : row.end ? " – " + esc(row.end) : ""}</span><small>${zone}</small></div></li>`).join("")}</ol>`;
}
