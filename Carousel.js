

'use strict';

// ─── Constants ───────────────────────────────────────────────

/** Auto-play interval in milliseconds */
const AUTOPLAY_INTERVAL_MS = 5000;

/** CSS transition duration — must match CSS transition value */
const TRANSITION_DURATION_MS = 400;

/** Minimum swipe distance (px) to register as intentional */
const SWIPE_THRESHOLD_PX = 50;

// ─── Utility ─────────────────────────────────────────────────

const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Wraps a flat list of card elements into carousel track + slide divs
 * so the module works even if the HTML wasn't pre-structured.
 *
 * @param {Element}   container  - The .carousel wrapper element
 * @param {Element[]} cards      - Existing card elements to wrap
 */
const buildCarouselDOM = (container, cards) => {
  // Create track
  const track = document.createElement('div');
  track.className = 'carousel__track';

  cards.forEach((card, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel__slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `Slide ${i + 1} of ${cards.length}`);

    // Move card into slide
    card.parentElement?.removeChild(card);
    slide.appendChild(card);
    track.appendChild(slide);
  });

  container.appendChild(track);
};

/**
 * Creates the carousel controls (prev/next buttons + dots)
 * and appends them to the carousel container.
 *
 * @param {Element} container
 * @param {number}  slideCount
 * @returns {{ prevBtn: Element, nextBtn: Element, dotsContainer: Element }}
 */
const buildCarouselControls = (container, slideCount) => {
  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.type      = 'button';
  prevBtn.className = 'carousel__btn carousel__btn--prev';
  prevBtn.setAttribute('aria-label', 'Previous slide');
  prevBtn.innerHTML = '<span aria-hidden="true">&#8592;</span>';

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.type      = 'button';
  nextBtn.className = 'carousel__btn carousel__btn--next';
  nextBtn.setAttribute('aria-label', 'Next slide');
  nextBtn.innerHTML = '<span aria-hidden="true">&#8594;</span>';

  // Dots container
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'carousel__dots';
  dotsContainer.setAttribute('role',       'tablist');
  dotsContainer.setAttribute('aria-label', 'Select slide');

  for (let i = 0; i < slideCount; i++) {
    const dot = document.createElement('button');
    dot.type      = 'button';
    dot.className = 'carousel__dot';
    dot.setAttribute('role',       'tab');
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.setAttribute('data-index',    String(i));
    if (i !== 0) dot.setAttribute('tabindex', '-1');
    dotsContainer.appendChild(dot);
  }

  // Controls wrapper
  const controls = document.createElement('div');
  controls.className = 'carousel__controls';
  controls.setAttribute('aria-label', 'Carousel controls');
  controls.appendChild(prevBtn);
  controls.appendChild(dotsContainer);
  controls.appendChild(nextBtn);

  container.appendChild(controls);

  return { prevBtn, nextBtn, dotsContainer };
};

// ─── Core Carousel Instance ───────────────────────────────────

/**
 * Creates and manages a single carousel instance.
 * @param {Element} container - The .carousel element
 */
