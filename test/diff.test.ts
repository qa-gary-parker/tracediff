import { describe, expect, it } from 'vitest';
import { diffTraces } from '../src/diff.js';
import { loadTrace, type Action, type Trace } from '../src/trace.js';
import { FAIL, PASS } from './helpers.js';

const act = (title: string, selector = '', duration = 10, error?: string): Action => ({ title, selector, duration, error });
const trace = (actions: Action[], extra: Partial<Trace> = {}): Trace => ({ actions, requests: [], consoleErrors: [], ...extra });

describe('divergence', () => {
  it('reports the first action whose title+selector differs', async () => {
    const d = diffTraces(await loadTrace(PASS), await loadTrace(FAIL));
    expect(d.divergence).toMatchObject({
      step: 4,
      kind: 'different',
      pass: { title: 'Click', selector: "locator('#save')" },
      fail: { title: 'Click', selector: "locator('#save-btn')", error: 'TimeoutError: locator.click: Timeout 1000ms exceeded.' },
    });
  });

  it('reports the same action failing in only one run as an error divergence', () => {
    const d = diffTraces(
      trace([act('Navigate'), act('Click', '#a')]),
      trace([act('Navigate'), act('Click', '#a', 10, 'Timeout')]),
    );
    expect(d.divergence).toMatchObject({ step: 2, kind: 'error', fail: { error: 'Timeout' } });
  });

  it('reports actions that only the passing run reached as missing', () => {
    const d = diffTraces(trace([act('Navigate'), act('Click', '#a')]), trace([act('Navigate')]));
    expect(d.divergence).toMatchObject({ step: 2, kind: 'missing', pass: { title: 'Click' } });
    expect(d.divergence?.fail).toBeUndefined();
  });

  it('reports actions that only the failing run performed as extra', () => {
    const d = diffTraces(trace([act('Navigate')]), trace([act('Navigate'), act('Reload')]));
    expect(d.divergence).toMatchObject({ step: 2, kind: 'extra', fail: { title: 'Reload' } });
    expect(d.divergence?.pass).toBeUndefined();
  });

  it('is null and same when a trace is diffed with itself', async () => {
    const t = await loadTrace(PASS);
    expect(diffTraces(t, t)).toEqual({
      same: true,
      divergence: null,
      network: { missing: [], extra: [], statusChanges: [] },
      console: { onlyInPass: [], onlyInFail: [] },
      outliers: [],
    });
  });
});

describe('network', () => {
  it('reports missing, extra and status-changed requests', async () => {
    const d = diffTraces(await loadTrace(PASS), await loadTrace(FAIL));
    expect(d.network).toEqual({
      missing: [
        { method: 'GET', url: 'https://app.tracediff.test/api/ping', status: 200 },
        { method: 'POST', url: 'https://app.tracediff.test/api/save', status: 200 },
      ],
      extra: [{ method: 'GET', url: 'https://app.tracediff.test/api/retry', status: 200 }],
      statusChanges: [{ method: 'GET', url: 'https://app.tracediff.test/api/config', pass: 200, fail: 500 }],
    });
  });

  it('matches repeated requests to the same URL by occurrence', () => {
    const r = (status: number) => ({ method: 'GET', url: 'https://x.test/poll', status });
    const d = diffTraces(trace([], { requests: [r(200), r(200)] }), trace([], { requests: [r(200)] }));
    expect(d.network).toEqual({ missing: [r(200)], extra: [], statusChanges: [] });
  });
});

describe('console', () => {
  it('reports console errors seen in only one run', async () => {
    const d = diffTraces(await loadTrace(PASS), await loadTrace(FAIL));
    expect(d.console).toEqual({
      onlyInPass: [],
      onlyInFail: [
        'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
        'config failed: 500',
      ],
    });
  });
});

describe('duration outliers', () => {
  it('reports matched actions that are far slower in the fixtures', async () => {
    const d = diffTraces(await loadTrace(PASS), await loadTrace(FAIL));
    expect(d.outliers.map((o) => o.title)).toEqual(['Wait for timeout']);
    expect(d.outliers[0].pass).toBeCloseTo(51.4, 1);
    expect(d.outliers[0].fail).toBeCloseTo(610.2, 1);
  });

  it('needs at least 3x and 200 ms difference', () => {
    const outliers = (p: number, f: number) => diffTraces(trace([act('A', '', p)]), trace([act('A', '', f)])).outliers;
    expect(outliers(1000, 1900)).toEqual([]);
    expect(outliers(10, 150)).toEqual([]);
    expect(outliers(100, 400)).toEqual([{ title: 'A', selector: '', pass: 100, fail: 400 }]);
    expect(outliers(400, 100)).toEqual([{ title: 'A', selector: '', pass: 400, fail: 100 }]);
  });

  it('does not make runs differ on its own', () => {
    const d = diffTraces(trace([act('A', '', 10)]), trace([act('A', '', 900)]));
    expect(d.outliers).toHaveLength(1);
    expect(d.same).toBe(true);
  });
});

describe('same', () => {
  it('is false when only network differs', () => {
    const d = diffTraces(trace([], { requests: [{ method: 'GET', url: 'u', status: 200 }] }), trace([]));
    expect(d.same).toBe(false);
  });

  it('is false when only console errors differ', () => {
    expect(diffTraces(trace([]), trace([], { consoleErrors: ['boom'] })).same).toBe(false);
  });
});
