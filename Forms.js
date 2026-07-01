/**
 * forms.js — FinPay
 * ============================================================
 * Handles all form interactions across the site:
 *
 *  Contact form  (#contact-form)
 *   - Required field validation
 *   - Email format validation
 *   - Inline error messages
 *   - Submission state (loading / success / error)
 *
 *  Login form  (#login-form)
 *   - Email + password validation
 *   - Show / hide password toggle
 *   - Inline error messages
 *
 *  Signup form  (#signup-form)
 *   - Full field validation
 *   - Password strength meter
 *   - Confirm password match
 *   - Show / hide password (both fields)
 *   - Inline error messages
 *   - Terms checkbox enforcement
 *
 *  404 search form (#error-search-form)
 *   - Prevent empty submission
 *
 *  Newsletter form (.footer-newsletter)
 *   - Email validation
 *
 * Architecture:
 *  - Each form gets its own initialiser
 *  - Shared validators live in a pure-function layer
 *  - Inline errors are injected next to their fields (not modifying
 *    existing HTML — injected elements are created at runtime)
 *  - Validation fires on blur (field-level) and on submit (form-level)
 *  - No global state; each form closure is independent
 * ============================================================
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — UTILITY
// ═══════════════════════════════════════════════════════════════

const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/**
 * Retrieves a field's current trimmed value.
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} field
 * @returns {string}
 */
const val = (field) => (field?.value ?? '').trim();

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — PURE VALIDATORS
// Each returns { valid: boolean, message: string }
// ═══════════════════════════════════════════════════════════════

/**
 * Validates a required field has a non-empty value.
 * @param {string} value
 * @param {string} [label='This field']
 */
const validateRequired = (value, label = 'This field') => {
  if (!value) return { valid: false, message: `${label} is required.` };
  return { valid: true, message: '' };
};

/**
 * Validates an email address format.
 * Uses a pragmatic regex that covers the vast majority of real emails.
 * @param {string} value
 */
const validateEmail = (value) => {
  if (!value) return { valid: false, message: 'Email address is required.' };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(value)) return { valid: false, message: 'Please enter a valid email address.' };
  return { valid: true, message: '' };
};

/**
 * Validates password minimum requirements.
 * @param {string} value
 * @param {number} [minLength=8]
 */
const validatePassword = (value, minLength = 8) => {
  if (!value) return { valid: false, message: 'Password is required.' };
  if (value.length < minLength) {
    return { valid: false, message: `Password must be at least ${minLength} characters.` };
  }
  return { valid: true, message: '' };
};

/**
 * Validates that a confirmation value matches the original.
 * @param {string} value
 * @param {string} original
 */
const validatePasswordMatch = (value, original) => {
  if (!value) return { valid: false, message: 'Please confirm your password.' };
  if (value !== original) return { valid: false, message: 'Passwords do not match.' };
  return { valid: true, message: '' };
};

/**
 * Validates that a <select> element has a non-empty selected value.
 * @param {string} value
 * @param {string} [label='Please select an option']
 */
const validateSelect = (value, label = 'Please select an option.') => {
  if (!value) return { valid: false, message: label };
  return { valid: true, message: '' };
};

/**
 * Validates that a checkbox is checked.
 * @param {boolean} checked
 * @param {string}  [message]
 */
const validateCheckbox = (checked, message = 'You must accept this to continue.') => {
  if (!checked) return { valid: false, message };
  return { valid: true, message: '' };
};

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — INLINE ERROR DISPLAY
// ═══════════════════════════════════════════════════════════════

/**
 * Shows an inline error message beneath a field.
 * Creates a <span role="alert"> if one doesn't exist already.
 * Also marks the field as invalid via aria-invalid and aria-describedby.
 *
 * @param {HTMLElement} field
 * @param {string}      message
 */
