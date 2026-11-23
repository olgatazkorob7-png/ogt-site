document.addEventListener('DOMContentLoaded', () => {
/* Optional conversion goals; no contact details or answers are sent as event parameters. */
(() => {
  const storageKey = 'ogt-analytics-consent';
  const counterId = 114259385;
  const banner = document.getElementById('analytics-consent');
  const allowedGoals = new Set(['quiz_start', 'quiz_step_2', 'quiz_step_3', 'form_attempt', 'form_success', 'form_submit', 'tg_click', 'email_click', 'resume_click']);
  let consent = null;
  let active = false;
  let returnFocus = null;
  try { consent = localStorage.getItem(storageKey); } catch { /* Storage may be disabled. */ }
  function start() {
    if (active || consent !== 'granted') return;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = window.ym.l || Date.now();
    if (!document.getElementById('metrika-sdk')) {
      const script = document.createElement('script');
      script.id = 'metrika-sdk';
      script.async = true;
      script.src = 'https://mc.yandex.ru/metrika/tag.js';
      document.head.appendChild(script);
    }
    window.ym(counterId, 'init', {
      webvisor: false,
      clickmap: false,
      trackLinks: true,
      accurateTrackBounce: true,
      url: location.origin + location.pathname,
    });
    active = true;
  }
  window.trackGoal = name => {
    if (consent !== 'granted' || !allowedGoals.has(name)) return;
    try { if (typeof window.ym === 'function') window.ym(counterId, 'reachGoal', name); } catch { /* Never block navigation or a lead. */ }
  };
  function choose(value) {
    consent = value;
    try { localStorage.setItem(storageKey, value); } catch { /* Keep the choice in memory for this page. */ }
    if (value === 'granted') start();
    else if (active) {
      // If the SDK is still loading, discard queued init/goals before it can process them.
      if (Array.isArray(window.ym?.a)) window.ym.a.length = 0;
      try { window.ym(counterId, 'destruct'); } catch { /* A blocked SDK must not affect the page. */ }
      active = false;
    }
    banner.hidden = true;
    returnFocus?.focus();
    returnFocus = null;
  }
  banner.querySelector('[data-analytics="allow"]').addEventListener('click', () => choose('granted'));
  banner.querySelector('[data-analytics="deny"]').addEventListener('click', () => choose('denied'));
  document.querySelectorAll('[data-analytics-settings]').forEach(button => {
    button.addEventListener('click', () => {
      returnFocus = button;
      banner.hidden = false;
      banner.querySelector('button').focus();
    });
  });
  if (consent === 'granted') start();
  banner.hidden = consent === 'granted' || consent === 'denied';
})();
});

document.addEventListener('DOMContentLoaded', () => {
/* Navigation is the only essential site-level enhancement. FAQ/details are native. */
(() => {
  const button = document.querySelector('.mobile-menu-btn');
  const navigation = document.getElementById('main-navigation');
  if (button && navigation) {
    document.documentElement.classList.add('nav-ready');
    const setMenu = open => {
      navigation.classList.toggle('active', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };
    button.addEventListener('click', () => setMenu(button.getAttribute('aria-expanded') !== 'true'));
    navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        button.focus();
      }
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.header-container')) setMenu(false);
    });
    window.matchMedia('(max-width: 992px)').addEventListener('change', () => setMenu(false));
  }
  // Only non-personal, allow-listed event names. Never read form answers here.
  document.querySelectorAll('a[data-goal]').forEach(link => {
    link.addEventListener('click', () => {
      try { window.trackGoal?.(link.dataset.goal); } catch { /* Statistics never block navigation. */ }
    });
  });
})();
});
