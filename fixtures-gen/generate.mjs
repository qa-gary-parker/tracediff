// Regenerates test/fixtures/{pass,fail}.zip from two real Playwright runs.
//
//   npx playwright install chromium   (once)
//   npm run fixtures:gen
//
// tests/pass.spec.ts passes. tests/fail.spec.ts fails: the config request
// returns 500, the page logs a console error and retries, and the click uses
// a selector that does not exist. Local paths in the zips are normalized.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

const here = import.meta.dirname;
const root = path.resolve(here, '..');
const out = path.join(here, '.out');
const dest = path.join(root, 'test', 'fixtures');

rmSync(out, { recursive: true, force: true });
try {
  execFileSync('npx', ['playwright', 'test', '-c', path.join(here, 'playwright.config.ts')], { cwd: root, stdio: 'inherit' });
} catch {
  // fail.spec.ts is expected to fail
}

const replacements = [
  [root, '/work/tracediff'],
  [os.homedir(), '/home/user'],
];
const normalize = (text) => replacements.reduce((t, [from, to]) => t.split(from).join(to), text);

async function normalizeZip(buf) {
  const zip = await JSZip.loadAsync(buf);
  for (const f of Object.values(zip.files)) {
    if (f.dir || /\.(png|jpe?g)$/i.test(f.name)) continue;
    zip.file(f.name, normalize(await f.async('string')), { date: f.date, createFolders: false });
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

mkdirSync(dest, { recursive: true });
for (const name of ['pass', 'fail']) {
  const src = path.join(out, 'test-results', `${name}-save-profile-chromium`, 'trace.zip');
  writeFileSync(path.join(dest, `${name}.zip`), await normalizeZip(readFileSync(src)));
}
console.log(`fixtures written to ${path.relative(root, dest)}`);
