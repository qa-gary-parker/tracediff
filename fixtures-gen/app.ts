import type { Page } from '@playwright/test';

export const ORIGIN = 'https://app.tracediff.test';

const HTML = `<!doctype html>
<html><head><title>Profile</title></head>
<body>
  <label>Name <input id="name"></label>
  <button id="save">Save</button>
  <p id="status"></p>
  <script>
    (async () => {
      const cfg = await fetch('/api/config');
      if (!cfg.ok) {
        console.error('config failed: ' + cfg.status);
        await fetch('/api/retry');
        return;
      }
      await fetch('/api/ping');
    })();
    document.getElementById('save').addEventListener('click', async () => {
      await fetch('/api/save', { method: 'POST', body: document.getElementById('name').value });
      document.getElementById('status').textContent = 'Saved';
    });
  </script>
</body></html>`;

export async function serveApp(page: Page, configStatus: number) {
  await page.route(`${ORIGIN}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: HTML });
    const status = pathname === '/api/config' ? configStatus : 200;
    return route.fulfill({ status, contentType: 'application/json', body: '{}' });
  });
}
