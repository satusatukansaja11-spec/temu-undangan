function applySakuraTheme() {
  const invitation = document.querySelector(".wedding-v2");
  invitation.classList.add("wedding-sakura");
  const ornament = document.createElement("div");
  ornament.className = "sakura-ornaments";
  ornament.setAttribute("aria-hidden", "true");
  ornament.innerHTML = `<img class="sakura-tree" src="/assets/sakura-branch.svg" alt="">${[0, 1, 2].map((n) => `<span class="butterfly butterfly-${n}"><svg viewBox="0 0 80 70"><g class="wing wing-left"><path d="M40 36C7-18-17 9 12 36-5 76 30 70 40 36"/></g><g class="wing wing-right"><path d="M40 36C73-18 97 9 68 36 85 76 50 70 40 36"/></g><path d="M40 20v38" stroke="#63544c" stroke-width="3"/><path d="m40 24-7-12m7 12 7-12" stroke="#63544c" fill="none"/></svg></span>`).join("")}`;
  invitation.append(ornament);
  const pause = () =>
    ornament.classList.toggle("motion-paused", document.hidden);
  document.addEventListener("visibilitychange", pause);
  pause();
  window.themeMotionCleanup = () => {
    document.removeEventListener("visibilitychange", pause);
    ornament.remove();
  };
}
