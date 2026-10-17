// Runs independently of the React bundle so a failed JS import or a stalled
// Suspense boundary never leaves production visitors on a blank white screen.
(function () {
  var bootError = '';
  window.addEventListener('error', function (event) {
    if (!bootError) bootError = (event.message || 'script load error').slice(0, 180);
  });
  window.addEventListener('unhandledrejection', function (event) {
    if (!bootError) bootError = String(event.reason && event.reason.message || event.reason || 'module error').slice(0, 180);
  });
  window.addEventListener('securitypolicyviolation', function (event) {
    if (!bootError) bootError = 'CSP blocked: ' + (event.blockedURI || 'inline') + ' (' + event.violatedDirective + ')';
  });
  var moduleProbe = { status: 'not checked', contentType: '', url: '' };
  if (new URLSearchParams(window.location.search).has('sa_debug')) {
    window.setTimeout(function () {
      var script = document.querySelector('script[type="module"]');
      if (!script || !script.src) { moduleProbe.status = 'no module script'; return; }
      moduleProbe.url = script.src;
      fetch(script.src, { cache: 'no-store' }).then(function (response) {
        moduleProbe.status = response.status;
        moduleProbe.contentType = response.headers.get('content-type') || '';
      }).catch(function (error) { moduleProbe.status = String(error); });
    }, 3000);
  }
  window.addEventListener('error', function (event) {
    if (!bootError && event.target && event.target.tagName === 'SCRIPT') {
      bootError = 'Script failed to load: ' + (event.target.src || 'unknown script');
    }
  }, true);
  window.setTimeout(function () {
    var root = document.getElementById('root');
    if (!root || (!root.querySelector('#secureasset-starting') && !root.querySelector('[data-secureasset-loading]') && root.children.length)) return;
    console.error('SecureAsset startup timeout', bootError || 'React did not mount within 15 seconds');
    root.innerHTML = '<main style="min-height:90vh;display:grid;place-items:center;background:#fff;color:#17394b;font:15px Arial,sans-serif;padding:24px;text-align:center"><section><h1 style="font-size:24px">Secure Asset</h1><p>Unable to finish loading. Check your connection and try again.</p><button type="button" id="secureasset-try-again" style="border:0;background:#0B5270;color:#fff;padding:12px 24px;cursor:pointer">Reload application</button></section></main>';
    if (new URLSearchParams(window.location.search).has('sa_debug')) {
      var diag = document.createElement('pre');
      diag.style.cssText = 'text-align:left;white-space:pre-wrap;word-break:break-all;font:11px monospace;max-width:90vw;max-height:35vh;overflow:auto;margin-top:24px;padding:10px;border:1px solid #ddd;background:#f7f7f7';
      diag.textContent = JSON.stringify({
        error: bootError || 'no error event captured',
        moduleProbe: moduleProbe,
        moduleSupported: 'noModule' in document.createElement('script'),
        scripts: Array.prototype.map.call(document.scripts, function (s) { return { src: s.src || '[inline]', type: s.type }; }),
        resources: performance.getEntriesByType('resource').filter(function (r) { return /\\.(js|css)(\\?|$)/.test(r.name); }).map(function (r) { return r.name; }).slice(-20)
      }, null, 2);
      var section = root.querySelector('section');
      if (section) section.appendChild(diag);
    }
    var button = document.getElementById('secureasset-try-again');
    if (button) button.addEventListener('click', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sa_refresh', String(Date.now()));
      window.location.replace(url.toString());
    });
  }, 15000);
})();
