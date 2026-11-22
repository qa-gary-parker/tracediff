import { describe, expect, it } from 'vitest';
import { FAIL, PASS, run, tmpFile } from './helpers.js';

describe('markdown output', () => {
  it('exits 1 and reports every section for the fixtures', async () => {
    const r = await run([PASS, FAIL]);
    expect(r.code).toBe(1);
    expect(r.stderr).toBe('');
    expect(r.stdout).toBe(
      [
        '# tracediff',
        '',
        '## First divergence',
        '',
        "- Step 4: pass ran `Click locator('#save')`, fail ran `Click locator('#save-btn')`",
        '- Fail error: TimeoutError: locator.click: Timeout 1000ms exceeded.',
        '',
        '## Network',
        '',
        '- Missing in fail: `GET https://app.tracediff.test/api/ping` (200)',
        '- Missing in fail: `POST https://app.tracediff.test/api/save` (200)',
        '- Extra in fail: `GET https://app.tracediff.test/api/retry` (200)',
        '- Status changed: `GET https://app.tracediff.test/api/config` 200 -> 500',
        '',
        '## Console errors',
        '',
        '- Only in fail: Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
        '- Only in fail: config failed: 500',
        '',
        '## Duration outliers',
        '',
        '- `Wait for timeout`: 51 ms -> 610 ms',
        '',
      ].join('\n'),
    );
  });

  it('exits 0 and says so when the runs match', async () => {
    const r = await run([PASS, PASS]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('# tracediff\n\nNo differences.\n');
  });
});

describe('--json', () => {
  it('prints the diff and exits 1', async () => {
    const r = await run([PASS, FAIL, '--json']);
    expect(r.code).toBe(1);
    const out = JSON.parse(r.stdout);
    expect(out.same).toBe(false);
    expect(out.divergence.step).toBe(4);
    expect(out.divergence.fail.selector).toBe("locator('#save-btn')");
    expect(out.network.statusChanges).toEqual([{ method: 'GET', url: 'https://app.tracediff.test/api/config', pass: 200, fail: 500 }]);
    expect(out.console.onlyInFail).toHaveLength(2);
    expect(out.outliers.map((o: { title: string }) => o.title)).toEqual(['Wait for timeout']);
  });

  it('exits 0 for matching runs', async () => {
    const r = await run([PASS, PASS, '--json']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).same).toBe(true);
  });
});

describe('usage and IO errors', () => {
  it('exits 2 when an argument is missing', async () => {
    const r = await run([PASS]);
    expect(r.code).toBe(2);
    expect(r.stdout).toBe('');
  });

  it('exits 2 for a missing file', async () => {
    const r = await run([PASS, '/nonexistent/fail.zip']);
    expect(r.code).toBe(2);
    expect(r.stderr).toBe('tracediff: cannot read /nonexistent/fail.zip\n');
  });

  it('exits 2 for a file that is not a zip', async () => {
    const bad = tmpFile('bad.zip', 'nope');
    const r = await run([PASS, bad]);
    expect(r.code).toBe(2);
    expect(r.stderr).toBe(`tracediff: ${bad} is not a zip file\n`);
  });
});
