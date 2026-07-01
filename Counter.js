/**
 * counter.js — FinPay
 * ============================================================
 * Animated statistics counters.
 *  - Triggered once via Intersection Observer
 *  - Eased counting animation (ease-out cubic)
 *  - Supports integers, decimals, and suffixed values (K, M, B, +, %)
 *  - Respects prefers-reduced-motion
 *  - Zero dependencies
 * ============================================================
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────

/** Duration of the count animation in milliseconds */
const ANIMATION_DURATION_MS = 2000;

/** Intersection threshold — element must be 20% visible to trigger */
const TRIGGER_THRESHOLD = 0.2;


const COUNTER_SELECTORS = [
  '[data-counter]',         // explicit opt-in
  '.stat-number',           // stats section
  '.proof-stat dd',         // signup page proof stats
  '.hero-stat-value',       // hero inline stats
].join(', ');

// ─── Utility ─────────────────────────────────────────────────

/**
 * Cubic ease-out easing function.
 * Returns a value between 0 and 1 given a progress ratio 0–1.
 * @param {number} t - Progress ratio (0 to 1)
 * @returns {number}
 */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Safely queries all matching elements as an Array.
 * @param {string} selector
 * @param {Document|Element} [ctx=document]
 * @returns {Element[]}
 */
const qsa = (selector, ctx = document) => {
  try {
    return Array.from(ctx.querySelectorAll(selector));
  } catch {
    return [];
  }
};

/**
 * Parses a raw text string like "$18B+", "500,000+", "99.9%"
 * into structured counter metadata.
 *
 * @param {string} raw - Raw text content of the element
 * @returns {{
 *   target: number,
 *   prefix: string,
 *   suffix: string,
 *   decimals: number,
 *   useCommas: boolean
 * }}
 */
const parseCounterValue = (raw) => {
  const text = raw.trim();

  // Extract optional leading prefix ($, €, £)
  const prefixMatch = text.match(/^([£$€¥₹])/);
  const prefix = prefixMatch ? prefixMatch[1] : '';

  // Extract optional trailing suffix (B, M, K, %, +, x)
  const suffixMatch = text.match(/([BbMmKk%+x]+)$/);
  const rawSuffix   = suffixMatch ? suffixMatch[1] : '';

  // Normalise suffix for readability
  const suffix = rawSuffix
    .replace(/b/i, 'B')
    .replace(/m/i, 'M')
    .replace(/k/i, 'K');

  // Strip everything except digits and decimal point
  const numeric = text.replace(/[^0-9.]/g, '');
  const target  = parseFloat(numeric) || 0;

  // Detect decimal places from original string
  const decimalMatch = numeric.match(/\.(\d+)/);
  const decimals     = decimalMatch ? decimalMatch[1].length : 0;

  // Use comma formatting if original value was >= 1000 or had commas
  const useCommas = target >= 1000 || /,/.test(text);

  return { target, prefix, suffix, decimals, useCommas };
};

/**
 * Formats a numeric value back into a display string.
 * @param {number} value
 * @param {object} meta - Result of parseCounterValue
 * @returns {string}
 */
const formatValue = (value, { prefix, suffix, decimals, useCommas }) => {
  let formatted = value.toFixed(decimals);

  if (useCommas) {
    // Insert commas for thousands
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = parts.join('.');
  }

  return `${prefix}${formatted}${suffix}`;
};

// ─── Core Animation ──────────────────────────────────────────

/**
 * Animates a single counter element from 0 to its target value.
 * Uses requestAnimationFrame for smooth rendering.
 *
 * @param {Element} el    - The DOM element to animate
 * @param {object}  meta  - Parsed counter metadata
 */
const animateCounter = (el, meta) => {
  const { target } = meta;
  const startTime  = performance.now();

  const tick = (now) => {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
    const eased    = easeOutCubic(progress);
    const current  = eased * target;

    el.textContent = formatValue(current, meta);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Ensure exact final value is rendered (no floating-point drift)
      el.textContent = formatValue(target, meta);
    }
  };

  requestAnimationFrame(tick);
};

// ─── Module: Init Counters ────────────────────────────────────

/**
 * Finds all counter elements, stores their original text as
 * data-counter-target (preserving suffix/prefix), then resets
 * their visible text to "0" and sets up an Intersection Observer
 * to trigger the animation once when they enter the viewport.
 *
 * If prefers-reduced-motion is set, numbers are revealed instantly
 * with no animation.
 */
const initCounters = () => {
  const elements = qsa(COUNTER_SELECTORS);
  if (elements.length === 0) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Prepare each element
  const prepared = elements.map(el => {
    // Allow explicit override via data-counter="500,000+"
    const raw  = el.getAttribute('data-counter') || el.textContent;
    const meta = parseCounterValue(raw);

    if (meta.target === 0) return null; // skip non-numeric elements

    // Store original text so we can restore it if needed
    el.setAttribute('data-counter-original', el.textContent.trim());

    if (reduced) {
      // No animation — just display the final value
      el.textContent = formatValue(meta.target, meta);
      return null;
    }

    // Reset visible text to prefix + "0" + suffix so there's no pop
    el.textContent = formatValue(0, meta);

    return { el, meta };
  }).filter(Boolean);

  if (prepared.length === 0 || reduced) return;

  // Observe each counter element
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const found = prepared.find(item => item.el === entry.target);
      if (!found) return;

      animateCounter(found.el, found.meta);

      // Run only once — unobserve immediately after triggering
      observer.unobserve(entry.target);
    });
  }, {
    root:       null,
    rootMargin: '0px',
    threshold:  TRIGGER_THRESHOLD,
  });

  prepared.forEach(({ el }) => observer.observe(el));
};

export { initCounters };