
'use strict';

// ─── Constants ───────────────────────────────────────────────

/** SessionStorage key for persisting the user's billing period choice */
const STORAGE_KEY_PERIOD = 'finpay_billing_period';

/** Valid billing period values */
const PERIOD = {
  MONTHLY : 'monthly',
  YEARLY  : 'yearly',
};

/** Class names — applied/removed by JS; styled entirely in CSS */
const CLASS = {
  TOGGLE_ACTIVE   : 'pricing-toggle__btn--active',
  CARD_ACTIVE     : 'pricing-card--active',
  CARD_RECOMMENDED: 'pricing-card--recommended',
  CARD_SELECTED   : 'pricing-card--selected',
  AMOUNT_ANIMATING: 'pricing-card__amount--animating',
  SAVINGS_VISIBLE : 'pricing-card__savings--visible',
  TABLE_COL_ACTIVE: 'pricing-table__col--active',
  PRICE_UPDATING  : 'pricing-card__price--updating',
};

/** Duration (ms) for the price flip animation */
const PRICE_FLIP_MS = 220;

/** Discount applied when switching to yearly billing (e.g. 0.20 = 20% off) */
const YEARLY_DISCOUNT = 0.20;

// ─── Utility ─────────────────────────────────────────────────

const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Safely reads a value from sessionStorage.
 * Returns null on any error (private browsing, storage disabled).
 * @param {string} key
 * @returns {string|null}
 */
const storageGet = (key) => {
  try { return sessionStorage.getItem(key); }
  catch { return null; }
};

/**
 * Safely writes a value to sessionStorage.
 * @param {string} key
 * @param {string} value
 */
const storageSet = (key, value) => {
  try { sessionStorage.setItem(key, value); }
  catch { /* storage disabled — silently ignore */ }
};

// ─── Price Data Helpers ───────────────────────────────────────

/**
 * Reads the monthly and yearly prices from a card's data attributes.
 * Falls back to 0 if the attributes are missing or non-numeric.
 *
 * @param {HTMLElement} card
 * @returns {{ monthly: number, yearly: number }}
 */
const getPricesFromCard = (card) => {
  const monthly = parseFloat(card.dataset.monthlyPrice ?? '0') || 0;
  const yearly  = parseFloat(card.dataset.yearlyPrice  ?? '0') || 0;

  // If no explicit yearly price, calculate from monthly with discount
  const resolvedYearly = yearly > 0
    ? yearly
    : parseFloat((monthly * (1 - YEARLY_DISCOUNT)).toFixed(2));

  return { monthly, yearly: resolvedYearly };
};

/**
 * Formats a numeric price for display.
 * Whole numbers show no decimal; others show two decimal places.
 *
 * @param {number} price
 * @returns {string}
 */
const formatPrice = (price) =>
  price % 1 === 0 ? String(price) : price.toFixed(2);

/**
 * Calculates the percentage saved when switching from monthly to yearly.
 * Returns a whole-number string like "20".
 *
 * @param {number} monthly
 * @param {number} yearly
 * @returns {string}
 */
const calcSavingsPercent = (monthly, yearly) => {
  if (monthly === 0 || yearly === 0) return '0';
  return Math.round(((monthly - yearly) / monthly) * 100).toString();
};

// ─── Price Animation ──────────────────────────────────────────

/**
 * Animates a price amount element from its current displayed value
 * to a new target value.
 *
 * Animation strategy:
 *  - Fade out + slight upward shift on exit
 *  - Update the text content mid-animation (when opacity ~ 0)
 *  - Fade in + settle from below on entrance
 *
 * CSS handles the visual transition via the AMOUNT_ANIMATING class.
 * When reduced-motion is preferred, the value updates instantly.
 *
 * @param {HTMLElement} amountEl  — the <span class="pricing-card__amount">
 * @param {string}      newValue  — formatted price string
 * @param {Function}    [onDone]  — optional callback after animation
 */
