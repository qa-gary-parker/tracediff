import type { Diff } from './diff.js';
import type { Action } from './trace.js';

const label = (a: Pick<Action, 'title' | 'selector'>) => `\`${`${a.title} ${a.selector}`.trim()}\``;
const ms = (n: number) => `${Math.round(n)} ms`;
const req = (r: { method: string; url: string }) => `\`${r.method} ${r.url}\``;

function section(heading: string, items: string[]): string[] {
  return items.length ? [`## ${heading}`, '', ...items.map((i) => `- ${i}`), ''] : [];
}

function divergenceLines(d: NonNullable<Diff['divergence']>): string[] {
  const { step, pass, fail } = d;
  const head =
    d.kind === 'different'
      ? `Step ${step}: pass ran ${label(pass!)}, fail ran ${label(fail!)}`
      : d.kind === 'missing'
        ? `Step ${step}: pass ran ${label(pass!)}, fail stopped before it`
        : d.kind === 'extra'
          ? `Step ${step}: fail ran ${label(fail!)}, pass did not`
          : `Step ${step}: ${label(pass!)} errored in ${pass!.error ? 'pass' : 'fail'} only`;
  return [head, ...(fail?.error ? [`Fail error: ${fail.error}`] : []), ...(pass?.error ? [`Pass error: ${pass.error}`] : [])];
}

export function formatMarkdown(diff: Diff): string {
  const { network, console: cons } = diff;
  const lines = [
    '# tracediff',
    '',
    ...(diff.same ? ['No differences.', ''] : []),
    ...section('First divergence', diff.divergence ? divergenceLines(diff.divergence) : []),
    ...section('Network', [
      ...network.missing.map((r) => `Missing in fail: ${req(r)} (${r.status})`),
      ...network.extra.map((r) => `Extra in fail: ${req(r)} (${r.status})`),
      ...network.statusChanges.map((c) => `Status changed: ${req(c)} ${c.pass} -> ${c.fail}`),
    ]),
    ...section('Console errors', [
      ...cons.onlyInPass.map((t) => `Only in pass: ${t}`),
      ...cons.onlyInFail.map((t) => `Only in fail: ${t}`),
    ]),
    ...section(
      'Duration outliers',
      diff.outliers.map((o) => `${label(o)}: ${ms(o.pass)} -> ${ms(o.fail)}`),
    ),
  ];
  return lines.join('\n');
}
