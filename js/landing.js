const header = document.querySelector("#siteHeader");
const nav = document.querySelector("#siteNav");
const toggle = document.querySelector("#navToggle");
const legacyAppViews = new Set([
  "dashboard", "plans", "map", "fields", "weather", "notify", "checklist", "drone", "report", "history", "admin", "profile", "sources",
]);

if (legacyAppViews.has(location.hash.slice(1))) {
  location.replace(`app.html${location.search}${location.hash}`);
}

function syncHeader() {
  header?.classList.toggle("scrolled", window.scrollY > 24);
}

function setNavigationOpen(open) {
  nav?.classList.toggle("open", open);
  document.body.classList.toggle("nav-open", open);
  toggle?.setAttribute("aria-expanded", String(open));
  toggle?.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
}

toggle?.addEventListener("click", () => setNavigationOpen(!nav?.classList.contains("open")));
nav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) setNavigationOpen(false);
});
window.addEventListener("scroll", syncHeader, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth > 1100) setNavigationOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setNavigationOpen(false);
});

document.querySelector("#currentYear").textContent = String(new Date().getFullYear());
syncHeader();
