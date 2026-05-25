// Inline script runs before paint to apply the saved/system theme,
// preventing a flash of the wrong color scheme on first load.

export function ThemeInitScript() {
  const code = `
(function () {
  try {
    var c = document.cookie.match(/(?:^|; )theme=([^;]*)/);
    var stored = c ? decodeURIComponent(c[1]) : null;
    var theme = stored;
    if (!theme || theme === "system") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`.trim();
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
