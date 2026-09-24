(function () {
  'use strict';
  var form = document.getElementById('involvement-form');
  if (!form) return;
  var status = document.getElementById('involvement-status');
  var button = form.querySelector('button[type="submit"]');
  var requestId;
  form.addEventListener('input', function () { requestId = null; });
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    button.disabled = true;
    button.textContent = 'Sending…';
    status.textContent = '';
    requestId = requestId || crypto.randomUUID();
    try {
      var response = await fetch('/api/involvement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.value.trim(), description: form.description.value.trim(), website: form.website.value, requestId: requestId }),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('send-failed');
      form.reset();
      requestId = null;
      status.textContent = 'Thank you! Your message has been sent to Nicolas.';
    } catch (error) {
      status.textContent = 'Your message could not be confirmed. Please try again or use the email link below.';
    } finally {
      button.disabled = false;
      button.textContent = 'Get in touch';
    }
  });
})();