const showError = (field, message) => {
  if (!field) return;

  field.setAttribute('aria-invalid', 'true');
  field.classList.add('field--error');

  // Locate or create error message element
  const errorId = `${field.id}-error`;
  let errorEl   = document.getElementById(errorId);

  if (!errorEl) {
    errorEl           = document.createElement('span');
    errorEl.id        = errorId;
    errorEl.className = 'field-error-msg';
    errorEl.setAttribute('role',      'alert');
    errorEl.setAttribute('aria-live', 'polite');

    // Insert after the field (or after its parent wrapper for checkboxes)
    const insertAfter = field.type === 'checkbox'
      ? field.closest('.form-group') ?? field
      : field;

    insertAfter.parentNode?.insertBefore(errorEl, insertAfter.nextSibling);
  }

  errorEl.textContent = message;

  // Link field to its error message
  const existing = field.getAttribute('aria-describedby') ?? '';
  if (!existing.includes(errorId)) {
    field.setAttribute('aria-describedby',
      [existing, errorId].filter(Boolean).join(' ')
    );
  }
};

/**
 * Clears the inline error state from a field.
 *
 * @param {HTMLElement} field
 */
const clearError = (field) => {
  if (!field) return;

  field.removeAttribute('aria-invalid');
  field.classList.remove('field--error');
  field.classList.add('field--valid');

  const errorId = `${field.id}-error`;
  const errorEl = document.getElementById(errorId);
  if (errorEl) errorEl.textContent = '';
};

/**
 * Clears valid/error styling without removing describedby linkage.
 * Used on first focus before any validation has run.
 * @param {HTMLElement} field
 */
const resetFieldState = (field) => {
  if (!field) return;
  field.removeAttribute('aria-invalid');
  field.classList.remove('field--error', 'field--valid');
};

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — PASSWORD UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Wires up a show/hide toggle button to a password field.
 * The toggle button must already exist in the HTML (per our structure:
 * a <button class="password-toggle"> sibling to the input).
 *
 * @param {HTMLInputElement} input   — the password input
 * @param {HTMLButtonElement} toggle — the toggle button
 */
const initPasswordToggle = (input, toggle) => {
  if (!input || !toggle) return;

  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    toggle.textContent          = isPassword ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label',   isPassword ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', String(isPassword));
  });
};

// ─── Password Strength Meter ──────────────────────────────────

/**
 * Calculates a password strength score from 0 (weakest) to 4 (strongest).
 *
 * Scoring criteria:
 *  +1  length >= 8
 *  +1  contains uppercase letter
 *  +1  contains number
 *  +1  contains special character
 *
 * @param {string} password
 * @returns {{ score: number, label: string }}
 */
const calcPasswordStrength = (password) => {
  let score = 0;
  if (password.length >= 8)            score++;
  if (/[A-Z]/.test(password))          score++;
  if (/[0-9]/.test(password))          score++;
  if (/[^A-Za-z0-9]/.test(password))   score++;

  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
};

/**
 * Creates and manages a visual password strength meter.
 * Injects a <div class="password-strength"> after the password field
 * if one doesn't already exist.
 *
 * @param {HTMLInputElement} input
 */
const initStrengthMeter = (input) => {
  if (!input) return;

  // Build meter DOM
  const meter = document.createElement('div');
  meter.className  = 'password-strength';
  meter.setAttribute('aria-live',   'polite');
  meter.setAttribute('aria-atomic', 'true');

  // Four strength bars
  const barsWrap = document.createElement('div');
  barsWrap.className = 'password-strength__bars';

  for (let i = 0; i < 4; i++) {
    const bar = document.createElement('span');
    bar.className = 'password-strength__bar';
    barsWrap.appendChild(bar);
  }

  // Label text
  const labelEl = document.createElement('span');
  labelEl.className = 'password-strength__label';
  labelEl.id        = `${input.id}-strength-label`;

  meter.appendChild(barsWrap);
  meter.appendChild(labelEl);

  // Insert after the input (or its toggle button if present)
  const toggle = input.nextElementSibling?.classList.contains('password-toggle')
    ? input.nextElementSibling
    : null;

  const insertAfter = toggle ?? input;
  insertAfter.parentNode?.insertBefore(meter, insertAfter.nextSibling);

  // Update meter on each keystroke
  input.addEventListener('input', () => {
    const { score, label } = calcPasswordStrength(input.value);
    const bars = qsa('.password-strength__bar', meter);

    bars.forEach((bar, i) => {
      bar.className = 'password-strength__bar';
      if (i < score) {
        const levelClass = ['', 'weak', 'fair', 'good', 'strong'][score];
        bar.classList.add(`password-strength__bar--${levelClass}`);
      }
    });

    labelEl.textContent = input.value.length > 0 ? label : '';

    // Update meter's accessible describedby on the input
    const existing = input.getAttribute('aria-describedby') ?? '';
    if (!existing.includes(labelEl.id)) {
      input.setAttribute('aria-describedby',
        [existing, labelEl.id].filter(Boolean).join(' ')
      );
    }
  });
};

