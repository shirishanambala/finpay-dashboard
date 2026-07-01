

'use strict';

// ─── Constants ───────────────────────────────────────────────

const STICKY_CLASS       = 'nav--sticky';
const MENU_OPEN_CLASS    = 'nav--menu-open';
const ACTIVE_LINK_CLASS  = 'nav__link--active';
const SCROLL_THRESHOLD   = 10; // px before sticky kicks in

// ─── Utility Helpers ─────────────────────────────────────────

/**
 * Returns the current page filename (e.g. "pricing.html").
 * Falls back to "index.html" for bare "/" paths.
 * @returns {string}
 */
const getCurrentPage = () => {
  const path = window.location.pathname;
  const filename = path.split('/').pop();
  return filename === '' ? 'index.html' : filename;
};

/**
 * Safely queries a single element; returns null without throwing.
 * @param {string} selector
 * @param {Document|Element} [context=document]
 * @returns {Element|null}
 */
const qs = (selector, context = document) => context.querySelector(selector);

/**
 * Safely queries all matching elements as an Array.
 * @param {string} selector
 * @param {Document|Element} [context=document]
 * @returns {Element[]}
 */
const qsa = (selector, context = document) =>
  Array.from(context.querySelectorAll(selector));

// ─── Module: Sticky Navigation ───────────────────────────────

/**
 * Adds / removes a sticky class on the site header based on
 * scroll position. Uses a passive scroll listener for performance.
 */
const initStickyNav = () => {
  const header = qs('#site-header');
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > SCROLL_THRESHOLD) {
      header.classList.add(STICKY_CLASS);
    } else {
      header.classList.remove(STICKY_CLASS);
    }
  };

  // Run once on init to handle page reload mid-scroll
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
};

// ─── Module: Mobile Menu Toggle ──────────────────────────────

/**
 * Wires up a hamburger / mobile menu toggle button.
 * The button is injected into the nav if not already present in HTML,
 * keeping HTML modification to zero while still supporting mobile UX.
 *
 * Accessibility:
 *  - aria-expanded reflects open/closed state
 *  - aria-controls points to the nav link list
 *  - Focus is trapped to menu items while open (Escape closes)
 */
const initMobileMenu = () => {
  const nav       = qs('#primary-nav');
  const navInner  = qs('.nav-inner', nav);
  const navLinks  = qs('.nav-links', nav);

  if (!nav || !navInner || !navLinks) return;

  // Give the links list an ID so aria-controls can reference it
  if (!navLinks.id) navLinks.id = 'primary-nav-links';

  // ── Create toggle button ──────────────────────────────────
  const toggle = document.createElement('button');
  toggle.type            = 'button';
  toggle.className       = 'nav__mobile-toggle';
  toggle.setAttribute('aria-expanded',  'false');
  toggle.setAttribute('aria-controls',  navLinks.id);
  toggle.setAttribute('aria-label',     'Open navigation menu');

  // Three-bar icon (visually rendered via CSS; text for SR fallback)
  toggle.innerHTML = `
    <span class="nav__hamburger-bar" aria-hidden="true"></span>
    <span class="nav__hamburger-bar" aria-hidden="true"></span>
    <span class="nav__hamburger-bar" aria-hidden="true"></span>
    <span class="sr-only">Menu</span>
  `;

  navInner.appendChild(toggle);

  // ── Open / Close helpers ──────────────────────────────────
  const openMenu = () => {
    nav.classList.add(MENU_OPEN_CLASS);
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label',    'Close navigation menu');
    // Move focus to first nav link
    const firstLink = qs('a', navLinks);
    if (firstLink) firstLink.focus();
  };

  const closeMenu = () => {
    nav.classList.remove(MENU_OPEN_CLASS);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label',    'Open navigation menu');
  };

  // ── Toggle click ─────────────────────────────────────────
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.contains(MENU_OPEN_CLASS);
    isOpen ? closeMenu() : openMenu();
  });

  // ── Close on any nav link click ───────────────────────────
  qsa('a', navLinks).forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // ── Close on outside click ────────────────────────────────
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeMenu();
  });

  // ── Keyboard: Escape closes menu ─────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains(MENU_OPEN_CLASS)) {
      closeMenu();
      toggle.focus(); // return focus to trigger
    }
  });

  // ── Keyboard: Tab trap within open menu ──────────────────
  navLinks.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !nav.classList.contains(MENU_OPEN_CLASS)) return;

    const focusable = qsa('a, button', navLinks).filter(
      el => !el.hasAttribute('disabled')
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
};

