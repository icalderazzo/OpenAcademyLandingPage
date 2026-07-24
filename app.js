/* OpenAcademy landing page — interactions.
   Plain rewrite of the former dc-runtime `enhance()` logic:
   scroll-reveal, demo-form validation, and the brand-color preview. */
(function () {
  'use strict';

  var LEADS_ENDPOINT = 'https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-ffb4ea1b-64d0-477c-9978-41ac17f8adeb/leads/submit';

  function initReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  function initDemoForm() {
    var form = document.getElementById('demo-form');
    if (!form) return;
    var success = document.getElementById('demo-success');
    var rules = [
      { id: 'academy', test: function (v) { return v.trim().length > 0; } },
      { id: 'name', test: function (v) { return v.trim().length > 0; } },
      { id: 'email', test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); } }
    ];

    function setError(id, show) {
      var input = document.getElementById(id);
      var error = document.getElementById(id + '-error');
      if (show) { input.setAttribute('aria-invalid', 'true'); if (error) error.hidden = false; }
      else { input.removeAttribute('aria-invalid'); if (error) error.hidden = true; }
    }

    rules.forEach(function (rule) {
      var input = document.getElementById(rule.id);
      if (!input) return;
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true' && rule.test(input.value)) setError(rule.id, false);
      });
    });

    var turnstileError = document.getElementById('turnstile-error');
    var formError = document.getElementById('form-error');
    var submitButton = form.querySelector('button[type="submit"]');
    var submitLabel = submitButton ? submitButton.textContent : '';
    var submitting = false;

    function turnstileToken() {
      return (window.turnstile && typeof window.turnstile.getResponse === 'function')
        ? (window.turnstile.getResponse() || '')
        : '';
    }
    function resetTurnstile() {
      if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
    }
    function showFormError(message) {
      if (!formError) return;
      formError.textContent = message;
      formError.hidden = false;
    }
    function setBusy(busy) {
      submitting = busy;
      if (!submitButton) return;
      submitButton.disabled = busy;
      submitButton.textContent = busy ? 'Enviando…' : submitLabel;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return;
      if (formError) formError.hidden = true;

      var firstInvalid = null;
      rules.forEach(function (rule) {
        var input = document.getElementById(rule.id);
        var ok = rule.test(input.value);
        setError(rule.id, !ok);
        if (!ok && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      // Human verification must be solved before we submit.
      var token = turnstileToken();
      if (!token) {
        if (turnstileError) turnstileError.hidden = false;
        return;
      }
      if (turnstileError) turnstileError.hidden = true;

      setBusy(true);

      var payload = {
        academy: form.academy.value,
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value,
        size: form.size.value,
        message: form.message.value,
        turnstileToken: token
      };

      // JSON isn't CORS-safelisted, so the browser preflights this with OPTIONS; the function
      // answers that itself (web-custom-options) and re-verifies the Turnstile token server-side.
      fetch(LEADS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (response) {
        if (response.ok) {
          form.hidden = true;
          if (success) success.hidden = false;
          return;
        }
        // The token is single-use; refresh it so the visitor can retry cleanly.
        resetTurnstile();
        setBusy(false);
        showFormError(response.status === 429
          ? 'Demasiados intentos. Esperá un minuto e intentá de nuevo.'
          : 'No pudimos enviar tu solicitud. Revisá los datos e intentá de nuevo.');
      }).catch(function () {
        resetTurnstile();
        setBusy(false);
        showFormError('No pudimos conectar. Verificá tu conexión e intentá de nuevo.');
      });
    });
  }

  function initBrandPreview() {
    var preview = document.getElementById('brand-preview');
    var colorInput = document.getElementById('brand-color');
    var swatches = document.querySelectorAll('[data-brand]');

    function applyPreview(color) {
      if (!preview) return;
      preview.style.setProperty('--tenant', color);
      preview.style.setProperty('--brand-primary', color);
      preview.style.setProperty('--brand-primary-text', color);
      preview.style.setProperty('--brand-primary-surface', 'color-mix(in srgb, ' + color + ' 12%, #fff)');
      preview.style.setProperty('--brand-primary-surface-border', 'color-mix(in srgb, ' + color + ' 30%, #fff)');
      preview.style.setProperty('--selection-surface', 'color-mix(in srgb, ' + color + ' 12%, #fff)');
    }
    function pressOnly(el) {
      swatches.forEach(function (b) { b.setAttribute('aria-pressed', b === el ? 'true' : 'false'); });
    }

    swatches.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var color = btn.getAttribute('data-brand');
        applyPreview(color);
        pressOnly(btn);
        if (colorInput) colorInput.value = color;
      });
    });
    if (colorInput) {
      colorInput.addEventListener('input', function () { applyPreview(colorInput.value); pressOnly(null); });
    }
  }

  function init() {
    initReveal();
    initDemoForm();
    initBrandPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