const animatePriceChange = (amountEl, newValue, onDone) => {
  if (!amountEl) return;

  if (prefersReducedMotion()) {
    amountEl.textContent = newValue;
    onDone?.();
    return;
  }

  // Phase 1 — exit: add animating class (CSS fades out)
  amountEl.classList.add(CLASS.AMOUNT_ANIMATING);
  amountEl.setAttribute('aria-hidden', 'true'); // hide from SR during flip

  setTimeout(() => {
    // Mid-point: update content while invisible
    amountEl.textContent = newValue;

    // Phase 2 — entrance: remove class (CSS fades in)
    amountEl.classList.remove(CLASS.AMOUNT_ANIMATING);
    amountEl.removeAttribute('aria-hidden');
    onDone?.();
  }, PRICE_FLIP_MS);
};

// ─── Module 1: Billing Period Toggle ─────────────────────────

/**
 * Initialises the monthly/yearly billing toggle.
 *
 * Responsibilities:
 *  - Reads persisted period from sessionStorage
 *  - Wires click and keyboard events to toggle buttons
 *  - Calls updateAllCards() when period changes
 *
 * @param {object} state - Shared mutable state object
 * @param {string} state.period - Current active period
 */
const initBillingToggle = (state) => {
  const toggleGroup = qs('.pricing-toggle, [data-pricing-toggle]');
  if (!toggleGroup) return;

  const buttons = qsa('.pricing-toggle__btn, [data-period]', toggleGroup);
  if (buttons.length === 0) return;

  // ARIA: mark the group as a toolbar / radio group
  if (!toggleGroup.hasAttribute('role')) {
    toggleGroup.setAttribute('role', 'group');
  }

  /**
   * Switches the active period and updates all UI.
   * @param {string} period — 'monthly' | 'yearly'
   */
  const switchPeriod = (period) => {
    if (period !== PERIOD.MONTHLY && period !== PERIOD.YEARLY) return;
    if (period === state.period) return;

    state.period = period;
    storageSet(STORAGE_KEY_PERIOD, period);

    // Update toggle button states
    buttons.forEach(btn => {
      const isActive = btn.dataset.period === period;
      btn.classList.toggle(CLASS.TOGGLE_ACTIVE, isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // Update all pricing cards
    updateAllCards(state.period);

    // Announce change to screen readers
    announceToScreenReader(
      `Billing switched to ${period === PERIOD.YEARLY ? 'yearly' : 'monthly'}.`
    );
  };

  // Click events
  buttons.forEach(btn => {
    btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
  });

  // Keyboard: Left/Right arrows navigate between toggle buttons
  toggleGroup.addEventListener('keydown', (e) => {
    const focused = document.activeElement;
    const index   = buttons.indexOf(focused);
    if (index === -1) return;

    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = (index + 1) % buttons.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = (index - 1 + buttons.length) % buttons.length;
    }

    if (next !== -1) {
      buttons[next].focus();
      switchPeriod(buttons[next].dataset.period);
    }
  });

  // Restore persisted period on load
  const saved = storageGet(STORAGE_KEY_PERIOD);
  if (saved && saved !== state.period) {
    switchPeriod(saved);
  } else {
    // Ensure initial button states match default period
    buttons.forEach(btn => {
      const isActive = btn.dataset.period === state.period;
      btn.classList.toggle(CLASS.TOGGLE_ACTIVE, isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }
};

// ─── Module 2: Card Price Updates ────────────────────────────

/**
 * Updates the displayed price, period label, and savings badge
 * on every pricing card when the billing period changes.
 *
 * @param {string} period — 'monthly' | 'yearly'
 */
const updateAllCards = (period) => {
  const cards = qsa('.pricing-card[data-plan]');
  if (cards.length === 0) return;

  cards.forEach(card => {
    const { monthly, yearly } = getPricesFromCard(card);
    const targetPrice = period === PERIOD.YEARLY ? yearly : monthly;
    const isYearly    = period === PERIOD.YEARLY;

    // ── Amount element ──────────────────────────────────────
    const amountEl = qs('.pricing-card__amount', card);
    if (amountEl) {
      // Add price-updating class to outer wrapper for CSS hook
      const priceWrap = qs('.pricing-card__price', card);
      priceWrap?.classList.add(CLASS.PRICE_UPDATING);

      animatePriceChange(amountEl, formatPrice(targetPrice), () => {
        priceWrap?.classList.remove(CLASS.PRICE_UPDATING);
      });
    }

    // ── Period label (e.g. "/month" or "/mo, billed yearly") ─
    const periodEl = qs('.pricing-card__period', card);
    if (periodEl) {
      periodEl.textContent = isYearly ? '/mo, billed yearly' : '/month';
    }

    // ── Savings badge ────────────────────────────────────────
    const savingsEl = qs('.pricing-card__savings', card);
    if (savingsEl && monthly > 0) {
      const pct = calcSavingsPercent(monthly, yearly);

      if (isYearly && Number(pct) > 0) {
        savingsEl.textContent = `Save ${pct}%`;
        savingsEl.hidden      = false;
        savingsEl.classList.add(CLASS.SAVINGS_VISIBLE);
      } else {
        savingsEl.hidden = true;
        savingsEl.classList.remove(CLASS.SAVINGS_VISIBLE);
      }
    }

    // ── Yearly total hint (optional element) ─────────────────
    const yearlyTotalEl = qs('.pricing-card__yearly-total', card);
    if (yearlyTotalEl) {
      if (isYearly && monthly > 0) {
        const annualTotal = formatPrice(yearly * 12);
        yearlyTotalEl.textContent = `$${annualTotal} billed annually`;
        yearlyTotalEl.hidden = false;
      } else {
        yearlyTotalEl.hidden = true;
      }
    }
  });
};

// ─── Module 3: Active Plan Highlighting ──────────────────────

/**
 * Manages the "recommended" plan highlighting and allows users
 * to manually select a plan card.
 *
 * Behaviour:
 *  - On load: the card with data-recommended="true" is marked active
 *  - On click: the clicked card becomes active
 *  - Syncs with the comparison table column highlights
 *
 * @param {object} state - Shared state object
 */
const initPlanHighlighting = (state) => {
  const cards = qsa('.pricing-card[data-plan]');
  if (cards.length === 0) return;

  /**
   * Activates a specific plan card and deactivates all others.
   * @param {HTMLElement} selectedCard
   */
  const activateCard = (selectedCard) => {
    state.activePlan = selectedCard.dataset.plan ?? null;

    cards.forEach(card => {
      const isActive = card === selectedCard;
      card.classList.toggle(CLASS.CARD_SELECTED, isActive);

      // Update CTA button label for clarity
      const cta = qs('.pricing-card__cta', card);
      if (cta) {
        cta.setAttribute('aria-pressed',
          card.dataset.recommended === 'true' ? undefined : String(isActive)
        );
      }
    });

    // Sync comparison table column
    syncTableColumn(state.activePlan);
  };

  // ── Mark recommended plan on load ────────────────────────
  const recommended = cards.find(c => c.dataset.recommended === 'true')
    ?? cards.find(c => c.classList.contains(CLASS.CARD_RECOMMENDED));

  if (recommended) {
    recommended.classList.add(CLASS.CARD_ACTIVE);
    state.activePlan = recommended.dataset.plan ?? null;
    syncTableColumn(state.activePlan);
  }

  // ── Click to select ──────────────────────────────────────
  cards.forEach(card => {
    // Make non-button card wrappers keyboard-focusable
    if (!card.hasAttribute('tabindex') && card.tagName !== 'BUTTON') {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(card === recommended));
    }

    card.addEventListener('click', (e) => {
      // Don't steal the click if it was on the CTA button itself
      if (e.target.closest('.pricing-card__cta')) return;
      activateCard(card);

      // Update aria-checked on all cards in the group
      cards.forEach(c => {
        c.setAttribute('aria-checked', String(c === card));
      });
    });

    // Keyboard: Enter or Space selects a card
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  // Arrow key navigation between plan cards
  const cardsContainer = cards[0]?.parentElement;
  cardsContainer?.addEventListener('keydown', (e) => {
    const focused = document.activeElement?.closest('.pricing-card');
    if (!focused) return;

    const index = cards.indexOf(focused);
    if (index === -1) return;

    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = (index + 1) % cards.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = (index - 1 + cards.length) % cards.length;
    }

    if (next !== -1) cards[next].focus();
  });
};

// ─── Module 4: Comparison Table Column Sync ──────────────────

/**
 * Highlights the column in the feature comparison table that
 * corresponds to the currently active plan.
 *
 * Expects table cells with data-plan attributes matching card plans.
 * e.g. <td data-plan="pro">
 *
 * @param {string|null} activePlan
 */
const syncTableColumn = (activePlan) => {
  if (!activePlan) return;

  const tableCells = qsa(
    '.pricing-table [data-plan], .comparison-table [data-plan]'
  );
  if (tableCells.length === 0) return;

  tableCells.forEach(cell => {
    const isActive = cell.dataset.plan === activePlan;
    cell.classList.toggle(CLASS.TABLE_COL_ACTIVE, isActive);
  });
};

// ─── Module 5: Sticky Comparison Table Header ─────────────────

/**
 * Makes the first row of the feature comparison table sticky
 * once it scrolls past the site header.
 *
 * Uses Intersection Observer on a sentinel element placed just
 * above the table — no scroll listener needed.
 */
const initStickyTableHeader = () => {
  const table = qs('.pricing-table, .comparison-table, #feature-comparison table');
  if (!table) return;

  const thead = qs('thead', table) ?? qs('tr:first-child', table);
  if (!thead) return;

  // Create sentinel div placed just above the table
  const sentinel = document.createElement('div');
  sentinel.className        = 'pricing-table__sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  table.parentNode?.insertBefore(sentinel, table);

  const siteHeader  = qs('#site-header');
  const headerHeight = siteHeader ? siteHeader.offsetHeight : 0;

  const observer = new IntersectionObserver(
    ([entry]) => {
      thead.classList.toggle('pricing-table__header--sticky', !entry.isIntersecting);
    },
    {
      root:       null,
      rootMargin: `-${headerHeight}px 0px 0px 0px`,
      threshold:  0,
    }
  );

  observer.observe(sentinel);
};

// ─── Module 6: Card Entrance Animations ──────────────────────

/**
 * Staggers the reveal animation of pricing cards as they enter
 * the viewport. Works alongside animations.js but is self-contained
 * so pricing.js can be used independently.
 */
const initCardAnimations = () => {
  if (prefersReducedMotion()) return;

  const cards = qsa('.pricing-card');
  if (cards.length === 0) return;

  // Apply stagger delays
  cards.forEach((card, i) => {
    card.style.setProperty('--card-delay', `${i * 100}ms`);
    card.classList.add('pricing-card--hidden');
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('pricing-card--hidden');
        entry.target.classList.add('pricing-card--revealed');
        observer.unobserve(entry.target);
      });
    },
    {
      root:       null,
      rootMargin: '0px 0px -40px 0px',
      threshold:  0.1,
    }
  );

  cards.forEach(card => observer.observe(card));
};

// ─── Accessibility: Live Region ───────────────────────────────

/**
 * Announces a message to screen readers via a polite live region.
 * Creates the region once and reuses it.
 *
 * @param {string} message
 */
const announceToScreenReader = (() => {
  let liveRegion = null;

  return (message) => {
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.className = 'sr-only pricing-live-region';
      liveRegion.setAttribute('aria-live',   'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
    }

    // Clear then set to guarantee announcement even if message repeats
    liveRegion.textContent = '';
    requestAnimationFrame(() => {
      liveRegion.textContent = message;
    });
  };
})();

// ─── Public Init ─────────────────────────────────────────────

/**
 * Initialises all pricing page modules.
 * Called from main.js when pricing.html is the current page,
 * or from the homepage if a pricing section / teaser is present.
 */
const initPricing = () => {
  // Guard: exit early if no pricing elements found
  const hasPricingCards  = qs('.pricing-card[data-plan]') !== null;
  const hasToggle        = qs('.pricing-toggle, [data-pricing-toggle]') !== null;

  if (!hasPricingCards && !hasToggle) return;

  // Shared state across all pricing sub-modules
  const state = {
    period     : PERIOD.MONTHLY, // current billing period
    activePlan : null,           // currently highlighted plan key
  };

  // Initialise sub-modules in dependency order
  initCardAnimations();       // 1. Animations first (sets hidden class before content shifts)
  initBillingToggle(state);   // 2. Toggle (reads persisted period, sets initial state)
  updateAllCards(state.period); // 3. Sync card prices to initial period
  initPlanHighlighting(state); // 4. Highlight recommended / selected plan
  initStickyTableHeader();    // 5. Sticky comparison table header
};

export { initPricing };