const createCarousel = (container) => {
  // ── Locate or build track & slides ───────────────────────
  let track  = qs('.carousel__track', container);
  let slides = qsa('.carousel__slide', container);

  // Auto-wrap if no track structure exists
  if (!track || slides.length === 0) {
    const cards = qsa(
      '.testimonial-card, .carousel__item, [data-carousel-slide]',
      container
    );
    if (cards.length === 0) return; // nothing to carousel-ify
    buildCarouselDOM(container, cards);
    track  = qs('.carousel__track', container);
    slides = qsa('.carousel__slide', container);
  }

  const total   = slides.length;
  if (total <= 1) return; // single slide — nothing to do

  // ── ARIA setup on container ───────────────────────────────
  if (!container.hasAttribute('aria-roledescription')) {
    container.setAttribute('aria-roledescription', 'carousel');
  }

  // Live region announces slide changes to screen readers
  const liveRegion = document.createElement('div');
  liveRegion.className         = 'carousel__live-region sr-only';
  liveRegion.setAttribute('aria-live',    'polite');
  liveRegion.setAttribute('aria-atomic',  'true');
  container.appendChild(liveRegion);

  // ── Build controls ────────────────────────────────────────
  const { prevBtn, nextBtn, dotsContainer } = buildCarouselControls(container, total);
  const dots = qsa('.carousel__dot', dotsContainer);

  // ── State ────────────────────────────────────────────────
  let currentIndex  = 0;
  let autoPlayTimer = null;
  let isTransitioning = false;
  const reduced     = prefersReducedMotion();

  // ── Helpers ───────────────────────────────────────────────

  /** Updates slide visibility, ARIA states, and dot indicators */
  const updateUI = (index) => {
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.setAttribute('aria-hidden', String(!active));
      slide.classList.toggle('carousel__slide--active', active);
      // Prevent tab-focus into hidden slides
      qsa('a, button, input, [tabindex]', slide).forEach(el => {
        el.setAttribute('tabindex', active ? '0' : '-1');
      });
    });

    dots.forEach((dot, i) => {
      const active = i === index;
      dot.setAttribute('aria-selected', String(active));
      dot.setAttribute('tabindex',      active ? '0' : '-1');
      dot.classList.toggle('carousel__dot--active', active);
    });

    // Announce to screen readers
    liveRegion.textContent = `Slide ${index + 1} of ${total}`;

    // Update prev/next disabled state at boundaries (non-infinite feel optional)
    prevBtn.setAttribute('aria-disabled', index === 0 ? 'true' : 'false');
    nextBtn.setAttribute('aria-disabled', index === total - 1 ? 'true' : 'false');
  };

  /** Moves to a specific slide index with optional animation */
  const goTo = (index, animate = !reduced) => {
    if (isTransitioning && animate) return;

    // Wrap index for infinite looping
    const next = ((index % total) + total) % total;

    if (next === currentIndex) return;

    if (animate) {
      isTransitioning = true;
      track.classList.add('carousel__track--animating');

      // Determine direction for slide-in / slide-out CSS classes
      const direction = next > currentIndex ? 'next' : 'prev';
      slides[currentIndex].classList.add(`carousel__slide--exit-${direction}`);
      slides[next].classList.add(`carousel__slide--enter-${direction}`);

      // After transition completes, clean up classes
      setTimeout(() => {
        slides[currentIndex].classList.remove(
          `carousel__slide--exit-${direction}`,
          'carousel__slide--active'
        );
        slides[next].classList.remove(`carousel__slide--enter-${direction}`);
        track.classList.remove('carousel__track--animating');
        isTransitioning = false;
      }, TRANSITION_DURATION_MS);
    }

    currentIndex = next;
    updateUI(currentIndex);
  };

  const goNext = () => goTo(currentIndex + 1);
  const goPrev = () => goTo(currentIndex - 1);

  // ── Auto-play ─────────────────────────────────────────────

  const startAutoPlay = () => {
    if (reduced) return;
    stopAutoPlay();
    autoPlayTimer = setInterval(goNext, AUTOPLAY_INTERVAL_MS);
  };

  const stopAutoPlay = () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  };

  // Pause on hover
  container.addEventListener('mouseenter', stopAutoPlay);
  container.addEventListener('mouseleave', startAutoPlay);

  // Pause when any element inside receives focus
  container.addEventListener('focusin',  stopAutoPlay);
  container.addEventListener('focusout', (e) => {
    if (!container.contains(e.relatedTarget)) startAutoPlay();
  });

  // ── Button events ─────────────────────────────────────────
  nextBtn.addEventListener('click', () => { stopAutoPlay(); goNext(); startAutoPlay(); });
  prevBtn.addEventListener('click', () => { stopAutoPlay(); goPrev(); startAutoPlay(); });

  // ── Dot events ────────────────────────────────────────────
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      stopAutoPlay();
      goTo(i);
      startAutoPlay();
    });
  });

  // Roving tabindex on dots (arrow key navigation within dot group)
  dotsContainer.addEventListener('keydown', (e) => {
    let next = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = (currentIndex + 1) % total;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = (currentIndex - 1 + total) % total;
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = total - 1;
    } else {
      return;
    }
    stopAutoPlay();
    goTo(next);
    dots[next]?.focus();
    startAutoPlay();
  });

  // ── Keyboard navigation on carousel itself ────────────────
  container.addEventListener('keydown', (e) => {
    if (e.target.closest('.carousel__dots')) return; // handled above
    if (e.key === 'ArrowRight') { e.preventDefault(); stopAutoPlay(); goNext(); startAutoPlay(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); stopAutoPlay(); goPrev(); startAutoPlay(); }
  });

  // ── Touch / Pointer swipe ─────────────────────────────────
  let pointerStartX = null;
  let pointerStartY = null;

  container.addEventListener('pointerdown', (e) => {
    // Only track primary pointer (ignore multi-touch)
    if (!e.isPrimary) return;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
  }, { passive: true });

  container.addEventListener('pointerup', (e) => {
    if (!e.isPrimary || pointerStartX === null) return;

    const deltaX = e.clientX - pointerStartX;
    const deltaY = e.clientY - pointerStartY;

    // Ignore if vertical swipe dominates (user is scrolling)
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      pointerStartX = null;
      return;
    }

    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
      stopAutoPlay();
      deltaX < 0 ? goNext() : goPrev();
      startAutoPlay();
    }

    pointerStartX = null;
    pointerStartY = null;
  }, { passive: true });

  // ── Initial state ─────────────────────────────────────────
  updateUI(0);
  startAutoPlay();
};

// ─── Public Init ─────────────────────────────────────────────

/**
 * Finds all .carousel containers on the page and initialises
 * an independent carousel instance for each one.
 * Called from main.js on DOMContentLoaded.
 */
const initCarousels = () => {
  // Primary carousel containers
  const containers = qsa('.carousel, [data-carousel], #testimonials .carousel-wrap');

  // Also check for bare testimonial grids that haven't been wrapped yet
  const testimonialSections = qsa('#testimonials, [id$="-testimonials"]');
  testimonialSections.forEach(section => {
    const cards = qsa('.testimonial-card', section);
    if (cards.length > 1 && !qs('.carousel', section)) {
      // Wrap the section's inner content in a .carousel div
      const wrapper = document.createElement('div');
      wrapper.className = 'carousel';
      wrapper.setAttribute('aria-label', 'Customer testimonials');
      const inner = qs('.section-inner', section) || section;
      // Move cards into wrapper
      cards.forEach(card => wrapper.appendChild(card));
      inner.appendChild(wrapper);
      containers.push(wrapper);
    }
  });

  // Deduplicate
  const unique = [...new Set(containers)];
  unique.forEach(container => {
    try {
      createCarousel(container);
    } catch (err) {
      console.warn('[FinPay Carousel] Failed to initialise carousel:', err);
    }
  });
};

export { initCarousels };