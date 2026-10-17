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
  window.setTimeout(function () {
    var root = document.getElementById('root');
    if (!root || (!root.querySelector('#secureasset-starting') && !root.querySelector('[data-secureasset-loading]') && root.children.length)) return;
    console.error('SecureAsset startup timeout', bootError || 'React did not mount within 15 seconds');
    root.innerHTML = '<main style="min-height:90vh;display:grid;place-items:center;background:#fff;color:#17394b;font:15px Arial,sans-serif;padding:24px;text-align:center"><section><h1 style="font-size:24px">Secure Asset</h1><p>Unable to finish loading. Check your connection and try again.</p><button type="button" id="secureasset-try-again" style="border:0;background:#0B5270;color:#fff;padding:12px 24px;cursor:pointer">Reload application</button></section></main>';
    var button = document.getElementById('secureasset-try-again');
    if (button) button.addEventListener('click', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sa_refresh', String(Date.now()));
      window.location.replace(url.toString());
    });
  }, 15000);
})();