// ═══════════════════════════════════════════════════════════════
// SECTION 5 — FORM STATUS MESSAGES
// ═══════════════════════════════════════════════════════════════

/**
 * Displays a form-level status message (success or error).
 * Injects a <div role="status"> above the submit button if one
 * doesn't already exist.
 *
 * @param {HTMLFormElement} form
 * @param {'success'|'error'} type
 * @param {string} message
 */
const showFormStatus = (form, type, message) => {
  const statusId = `${form.id}-status`;
  let statusEl   = document.getElementById(statusId);

  if (!statusEl) {
    statusEl           = document.createElement('div');
    statusEl.id        = statusId;
    statusEl.className = 'form-status';
    statusEl.setAttribute('role',      type === 'error' ? 'alert' : 'status');
    statusEl.setAttribute('aria-live', 'polite');

    const submitBtn = qs('[type="submit"]', form);
    submitBtn
      ? form.insertBefore(statusEl, submitBtn)
      : form.appendChild(statusEl);
  }

  statusEl.className   = `form-status form-status--${type}`;
  statusEl.textContent = message;
};

/** Clears any visible form status message. */
const clearFormStatus = (form) => {
  const statusEl = document.getElementById(`${form.id}-status`);
  if (statusEl) statusEl.textContent = '';
};

// ═══════════════════════════════════════════════════════════════
// SECTION 6 — CONTACT FORM
// ═══════════════════════════════════════════════════════════════

/**
 * Initialises the contact page form (#contact-form).
 * Validates: enquiry type, full name, email, message, privacy consent.
 */
const initContactForm = () => {
  const form = qs('#contact-form');
  if (!form) return;

  const fields = {
    enquiryType : qs('#enquiry-type',    form),
    name        : qs('#contact-name',    form),
    email       : qs('#contact-email',   form),
    message     : qs('#contact-message', form),
    privacy     : qs('#contact-privacy', form),
  };

  // ── Blur-time validation ─────────────────────────────────
  fields.enquiryType?.addEventListener('blur', () => {
    const r = validateSelect(val(fields.enquiryType), 'Please select an enquiry type.');
    r.valid ? clearError(fields.enquiryType) : showError(fields.enquiryType, r.message);
  });

  fields.name?.addEventListener('blur', () => {
    const r = validateRequired(val(fields.name), 'Full name');
    r.valid ? clearError(fields.name) : showError(fields.name, r.message);
  });

  fields.email?.addEventListener('blur', () => {
    const r = validateEmail(val(fields.email));
    r.valid ? clearError(fields.email) : showError(fields.email, r.message);
  });

  fields.message?.addEventListener('blur', () => {
    const r = validateRequired(val(fields.message), 'Message');
    r.valid ? clearError(fields.message) : showError(fields.message, r.message);
  });

  // ── Clear error on focus / input ─────────────────────────
  Object.values(fields).forEach(field => {
    if (!field) return;
    field.addEventListener('focus', () => resetFieldState(field));
    field.addEventListener('input', () => {
      if (field.classList.contains('field--error')) resetFieldState(field);
    });
  });

  // ── Submit ────────────────────────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearFormStatus(form);

    const results = [
      { field: fields.enquiryType, result: validateSelect(val(fields.enquiryType), 'Please select an enquiry type.') },
      { field: fields.name,        result: validateRequired(val(fields.name), 'Full name')                           },
      { field: fields.email,       result: validateEmail(val(fields.email))                                          },
      { field: fields.message,     result: validateRequired(val(fields.message), 'Message')                          },
      { field: fields.privacy,     result: validateCheckbox(fields.privacy?.checked, 'You must accept the privacy policy.') },
    ];

    let firstInvalid = null;
    let allValid     = true;

    results.forEach(({ field, result }) => {
      if (!field) return;
      if (result.valid) {
        clearError(field);
      } else {
        showError(field, result.message);
        if (!firstInvalid) firstInvalid = field;
        allValid = false;
      }
    });

    if (!allValid) {
      firstInvalid?.focus();
      showFormStatus(form, 'error', 'Please correct the errors above before submitting.');
      return;
    }

    // ── Simulate submission (replace with real fetch in production) ──
    submitForm(form);
  });
};