// ─── Module: Active Page Highlighting ────────────────────────

/**
 * Compares each nav link's href against the current page filename
 * and applies an active class + aria-current="page" attribute.
 */
const initActiveLink = () => {
  const currentPage = getCurrentPage();
  const navLinks    = qsa('#primary-nav .nav-links a');

  navLinks.forEach(link => {
    const linkPage = link.getAttribute('href')?.split('/').pop() ?? '';

    if (linkPage === currentPage) {
      link.classList.add(ACTIVE_LINK_CLASS);
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove(ACTIVE_LINK_CLASS);
      link.removeAttribute('aria-current');
    }
  });
};

// ─── Module: Smooth Scrolling ────────────────────────────────

/**
 * Intercepts clicks on internal anchor links (href="#...") and
 * scrolls smoothly to the target element, respecting the sticky
 * header height as an offset.
 *
 * Respects prefers-reduced-motion by falling back to instant scroll.
 */
const initSmoothScroll = () => {
  const prefersReduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const targetId = link.getAttribute('href').slice(1);
    if (!targetId) return;

    const target = document.getElementById(targetId);
    if (!target) return;

    e.preventDefault();

    const header = qs('#site-header');
    const offset = header ? header.offsetHeight + 8 : 0;
    const top    = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });

    // Update focus for accessibility
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
};

// ─── Module: Accessible Dropdown Menus ───────────────────────

/**
 * Manages any nav items that have a child dropdown/mega-menu.
 * Expects the HTML pattern:
 *   <li class="nav__item--has-dropdown">
 *     <a ...>Label</a>
 *     <ul class="nav__dropdown" ...>...</ul>
 *   </li>
 *
 * Accessibility:
 *  - parent <a> gets aria-haspopup="true" and aria-expanded
 *  - dropdown gets role="menu" and each child role="menuitem"
 *  - Arrow keys navigate within dropdown
 *  - Escape closes dropdown and returns focus to parent
 */
const initDropdowns = () => {
  const dropdownItems = qsa('.nav__item--has-dropdown', qs('#primary-nav'));
  if (dropdownItems.length === 0) return;

  dropdownItems.forEach(item => {
    const trigger  = qs('a, button', item);
    const dropdown = qs('.nav__dropdown', item);

    if (!trigger || !dropdown) return;

    // ARIA setup
    const dropId = `dropdown-${Math.random().toString(36).slice(2, 7)}`;
    dropdown.id  = dropId;
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded',  'false');
    trigger.setAttribute('aria-controls',  dropId);
    dropdown.setAttribute('role', 'menu');

    qsa('a', dropdown).forEach(a => a.setAttribute('role', 'menuitem'));

    const openDropdown = () => {
      dropdown.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    };

    const closeDropdown = () => {
      dropdown.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    };

    // Start closed
    closeDropdown();

    // Hover (pointer devices)
    item.addEventListener('mouseenter', openDropdown);
    item.addEventListener('mouseleave', closeDropdown);

    // Click / Enter / Space on trigger
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      isOpen ? closeDropdown() : openDropdown();
    });

    // Keyboard navigation within dropdown
    dropdown.addEventListener('keydown', (e) => {
      const items   = qsa('[role="menuitem"]', dropdown);
      const focused = document.activeElement;
      const index   = items.indexOf(focused);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (e.key === 'Escape') {
        closeDropdown();
        trigger.focus();
      } else if (e.key === 'Tab') {
        closeDropdown();
      }
    });

    // Close when focus leaves the whole item
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) closeDropdown();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!item.contains(e.target)) closeDropdown();
    });
  });
};

// ─── Public Init ─────────────────────────────────────────────

/**
 * Initialises all navigation sub-modules.
 * Called from main.js on DOMContentLoaded.
 */
const initNavigation = () => {
  initStickyNav();
  initMobileMenu();
  initActiveLink();
  initSmoothScroll();
  initDropdowns();
};

export { initNavigation };