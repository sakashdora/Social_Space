// Applies the saved theme before first paint. Kept as a static file so the
// Content-Security-Policy can avoid 'unsafe-inline' for scripts.
(function () {
  try {
    var stored = localStorage.getItem("veil-theme");
    var theme =
      stored ||
      (window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark");
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
