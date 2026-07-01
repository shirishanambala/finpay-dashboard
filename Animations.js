

'use strict';

// ─── Constants ───────────────────────────────────────────────

/** Class applied once an element has been revealed */
const REVEALED_CLASS = 'is-revealed';

/** Class applied to elements waiting to be revealed */
const REVEAL_PENDING_CLASS = 'will-reveal';

/** Class applied to hero elements before entrance animation */
const HERO_READY_CLASS = 'hero--ready';

/** Class applied to hero elements after entrance animation fires */
const HERO_ANIMATED_CLASS = 'hero--animated';

/**
 * Intersection Observer options for scroll-reveal.
 * rootMargin nudges the trigger point slightly above the fold bottom.
 */
const REVEAL_OBSERVER_OPTIONS = {
  root:       null,     // viewport
  rootMargin: '0px 0px -60px 0px',
  threshold:  0.12,     // 12% of element visible before triggering
};

/**
 * Stagger delay (ms) applied between sibling cards in a grid.
 * Kept short so the cascade feels snappy, not theatrical.
 */
const CARD_STAGGER_MS = 80;

// ─── Utility ─────────────────────────────────────────────────

/**
 * Detects whether the user has requested reduced motion.
 * When true, all animations are skipped and elements are
 * immediately made visible.
 * @returns {boolean}
 */
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Safely queries all matching elements as an Array.
 * @param {string} selector
 * @param {Document|Element} [ctx=document]
 * @returns {Element[]}
 */
const qsa = (selector, ctx = document) =>
  Array.from(ctx.querySelectorAll(selector));

/**
 * Applies a CSS custom property (--reveal-delay) to stagger
 * sibling elements within each parent container.
 * @param {Element[]} elements
 */
