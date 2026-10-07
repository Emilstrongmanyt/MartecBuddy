/* App chrome only. Formula matching, saving and the water diagram stay in the page script. */
(function () {
  const root = document.documentElement;

  function paintTabs() {
    const formulas = document.getElementById("view-formulas");
    const diagram = document.getElementById("view-ph");
    if (formulas) {
      formulas.setAttribute("aria-label", "Formler");
      formulas.innerHTML = '<span class="tab-glyph mark" aria-hidden="true">ƒ</span><span class="tab-label">Formler</span>';
    }
    if (diagram) {
      diagram.setAttribute("aria-label", "log(p)-h diagram for vand");
      diagram.innerHTML = '<svg class="tab-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16c2.2-7 4.2-7 6.2 0s4 7 6.2 0 4-7 6.2 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="tab-label">Diagram</span>';
    }
  }

  function shortenTheme() {
    const theme = document.getElementById("theme-toggle");
    if (!theme) return;
    const full = theme.textContent || "";
    if (!full.startsWith("Tema:")) return;
    theme.setAttribute("aria-label", "Skift farvetema. " + full);
    theme.textContent = full.slice("Tema: ".length);
    theme.textContent = theme.textContent.charAt(0).toUpperCase() + theme.textContent.slice(1);
  }

  function dropMathcad() {
    document.querySelectorAll("[data-mathcad], [data-mathcad-options], #mathcad-dialog").forEach((node) => node.remove());
  }

  function keyboardInset() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    root.style.setProperty("--keyboard-inset", overlap + "px");
    root.classList.toggle("keyboard-open", overlap > 80);
  }

  function keepFieldVisible(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
    if (field.closest("dialog")) return;
    window.setTimeout(() => {
      const rect = field.getBoundingClientRect();
      const bottomLimit = window.innerHeight - 24 - (root.classList.contains("keyboard-open") ? 0 : 84);
      if (rect.top < 64 || rect.bottom > bottomLimit) field.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 280);
  }

  paintTabs();
  shortenTheme();
  document.getElementById("theme-toggle")?.addEventListener("click", () => window.setTimeout(shortenTheme, 0));
  dropMathcad();
  const copyHelp = document.querySelector("#copy-dialog .subtle");
  if (copyHelp) copyHelp.textContent = "Hold på teksten og vælg Kopiér. På en computer kan du bruge Ctrl+C.";

  document.getElementById("view-formulas")?.addEventListener("click", () => window.scrollTo(0, 0));
  document.getElementById("view-ph")?.addEventListener("click", () => window.scrollTo(0, 0));
  document.addEventListener("focusin", keepFieldVisible);
  window.visualViewport?.addEventListener("resize", keyboardInset);
  window.visualViewport?.addEventListener("scroll", keyboardInset);
  const rendered = new MutationObserver(dropMathcad);
  for (const id of ["results", "discovery-results"]) {
    const node = document.getElementById(id);
    if (node) rendered.observe(node, { childList: true, subtree: true });
  }
})();
