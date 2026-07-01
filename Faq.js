/**
 * faq.js — FinPay
 * ============================================================
 * Accessible FAQ accordion.
 *  - Only one item open at a time (per accordion group)
 *  - Smooth open / close via measured height animation
 *  - Full keyboard support: Enter, Space, Arrow keys, Home, End
 *  - ARIA: aria-expanded, aria-controls, role="region"
 *  - Respects prefers-reduced-motion
 *  - Works with multiple independent accordion groups on one page
 *  - Zero dependencies, no HTML modifications
 * ============================================================
 *
 * Expected HTML structure (from contact.html, pricing.html, etc.):
 *
 *   <dl class="faq-list">
 *     <div class="faq-item">
 *       <dt>
 *         <button type="button"
 *                 aria-expanded="false"
 *                 aria-controls="faq-answer-1"
 *                 id="faq-question-1">
 *           Question text
 *         </button>
 *       </dt>
 *       <dd id="faq-answer-1"
 *           role="region"
 *           aria-labelledby="faq-question-1"
 *           hidden>
 *         Answer text
 *       </dd>
 *     </div>
 *   </dl>
 *
 * The module reads the existing aria-controls / aria-expanded
 * attributes already present in the HTML — no attribute injection
 * needed beyond what's already in the markup.
 * ============================================================
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────

/** Class added to an open faq-item wrapper */
const ITEM_OPEN_CLASS = 'faq-item--open';

/** Class added to the answer panel during height animation */
const PANEL_ANIMATING_CLASS = 'faq-panel--animating';

/** Transition duration in ms — should match CSS if a CSS transition is used */
const TRANSITION_MS = 300;

// ─── Utility ─────────────────────────────────────────────────

const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Animation helpers ────────────────────────────────────────

/**
 * Animates a panel element from 0 to its natural scrollHeight.
 * Uses requestAnimationFrame so the browser paints every frame.
 *
 * @param {HTMLElement} panel
 * @param {Function}    [onComplete]
 */
const expandPanel = (panel, onComplete) => {
  if (prefersReducedMotion()) {
    panel.hidden = false;
    panel.style.height = '';
    onComplete?.();
    return;
  }

  // Reveal first so scrollHeight is measurable, but keep it collapsed
  panel.hidden = false;
  panel.style.overflow = 'hidden';
  panel.style.height   = '0px';
  panel.classList.add(PANEL_ANIMATING_CLASS);

  const targetHeight = panel.scrollHeight;

  // Force reflow so the browser registers height: 0 before animating
  panel.getBoundingClientRect();

  panel.style.transition = `height ${TRANSITION_MS}ms ease`;
  panel.style.height     = `${targetHeight}px`;

  const onTransitionEnd = () => {
    panel.removeEventListener('transitionend', onTransitionEnd);
    panel.classList.remove(PANEL_ANIMATING_CLASS);
    // Let CSS take over — remove inline styles so content reflow works
    panel.style.height     = '';
    panel.style.overflow   = '';
    panel.style.transition = '';
    onComplete?.();
  };

  panel.addEventListener('transitionend', onTransitionEnd);
};

/**
 * Animates a panel element from its current height to 0, then hides it.
 *
 * @param {HTMLElement} panel
 * @param {Function}    [onComplete]
 */
const collapsePanel = (panel, onComplete) => {
  if (prefersReducedMotion()) {
    panel.hidden = true;
    panel.style.height = '';
    onComplete?.();
    return;
  }

  const currentHeight = panel.scrollHeight;

  panel.style.overflow   = 'hidden';
  panel.style.height     = `${currentHeight}px`;
  panel.style.transition = `height ${TRANSITION_MS}ms ease`;
  panel.classList.add(PANEL_ANIMATING_CLASS);

  // Force reflow
  panel.getBoundingClientRect();

  panel.style.height = '0px';

  const onTransitionEnd = () => {
    panel.removeEventListener('transitionend', onTransitionEnd);
    panel.classList.remove(PANEL_ANIMATING_CLASS);
    panel.hidden       = true;
    panel.style.height     = '';
    panel.style.overflow   = '';
    panel.style.transition = '';
    onComplete?.();
  };

  panel.addEventListener('transitionend', onTransitionEnd);
};

// ─── Core Accordion Logic ─────────────────────────────────────