const applyStaggerDelays = (elements) => {
  // Group elements by their direct parent so stagger resets per container
  const groups = new Map();

  elements.forEach(el => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });

  groups.forEach(siblings => {
    siblings.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${i * CARD_STAGGER_MS}ms`);
    });
  });
};

// ─── Module: Hero Entrance Animation ─────────────────────────

/**
 * Animates hero section elements on page load.
 *
 * Targets elements inside any [id$="-hero"] section that carry
 * the data attribute [data-hero-animate], or falls back to
 * common hero child selectors (h1, p.hero-subtext, .hero-actions,
 * .hero-contact-strip, .hero-cta-group).
 *
 * Strategy:
 *  1. Add HERO_READY_CLASS to each element (CSS sets opacity:0 + translateY)
 *  2. On next animation frame, add HERO_ANIMATED_CLASS (CSS transitions in)
 *  3. Each element gets an incrementing --hero-delay custom property
 */
const initHeroAnimation = () => {
  if (prefersReducedMotion()) return;

  // Locate the primary hero section on the current page
  const hero = document.querySelector(
    '[id$="-hero"], #hero, .hero, section:first-of-type'
  );
  if (!hero) return;

  // Collect animatable children — explicit data attr takes priority,
  // otherwise fall back to known hero child selectors
  let targets = qsa('[data-hero-animate]', hero);

  if (targets.length === 0) {
    targets = qsa(
      [
        'h1',
        '.eyebrow',
        'p.hero-subtext',
        '.hero-actions',
        '.hero-cta-group',
        '.hero-contact-strip',
        '.btn-primary',
        '.btn-ghost',
        '.hero-badge',
        '.hero-visual',
      ].join(', '),
      hero
    );
  }

  if (targets.length === 0) return;

  // Step 1 — mark elements as ready (CSS hides them)
  targets.forEach((el, i) => {
    el.classList.add(HERO_READY_CLASS);
    el.style.setProperty('--hero-delay', `${i * 100}ms`);
  });

  // Step 2 — trigger animation on next frame (guarantees CSS has applied)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      targets.forEach(el => {
        el.classList.add(HERO_ANIMATED_CLASS);
      });
    });
  });
};

// ─── Module: Scroll Reveal — Generic Elements ─────────────────

/**
 * Observes elements marked with [data-reveal] or one of the
 * standard reveal selectors. When they enter the viewport,
 * REVEALED_CLASS is added (CSS handles the transition).
 *
 * Supported data attributes on observed elements:
 *  data-reveal           — required; marks element for observation
 *  data-reveal="fade-up" — default; fade in from below
 *  data-reveal="fade-in" — fade in place (no Y translation)
 *  data-reveal="slide-left" / "slide-right"
 *
 * The actual visual effect is implemented in CSS using these
 * classes; JS only adds/removes classes.
 */
const initScrollReveal = () => {
  // Selectors that receive scroll-reveal automatically
  // (no need to manually add data-reveal to every element in HTML)
  const AUTO_REVEAL_SELECTORS = [
    // Section headings
    'section > .section-inner > h2',
    'section > .section-inner > .section-subtext',
    'section > .section-inner > .eyebrow',

    // Feature / product cards
    '.feature-card',
    '.product-card',
    '.pricing-card',
    '.office-card',
    '.support-channel',
    '.helpful-link-card',
    '.benefit-item',
    '.testimonial-card',
    '.blog-card',
    '.guide-card',
    '.value-card',
    '.achievement-card',
    '.stat-card',
    '.timeline-item',
    '.team-card',

    // CTA sections
    '.cta-section',
    '[id$="-cta"] .section-inner',

    // Misc content blocks
    '.contact-form-wrap',
    '.contact-sidebar',
    '.signup-benefits-col',
    '.error-inner',
    '.map-placeholder',
  ];

  if (prefersReducedMotion()) {
    // Skip animation — just make everything visible immediately
    qsa(AUTO_REVEAL_SELECTORS.join(', ')).forEach(el => {
      el.classList.add(REVEALED_CLASS);
    });
    qsa('[data-reveal]').forEach(el => {
      el.classList.add(REVEALED_CLASS);
    });
    return;
  }

  // Collect all elements to observe
  const autoTargets   = qsa(AUTO_REVEAL_SELECTORS.join(', '));
  const manualTargets = qsa('[data-reveal]');

  // Merge, deduplicate
  const allTargets = [...new Set([...autoTargets, ...manualTargets])];

  if (allTargets.length === 0) return;

  // Mark as pending (CSS applies initial hidden state)
  allTargets.forEach(el => {
    if (!el.classList.contains(REVEALED_CLASS)) {
      el.classList.add(REVEAL_PENDING_CLASS);
    }
  });

  // Apply stagger delays to card-like elements within shared parents
  const cardSelectors = [
    '.feature-card',
    '.product-card',
    '.pricing-card',
    '.office-card',
    '.helpful-link-card',
    '.benefit-item',
    '.testimonial-card',
    '.blog-card',
    '.guide-card',
    '.value-card',
    '.achievement-card',
    '.team-card',
  ];
  const staggerTargets = allTargets.filter(el =>
    cardSelectors.some(sel => el.matches(sel))
  );
  applyStaggerDelays(staggerTargets);

  // Create observer
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      el.classList.remove(REVEAL_PENDING_CLASS);
      el.classList.add(REVEALED_CLASS);

      // Unobserve once revealed — animation runs only once
      observer.unobserve(el);
    });
  }, REVEAL_OBSERVER_OPTIONS);

  allTargets.forEach(el => observer.observe(el));
};

// ─── Module: CTA Section Reveal ──────────────────────────────

/**
 * Dedicated observer for full-width CTA band sections.
 * Uses a lower threshold so the reveal fires earlier, giving
 * the impression the section "rushes in" as you approach it.
 */
const initCtaReveal = () => {
  if (prefersReducedMotion()) return;

  const ctaSections = qsa('[id$="-cta"], .cta-band, .cta-section');
  if (ctaSections.length === 0) return;

  const ctaObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('cta--revealed');
      ctaObserver.unobserve(entry.target);
    });
  }, {
    root:       null,
    rootMargin: '0px 0px -40px 0px',
    threshold:  0.08,
  });

  ctaSections.forEach(section => {
    section.classList.add('cta--pending');
    ctaObserver.observe(section);
  });
};

// ─── Module: Navbar Scroll Progress (optional enhancement) ───

/**
 * Adds a thin scroll-progress indicator under the sticky nav.
 * Creates a <div role="progressbar"> and appends it to the header.
 * Width is driven by scroll percentage via a CSS custom property.
 *
 * Fully accessible: role="progressbar", aria-valuenow updates.
 */
const initScrollProgress = () => {
  if (prefersReducedMotion()) return;

  const header = document.querySelector('#site-header');
  if (!header) return;

  const bar = document.createElement('div');
  bar.className          = 'nav__scroll-progress';
  bar.setAttribute('role',          'progressbar');
  bar.setAttribute('aria-label',    'Page scroll progress');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', '0');

  header.appendChild(bar);

  const onScroll = () => {
    const scrollTop    = window.scrollY;
    const docHeight    = document.documentElement.scrollHeight - window.innerHeight;
    const progress     = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

    bar.style.setProperty('--scroll-progress', `${progress}%`);
    bar.setAttribute('aria-valuenow', String(progress));
  };

  window.addEventListener('scroll', onScroll, { passive: true });
};

// ─── Public Init ─────────────────────────────────────────────

/**
 * Initialises all animation sub-modules.
 * Called from main.js on DOMContentLoaded.
 */
const initAnimations = () => {
  initHeroAnimation();
  initScrollReveal();
  initCtaReveal();
  initScrollProgress();
};

export { initAnimations };