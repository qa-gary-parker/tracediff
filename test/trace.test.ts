import { describe, expect, it } from 'vitest';
import { UsageError } from '../src/errors.js';
import { loadTrace } from '../src/trace.js';
import { FAIL, PASS, tmpFile, zipOf } from './helpers.js';

describe('loadTrace', () => {
  it('reads the user actions of the passing run, skipping hooks, fixtures and route handlers', async () => {
    const { actions } = await loadTrace(PASS);
    expect(actions.map((a) => [a.title, a.selector])).toEqual([
      ['Navigate', 'app.tracediff.test/'],
      ['Fill "Ada"', "locator('#name')"],
      ['Wait for timeout', ''],
      ['Click', "locator('#save')"],
      ['Expect "toHaveText"', "locator('#status')"],
    ]);
    expect(actions.every((a) => a.error === undefined)).toBe(true);
  });

  it('reads action durations in milliseconds', async () => {
    const { actions } = await loadTrace(PASS);
    expect(actions[2].duration).toBeCloseTo(51.4, 1);
  });

  it('records the first line of the error on the failing action', async () => {
    const { actions } = await loadTrace(FAIL);
    expect(actions.map((a) => a.title)).toEqual(['Navigate', 'Fill "Ada"', 'Wait for timeout', 'Click']);
    expect(actions[3]).toMatchObject({
      selector: "locator('#save-btn')",
      error: 'TimeoutError: locator.click: Timeout 1000ms exceeded.',
    });
  });

  it('reads network requests with their status', async () => {
    expect((await loadTrace(PASS)).requests).toEqual([
      { method: 'GET', url: 'https://app.tracediff.test/', status: 200 },
      { method: 'GET', url: 'https://app.tracediff.test/api/config', status: 200 },
      { method: 'GET', url: 'https://app.tracediff.test/api/ping', status: 200 },
      { method: 'POST', url: 'https://app.tracediff.test/api/save', status: 200 },
    ]);
    expect((await loadTrace(FAIL)).requests).toEqual([
      { method: 'GET', url: 'https://app.tracediff.test/', status: 200 },
      { method: 'GET', url: 'https://app.tracediff.test/api/config', status: 500 },
      { method: 'GET', url: 'https://app.tracediff.test/api/retry', status: 200 },
    ]);
  });

  it('reads console errors only', async () => {
    expect((await loadTrace(PASS)).consoleErrors).toEqual([]);
    expect((await loadTrace(FAIL)).consoleErrors).toEqual([
      'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
      'config failed: 500',
    ]);
  });

  it('rejects a missing file with a UsageError', async () => {
    await expect(loadTrace('/nonexistent/trace.zip')).rejects.toThrow(new UsageError('cannot read /nonexistent/trace.zip'));
  });

  it('rejects a file that is not a zip', async () => {
    const file = tmpFile('bad.zip', 'not a zip');
    await expect(loadTrace(file)).rejects.toThrow(new UsageError(`${file} is not a zip file`));
  });

  it('rejects a zip without test.trace', async () => {
    const file = tmpFile('lib.zip', await zipOf({ '0-trace.trace': '' }));
    await expect(loadTrace(file)).rejects.toThrow(new UsageError(`${file} has no test.trace (expected a trace from @playwright/test)`));
  });
});