// ═══════════════════════════════════════════════════════════════
// SECTION 9 — NEWSLETTER FORMS
// ═══════════════════════════════════════════════════════════════

/**
 * Initialises all newsletter sign-up forms (.footer-newsletter).
 * Validates email and shows inline feedback.
 */
const initNewsletterForms = () => {
  const forms = qsa('.footer-newsletter');

  forms.forEach(form => {
    const emailField = qs('input[type="email"]', form);
    if (!emailField) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = validateEmail(val(emailField));

      if (!r.valid) {
        showError(emailField, r.message);
        emailField.focus();
        return;
      }

      clearError(emailField);
      showFormStatus(form, 'success', 'Thanks for subscribing!');
      emailField.value = '';
    });

    emailField.addEventListener('input', () => {
      if (emailField.classList.contains('field--error')) resetFieldState(emailField);
    });
  });
};

// ═══════════════════════════════════════════════════════════════
// SECTION 10 — 404 SEARCH FORM
// ═══════════════════════════════════════════════════════════════

/**
 * Prevents the 404-page search form from submitting with an empty query.
 */
const initSearchForm = () => {
  const form  = qs('#error-search-form');
  const input = qs('#error-search-input', form ?? document);
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    const r = validateRequired(val(input), 'Search query');
    if (!r.valid) {
      e.preventDefault();
      showError(input, 'Please enter a search term.');
      input.focus();
    }
  });

  input.addEventListener('input', () => resetFieldState(input));
};

// ═══════════════════════════════════════════════════════════════
// SECTION 11 — SUBMIT SIMULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Simulates async form submission with loading / success / error states.
 * Replace the setTimeout with a real fetch() call in production.
 *
 * @param {HTMLFormElement} form
 */
const submitForm = (form) => {
  const submitBtn = qs('[type="submit"]', form);
  const originalLabel = submitBtn?.textContent ?? 'Submit';

  // ── Loading state ─────────────────────────────────────────
  if (submitBtn) {
    submitBtn.disabled     = true;
    submitBtn.textContent  = 'Sending…';
    submitBtn.setAttribute('aria-busy', 'true');
  }

  showFormStatus(form, 'success', '');

  // ── Simulate network request ──────────────────────────────
  setTimeout(() => {
    // Restore button
    if (submitBtn) {
      submitBtn.disabled    = false;
      submitBtn.textContent = originalLabel;
      submitBtn.removeAttribute('aria-busy');
    }

    // 90% success simulation (swap for real response handling)
    const success = Math.random() > 0.1;

    if (success) {
      showFormStatus(form, 'success',
        'Your message has been sent. We\'ll be in touch within one business day.'
      );
      form.reset();

      // Clear all field state classes after reset
      qsa('.field--valid, .field--error', form).forEach(el => {
        el.classList.remove('field--valid', 'field--error');
      });

    } else {
      showFormStatus(form, 'error',
        'Something went wrong. Please try again or email us at support@finpay.io.'
      );
    }
  }, 1500);
};

// ═══════════════════════════════════════════════════════════════
// SECTION 12 — PUBLIC INIT
// ═══════════════════════════════════════════════════════════════

/**
 * Initialises all form modules present on the current page.
 * Accepts an optional config object from main.js to restrict
 * which forms are initialised (avoids unnecessary DOM queries).
 *
 * @param {{ page?: string }} [config={}]
 */
const initForms = (config = {}) => {
  const { page } = config;

  // Always init newsletter and search (global)
  initNewsletterForms();
  initSearchForm();

  // Page-specific forms
  switch (page) {
    case 'contact':
      initContactForm();
      break;
    case 'login':
      initLoginForm();
      break;
    case 'signup':
      initSignupForm();
      break;
    case '404':
      // search form already handled above
      break;
    default:
      // Fallback: init all forms if page context is unknown
      initContactForm();
      initLoginForm();
      initSignupForm();
      break;
  }
};

export { initForms };