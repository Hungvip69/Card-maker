// Trang giới thiệu: chỉ cần i18n, bộ chọn ngôn ngữ, thiệp mẫu ở hero, FAQ, hiệu ứng reveal.
import { defaultsFor, renderCard } from '/js/render.js';
import { t, applyI18n, buildLangSwitcher } from '/js/i18n.js';
import { initThemeToggle } from '/js/theme.js';

// ---- Hero card mẫu ----
function drawHero() {
  const hero = document.getElementById('heroCard');
  if (hero) renderCard(hero, { ...defaultsFor('love'), recipientLabel: t('to') });
}

// ---- FAQ accordion ----
document.querySelectorAll('.faq-q').forEach((q) => {
  q.addEventListener('click', () => {
    const item = q.closest('.faq-item');
    const open = item.classList.toggle('open');
    q.querySelector('.sign').textContent = open ? '−' : '+';
  });
});

// ---- Scroll reveal ----
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ---- i18n ----
buildLangSwitcher(document.getElementById('langSelect'));
initThemeToggle();
applyI18n();
drawHero();
window.addEventListener('langchange', () => { applyI18n(); drawHero(); });
