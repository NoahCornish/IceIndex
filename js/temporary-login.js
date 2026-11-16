/* IceIndex v0.15.0 — cosmetic GitHub Pages access gate.
 * NOT SECURITY. Public HTML/JS/CSV and repository remain directly accessible.
 * To change the demo password, edit ACCESS_PASSWORD below.
 */
(() => {
  "use strict";
  const ACCESS_PASSWORD = "IceIndex2026";
  const KEY = "iceindex-temporary-preview-session";
  const gate = document.getElementById("ice-access-gate");
  const form = document.getElementById("ice-access-form");
  const input = document.getElementById("ice-access-password");
  const error = document.getElementById("ice-access-error");
  const logout = document.getElementById("ice-access-logout");
  if (!gate || !form || !input) return;
  function unlock() {
    sessionStorage.setItem(KEY, "yes");
    gate.hidden = true;
    document.body.classList.remove("ice-access-locked");
    input.value = "";
    error.textContent = "";
  }
  function lock() {
    sessionStorage.removeItem(KEY);
    document.body.classList.add("ice-access-locked");
    gate.hidden = false;
    input.value = "";
    error.textContent = "";
    input.focus();
  }
  if (sessionStorage.getItem(KEY) === "yes") unlock();
  else { gate.hidden = false; input.focus(); }
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (input.value === ACCESS_PASSWORD) unlock();
    else { error.textContent = "Incorrect password. Please try again."; input.select(); }
  });
  document.getElementById("ice-access-show")?.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    document.getElementById("ice-access-show").textContent = show ? "Hide" : "Show";
  });
  logout?.addEventListener("click", lock);
})();