/**
 * Represents a single accordion group (one <dl class="faq-list">).
 * Manages open/close state and keyboard navigation for all its items.
 *
 * @param {HTMLElement} listEl — the <dl> or container element
 */
const createAccordionGroup = (listEl) => {
  // Collect all trigger buttons within this group
  const triggers = qsa('dt button[aria-controls], dt button[aria-expanded]', listEl);
  if (triggers.length === 0) return;

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Resolves the answer panel for a given trigger button.
   * Uses aria-controls first, falls back to next sibling <dd>.
   * @param {HTMLElement} trigger
   * @returns {HTMLElement|null}
   */
  const getPanelFor = (trigger) => {
    const controlsId = trigger.getAttribute('aria-controls');
    if (controlsId) return document.getElementById(controlsId);
    // Fallback: look for sibling <dd>
    const dt = trigger.closest('dt');
    return dt?.nextElementSibling ?? null;
  };

  /**
   * Returns the .faq-item wrapper for a trigger.
   * @param {HTMLElement} trigger
   * @returns {HTMLElement|null}
   */
  const getItemFor = (trigger) =>
    trigger.closest('.faq-item') ?? trigger.closest('div');

  /** Returns true if the trigger's panel is currently open */
  const isOpen = (trigger) =>
    trigger.getAttribute('aria-expanded') === 'true';

  // ── Open / Close ───────────────────────────────────────────

  /**
   * Opens the panel for the given trigger.
   * Closes all other open panels in the same group first.
   * @param {HTMLElement} trigger
   */
  const openItem = (trigger) => {
    const panel = getPanelFor(trigger);
    const item  = getItemFor(trigger);
    if (!panel) return;

    // Close any currently open item in this group
    triggers.forEach(t => {
      if (t !== trigger && isOpen(t)) closeItem(t);
    });

    trigger.setAttribute('aria-expanded', 'true');
    item?.classList.add(ITEM_OPEN_CLASS);
    expandPanel(panel);
  };

  /**
   * Closes the panel for the given trigger.
   * @param {HTMLElement} trigger
   */
  const closeItem = (trigger) => {
    const panel = getPanelFor(trigger);
    const item  = getItemFor(trigger);
    if (!panel) return;

    trigger.setAttribute('aria-expanded', 'false');
    item?.classList.remove(ITEM_OPEN_CLASS);
    collapsePanel(panel);
  };

  /** Toggles a trigger's panel open or closed */
  const toggleItem = (trigger) => {
    isOpen(trigger) ? closeItem(trigger) : openItem(trigger);
  };

  // ── Event: Click ──────────────────────────────────────────
  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => toggleItem(trigger));
  });

  // ── Event: Keyboard (Arrow, Home, End) ────────────────────
  // ARIA Authoring Practices Guide pattern for accordion:
  // https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
  listEl.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const index  = triggers.indexOf(active);
    if (index === -1) return; // focus not on a trigger

    let next = -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        next = (index + 1) % triggers.length;
        break;
      case 'ArrowUp':
        e.preventDefault();
        next = (index - 1 + triggers.length) % triggers.length;
        break;
      case 'Home':
        e.preventDefault();
        next = 0;
        break;
      case 'End':
        e.preventDefault();
        next = triggers.length - 1;
        break;
      default:
        return;
    }

    triggers[next]?.focus();
  });

  // ── Initial state: ensure all panels match aria-expanded ──
  // The HTML may have some panels open by default — honour that.
  triggers.forEach(trigger => {
    const panel = getPanelFor(trigger);
    if (!panel) return;

    if (isOpen(trigger)) {
      panel.hidden = false;
    } else {
      // Ensure hidden attribute is set (HTML may omit it on closed items)
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
};

// ─── Public Init ─────────────────────────────────────────────

/**
 * Finds all FAQ list containers and initialises an independent
 * accordion group for each. Supports multiple FAQ sections per page.
 *
 * Selector covers:
 *  .faq-list       — standard class used across all pages
 *  [data-faq]      — opt-in attribute variant
 *  .accordion      — generic accordion class
 */
const initFaq = () => {
  const groups = Array.from(
    document.querySelectorAll('.faq-list, [data-faq], .accordion')
  );

  if (groups.length === 0) return;

  groups.forEach(group => {
    try {
      createAccordionGroup(group);
    } catch (err) {
      console.warn('[FinPay FAQ] Failed to initialise accordion group:', err);
    }
  });
};


export { initFaq };