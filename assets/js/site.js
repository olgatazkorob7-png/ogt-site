document.addEventListener('DOMContentLoaded', () => {
/* Optional conversion goals; no contact details or answers are sent as event parameters. */
(() => {
  const storageKey = 'ogt-analytics-consent';
  const counterId = 114259385;
  const banner = document.getElementById('analytics-consent');
  const allowedGoals = new Set(['quiz_start', 'quiz_step_2', 'quiz_step_3', 'form_attempt', 'form_success', 'form_submit', 'tg_click', 'phone_click', 'email_click', 'resume_click']);
  let consent = null;
  let active = false;
  let returnFocus = null;
  try { consent = localStorage.getItem(storageKey); } catch { /* Storage may be disabled. */ }
  function notifyConsentChange() {
    document.dispatchEvent(new Event('ogt:consent-change'));
  }
  function analyticsUrl() {
    const params = new URLSearchParams(location.search);
    const utm = new URLSearchParams();
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = params.get(key);
      if (value) utm.set(key, value);
    }
    const query = utm.toString();
    return location.origin + location.pathname + (query ? `?${query}` : '');
  }
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
      url: analyticsUrl(),
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
    if (banner) banner.hidden = true;
    notifyConsentChange();
    returnFocus?.focus();
    returnFocus = null;
  }
  if (banner) {
    banner.querySelector('[data-analytics="allow"]')?.addEventListener('click', () => choose('granted'));
    banner.querySelector('[data-analytics="deny"]')?.addEventListener('click', () => choose('denied'));
    document.querySelectorAll('[data-analytics-settings]').forEach(button => {
      button.addEventListener('click', () => {
        returnFocus = button;
        banner.hidden = false;
        notifyConsentChange();
        banner.querySelector('button')?.focus();
      });
    });
    if (consent === 'granted') start();
    banner.hidden = consent === 'granted' || consent === 'denied';
    notifyConsentChange();
  }
})();
});

document.addEventListener('DOMContentLoaded', () => {
/* Navigation, active section highlight, floating Telegram CTA, and progressive reveal. */
(() => {
  const button = document.querySelector('.mobile-menu-btn');
  const navigation = document.getElementById('main-navigation');
  let menuOpen = false;
  if (button && navigation) {
    document.documentElement.classList.add('nav-ready');
    const setMenu = open => {
      menuOpen = Boolean(open);
      navigation.classList.toggle('active', menuOpen);
      button.setAttribute('aria-expanded', String(menuOpen));
      button.setAttribute('aria-label', menuOpen ? 'Закрыть меню' : 'Открыть меню');
      document.dispatchEvent(new CustomEvent('ogt:menu-change', { detail: { open: menuOpen } }));
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

  // Subtle active navigation indicator for top-level sections.
  const navEntries = [...document.querySelectorAll('.nav-links a[href^="#"]')]
    .map(link => {
      const id = link.getAttribute('href')?.slice(1);
      const section = id ? document.getElementById(id) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);
  let navRaf = 0;
  function updateActiveNav() {
    navRaf = 0;
    const probeY = 160;
    let activeEntry = null;
    for (const entry of navEntries) {
      const rect = entry.section.getBoundingClientRect();
      if (rect.top <= probeY && rect.bottom > probeY) {
        activeEntry = entry;
        break;
      }
    }
    navEntries.forEach(({ link }) => {
      if (activeEntry && link === activeEntry.link) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function scheduleNavUpdate() {
    if (!navRaf && navEntries.length > 0) navRaf = requestAnimationFrame(updateActiveNav);
  }
  if (navEntries.length > 0) {
    window.addEventListener('scroll', scheduleNavUpdate, { passive: true });
    window.addEventListener('resize', scheduleNavUpdate, { passive: true });
    updateActiveNav();
  }

  // Floating Telegram CTA: shown only after scrolling past hero, hidden near #contact / footer / open consent banner.
  const floatingTg = document.getElementById('floating-tg-cta');
  const consentBanner = document.getElementById('analytics-consent');
  const contactSection = document.getElementById('contact');
  const siteFooter = document.querySelector('.site-footer');
  if (floatingTg) {
    let contactInView = false;
    let footerInView = false;
    let scrollRaf = 0;

    function updateFloatingTg() {
      scrollRaf = 0;
      const pastHero = window.scrollY > 460;
      const consentOpen = Boolean(consentBanner && !consentBanner.hidden);
      const visible = pastHero && !contactInView && !footerInView && !consentOpen && !menuOpen;
      floatingTg.classList.toggle('is-visible', visible);
      floatingTg.setAttribute('aria-hidden', String(!visible));
      if (visible) floatingTg.removeAttribute('tabindex');
      else floatingTg.setAttribute('tabindex', '-1');
    }

    if (typeof IntersectionObserver === 'function' && (contactSection || siteFooter)) {
      const hideObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.target === contactSection) contactInView = entry.isIntersecting;
          if (entry.target === siteFooter) footerInView = entry.isIntersecting;
        });
        updateFloatingTg();
      }, { threshold: 0.01, rootMargin: '0px 0px 40px 0px' });
      if (contactSection) hideObserver.observe(contactSection);
      if (siteFooter) hideObserver.observe(siteFooter);
    }

    window.addEventListener('scroll', () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(updateFloatingTg);
    }, { passive: true });
    document.addEventListener('ogt:consent-change', updateFloatingTg);
    document.addEventListener('ogt:menu-change', updateFloatingTg);
    updateFloatingTg();
  }

  // Progressive scroll-reveal below the fold; clears state to 'done' so card hover transforms stay crisp.
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const revealNodes = [...document.querySelectorAll('[data-reveal]')];
  if (!reducedMotion && revealNodes.length > 0 && typeof IntersectionObserver === 'function') {
    const viewportHeight = window.innerHeight || 800;
    const pendingNodes = [];

    function revealNode(el) {
      if (el.dataset.reveal !== 'pending') return;
      const delayMs = Number.parseInt(el.dataset.revealDelay || '0', 10) || 0;
      el.dataset.reveal = 'entering';
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        el.dataset.reveal = 'done';
        el.style.removeProperty('--reveal-delay');
      };
      el.addEventListener('transitionend', event => {
        if (event.target === el && event.propertyName === 'opacity') finish();
      }, { once: true });
      setTimeout(finish, delayMs + 520);
    }

    revealNodes.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < viewportHeight - 24) {
        el.dataset.reveal = 'done';
      } else {
        const delayMs = Number.parseInt(el.dataset.revealDelay || '0', 10) || 0;
        if (delayMs > 0) el.style.setProperty('--reveal-delay', `${delayMs}ms`);
        el.dataset.reveal = 'pending';
        pendingNodes.push(el);
      }
    });

    if (pendingNodes.length > 0) {
      document.documentElement.classList.add('reveal-ready');
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting || entry.boundingClientRect.top < (window.innerHeight || 800)) {
            revealObserver.unobserve(entry.target);
            revealNode(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

      pendingNodes.forEach(el => revealObserver.observe(el));

      window.addEventListener('hashchange', () => {
        const vh = window.innerHeight || 800;
        pendingNodes.forEach(el => {
          if (el.dataset.reveal === 'pending' && el.getBoundingClientRect().top < vh) {
            revealObserver.unobserve(el);
            revealNode(el);
          }
        });
      });
    }
  }
})();
});
