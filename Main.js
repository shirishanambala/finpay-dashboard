/**
 * main.js — FinPay
 * ============================================================
 * Application entry point.
 *
 * Responsibilities:
 *  - Wait for DOM to be ready (DOMContentLoaded)
 *  - Detect the current page
 *  - Initialise global modules (run on every page)
 *  - Initialise page-specific modules only where needed
 *  - Graceful error isolation (one module failing won't break others)
 *  - Performance: page-specific code is only imported when needed
 *    via dynamic import() so unused modules are never parsed
 *
 * Module map:
 *  navigation.js  — sticky nav, mobile menu, active links, smooth scroll
 *  animations.js  — scroll reveal, hero entrance, CTA reveal
 *  counter.js     — animated statistics counters
 *  faq.js         — accessible accordion
 *  carousel.js    — testimonials slider
 *  forms.js       — validation, password strength, show/hide
 *  pricing.js     — monthly/yearly toggle, price animation
 * ============================================================
 */

'use strict';

// ─── Static imports (global modules — loaded on every page) ──

import { initNavigation } from './navigation.js';
import { initAnimations } from './animations.js';

// ─── Utility ─────────────────────────────────────────────────

/**
 * Returns the current page filename.
 * e.g. "/finpay/pricing.html" → "pricing.html"
 * Bare "/" or "" → "index.html"
 * @returns {string}
 */
const getCurrentPage = () => {
  const path     = window.location.pathname;
  const filename = path.split('/').pop();
  return filename === '' ? 'index.html' : filename;
};

/**
 * Safely runs an async initialiser function.
 * Catches and logs any errors without crashing other modules.
 *
 * @param {string}   name   - Human-readable module name for logging
 * @param {Function} initFn - Async or sync function to call
 * @returns {Promise<void>}
 */
const safeInit = async (name, initFn) => {
  try {
    await initFn();
  } catch (err) {
    console.error(`[FinPay] Failed to initialise module: ${name}`, err);
  }
};

/**
 * Dynamically imports a module and calls a named export.
 * Silently skips if the module or export isn't found.
 *
 * @param {string} path       - Relative path to the JS module
 * @param {string} exportName - Name of the exported init function
 * @param {...any} args       - Arguments to pass to the init function
 * @returns {Promise<void>}
 */
const lazyInit = async (path, exportName, ...args) => {
  try {
    const module = await import(path);
    if (typeof module[exportName] === 'function') {
      await module[exportName](...args);
    } else {
      console.warn(`[FinPay] Export "${exportName}" not found in ${path}`);
    }
  } catch (err) {
    console.error(`[FinPay] Failed to load module: ${path}`, err);
  }
};

// ─── Page Detection Helpers ───────────────────────────────────

/**
 * Maps page filenames to a short identifier used in the switch below.
 * Handles both root paths and nested paths.
 */
const PAGE_MAP = {
  'index.html':    'home',
  '':              'home',
  'payments.html': 'payments',
  'pricing.html':  'pricing',
  'resources.html':'resources',
  'about.html':    'about',
  'contact.html':  'contact',
  'login.html':    'login',
  'signup.html':   'signup',
  '404.html':      '404',
};

// ─── Global Module Initialisers ───────────────────────────────

/**
 * Modules that run on every page regardless of context.
 * Order matters: navigation first, then visual enhancements.
 */
const initGlobalModules = async () => {
  // 1. Navigation (sticky, mobile menu, active links, smooth scroll)
  await safeInit('Navigation', () => initNavigation());

  // 2. Scroll animations & hero entrance
  await safeInit('Animations', () => initAnimations());

  // 3. FAQ accordion — present on multiple pages (home, contact, pricing, resources)
  //    Load lazily but check for FAQ elements before importing
  if (document.querySelector('.faq-list, .faq-item, [data-faq]')) {
    await safeInit('FAQ', () => lazyInit('./faq.js', 'initFaq'));
  }

  // 4. Stat counters — present on home, about, signup
  if (document.querySelector('[data-counter], .stat-number, .proof-stat dd')) {
    await safeInit('Counters', () => lazyInit('./counter.js', 'initCounters'));
  }

  // 5. Carousel / testimonials — present on home, about, resources
  if (document.querySelector(
    '.carousel, [data-carousel], .testimonial-card, #testimonials'
  )) {
    await safeInit('Carousel', () => lazyInit('./carousel.js', 'initCarousels'));
  }
};

// ─── Page-Specific Module Initialisers ───────────────────────

/**
 * Modules scoped to individual pages.
 * Dynamic import() means the browser only downloads JS for the
 * current page — not the entire application bundle.
 *
 * @param {string} pageId - Short page identifier from PAGE_MAP
 */
