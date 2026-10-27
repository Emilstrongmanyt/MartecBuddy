/* App chrome for the AC tools page. The calculations stay in app.js. */
(function () {
  const root = document.documentElement;

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
    if (field.type === "checkbox" || field.type === "radio" || field.type === "range") return;
    window.setTimeout(() => {
      const rect = field.getBoundingClientRect();
      const bottomLimit = window.innerHeight - 24 - (root.classList.contains("keyboard-open") ? 0 : 84);
      if (rect.top < 80 || rect.bottom > bottomLimit) field.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 280);
  }

  document.addEventListener("focusin", keepFieldVisible);
  window.visualViewport?.addEventListener("resize", keyboardInset);
  window.visualViewport?.addEventListener("scroll", keyboardInset);
})();
