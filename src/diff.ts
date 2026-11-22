import type { Action, Request, Trace } from './trace.js';

export interface Divergence {
  step: number;
  kind: 'different' | 'error' | 'missing' | 'extra';
  pass?: Action;
  fail?: Action;
}
export interface StatusChange {
  method: string;
  url: string;
  pass: number;
  fail: number;
}
export interface Outlier {
  title: string;
  selector: string;
  pass: number;
  fail: number;
}
export interface Diff {
  same: boolean;
  divergence: Divergence | null;
  network: { missing: Request[]; extra: Request[]; statusChanges: StatusChange[] };
  console: { onlyInPass: string[]; onlyInFail: string[] };
  outliers: Outlier[];
}

const OUTLIER_RATIO = 3;
const OUTLIER_MIN_MS = 200;

// Key each item by its value plus how many times that value occurred before it.
function keyed<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const seen = new Map<string, number>();
  return new Map(
    items.map((item) => {
      const k = key(item);
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      return [`${k}#${n}`, item];
    }),
  );
}

function onlyIn<T>(a: Map<string, T>, b: Map<string, T>): T[] {
  return [...a].filter(([k]) => !b.has(k)).map(([, v]) => v);
}

const actionKey = (a: Action) => `${a.title}\0${a.selector}`;
const requestKey = (r: Request) => `${r.method} ${r.url}`;

function firstDivergence(pass: Action[], fail: Action[]): Divergence | null {
  for (let i = 0; i < Math.max(pass.length, fail.length); i++) {
    const [p, f] = [pass[i], fail[i]];
    const step = i + 1;
    if (!f) return { step, kind: 'missing', pass: p };
    if (!p) return { step, kind: 'extra', fail: f };
    if (actionKey(p) !== actionKey(f)) return { step, kind: 'different', pass: p, fail: f };
    if ((p.error === undefined) !== (f.error === undefined)) return { step, kind: 'error', pass: p, fail: f };
  }
  return null;
}

export function diffTraces(pass: Trace, fail: Trace): Diff {
  const [pr, fr] = [keyed(pass.requests, requestKey), keyed(fail.requests, requestKey)];
  const network = {
    missing: onlyIn(pr, fr),
    extra: onlyIn(fr, pr),
    statusChanges: [...pr].flatMap(([k, p]) => {
      const f = fr.get(k);
      return f && f.status !== p.status ? [{ method: p.method, url: p.url, pass: p.status, fail: f.status }] : [];
    }),
  };

  const [pc, fc] = [keyed(pass.consoleErrors, (t) => t), keyed(fail.consoleErrors, (t) => t)];
  const consoleDiff = { onlyInPass: onlyIn(pc, fc), onlyInFail: onlyIn(fc, pc) };

  const [pa, fa] = [keyed(pass.actions, actionKey), keyed(fail.actions, actionKey)];
  const outliers = [...pa].flatMap(([k, p]) => {
    const f = fa.get(k);
    if (!f) return [];
    const [hi, lo] = [Math.max(p.duration, f.duration), Math.min(p.duration, f.duration)];
    const slow = hi - lo >= OUTLIER_MIN_MS && hi >= OUTLIER_RATIO * Math.max(lo, 1);
    return slow ? [{ title: p.title, selector: p.selector, pass: p.duration, fail: f.duration }] : [];
  });

  const divergence = firstDivergence(pass.actions, fail.actions);
  const same =
    !divergence &&
    !network.missing.length &&
    !network.extra.length &&
    !network.statusChanges.length &&
    !consoleDiff.onlyInPass.length &&
    !consoleDiff.onlyInFail.length;
  return { same, divergence, network, console: consoleDiff, outliers };
}