const initPageModules = async (pageId) => {
  switch (pageId) {

    // ── Home Page ─────────────────────────────────────────
    case 'home': {
      // Pricing toggle may appear on homepage as a teaser
      if (document.querySelector('.pricing-toggle, [data-pricing-toggle]')) {
        await safeInit('Pricing', () => lazyInit('./pricing.js', 'initPricing'));
      }
      break;
    }

    // ── Payments Page ─────────────────────────────────────
    case 'payments': {
      // No unique JS modules beyond globals for this page
      break;
    }

    // ── Pricing Page ─────────────────────────────────────
    case 'pricing': {
      await safeInit('Pricing', () => lazyInit('./pricing.js', 'initPricing'));
      break;
    }

    // ── Resources Page ────────────────────────────────────
    case 'resources': {
      // Resources may have tab panels for docs / API / guides
      if (document.querySelector('[data-tabs], .resource-tabs')) {
        await safeInit('Tabs', () => lazyInit('./tabs.js', 'initTabs'));
      }
      break;
    }

    // ── About Page ────────────────────────────────────────
    case 'about': {
      // Timeline animations handled by animations.js (IntersectionObserver)
      // No additional modules needed
      break;
    }

    // ── Contact Page ─────────────────────────────────────
    case 'contact': {
      await safeInit('Forms (contact)', () =>
        lazyInit('./forms.js', 'initForms', { page: 'contact' })
      );
      break;
    }

    // ── Login Page ───────────────────────────────────────
    case 'login': {
      await safeInit('Forms (login)', () =>
        lazyInit('./forms.js', 'initForms', { page: 'login' })
      );
      break;
    }

    // ── Signup Page ──────────────────────────────────────
    case 'signup': {
      await safeInit('Forms (signup)', () =>
        lazyInit('./forms.js', 'initForms', { page: 'signup' })
      );
      break;
    }

    // ── 404 Page ─────────────────────────────────────────
    case '404': {
      // Search form on 404 — minimal validation only
      if (document.querySelector('#error-search-form')) {
        await safeInit('Forms (404 search)', () =>
          lazyInit('./forms.js', 'initForms', { page: '404' })
        );
      }
      break;
    }

    default:
      break;
  }
};

// ─── Performance: Mark paint timing ──────────────────────────

/**
 * Logs a performance mark so DevTools shows when JS init completed.
 * Useful for profiling without impacting production users.
 */
const markPerformance = (label) => {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(`finpay:${label}`);
  }
};

// ─── Accessibility: Skip link focus fix ──────────────────────

/**
 * Some browsers (notably Safari) don't move focus to the target of
 * a skip-to-content link. This fixes that by explicitly calling focus()
 * on #main-content when the skip link is activated.
 */
const initSkipLink = () => {
  const skipLink   = document.querySelector('a[href="#main-content"]');
  const mainContent = document.querySelector('#main-content');
  if (!skipLink || !mainContent) return;

  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    mainContent.setAttribute('tabindex', '-1');
    mainContent.focus();
  });
};

// ─── Accessibility: Detect keyboard vs pointer navigation ────

/**
 * Adds a 'keyboard-nav' class to <body> when the user presses Tab,
 * and removes it on mousedown. This allows CSS to show focus rings
 * only for keyboard users (not mouse clicks).
 *
 * Pattern: https://www.w3.org/WAI/WCAG21/Techniques/css/C15
 */
const initFocusMode = () => {
  const body = document.body;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') body.classList.add('keyboard-nav');
  });

  document.addEventListener('mousedown', () => {
    body.classList.remove('keyboard-nav');
  });
};

// ─── Accessibility: Announce route for SPA-like transitions ──

/**
 * If the site ever adopts client-side navigation, this live region
 * is ready to announce page transitions to screen readers.
 * Currently a no-op placeholder.
 */
const initRouteAnnouncer = () => {
  const announcer = document.createElement('div');
  announcer.id        = 'route-announcer';
  announcer.className = 'sr-only';
  announcer.setAttribute('aria-live',   'polite');
  announcer.setAttribute('aria-atomic', 'true');
  document.body.appendChild(announcer);
};

// ─── Application Bootstrap ────────────────────────────────────

/**
 * Main bootstrap function — called on DOMContentLoaded.
 * Runs all initialisers in the correct order with error isolation.
 */
const bootstrap = async () => {
  markPerformance('init-start');

  const pageId = PAGE_MAP[getCurrentPage()] ?? 'unknown';

  // ── Accessibility foundations (synchronous, no risk) ────
  initSkipLink();
  initFocusMode();
  initRouteAnnouncer();

  // ── Global modules (navigation, animations, FAQ, counters, carousel)
  await initGlobalModules();

  // ── Page-specific modules
  await initPageModules(pageId);

  markPerformance('init-end');

  if (process?.env?.NODE_ENV === 'development') {
    console.log(`[FinPay] Page "${pageId}" initialised.`);
  }
};

// ─── Entry Point ──────────────────────────────────────────────

/**
 * Guard against running before DOM is ready.
 * 'interactive' means HTML is parsed but sub-resources may still load.
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  // DOM already ready (script loaded with defer/async or injected late)
  bootstrap();
}