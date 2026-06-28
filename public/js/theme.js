// Chế độ sáng/tối. Lưu lựa chọn vào localStorage; lần đầu theo prefers-color-scheme.
// Việc set sớm <html data-theme> để tránh nháy nền nằm ở snippet inline trong <head>;
// module này lo nút chuyển và đồng bộ.

const STORE_KEY = 'cardmaker.theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  try { localStorage.setItem(STORE_KEY, dark ? 'dark' : 'light'); } catch {}
  syncButtons();
  window.dispatchEvent(new CustomEvent('themechange', { detail: dark ? 'dark' : 'light' }));
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

function syncButtons() {
  const dark = getTheme() === 'dark';
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    // Hiện icon của chế độ sẽ chuyển sang (mặt trăng khi đang sáng, mặt trời khi đang tối)
    btn.innerHTML = dark ? SUN : MOON;
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('aria-pressed', String(dark));
  });
}

/** Gắn sự kiện cho mọi nút [data-theme-toggle]. */
export function initThemeToggle() {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });
  syncButtons();

  // Nếu người dùng CHƯA chọn tay, theo hệ thống và cập nhật khi hệ thống đổi.
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (!saved && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', (e) => {
        if (!localStorage.getItem(STORE_KEY)) {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
          syncButtons();
        }
      });
    }
  } catch {}
}
