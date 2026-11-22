import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { UsageError } from './errors.js';

export interface Action {
  title: string;
  selector: string;
  duration: number;
  error?: string;
}
export interface Request {
  method: string;
  url: string;
  status: number;
}
export interface Trace {
  actions: Action[];
  requests: Request[];
  consoleErrors: string[];
}

const ACTION_METHODS = new Set(['pw:api', 'expect', 'test.step']);
const ANSI = /\u001b\[\d+m/g;

async function lines(zip: JSZip, name: RegExp): Promise<any[]> {
  const files = zip.file(name).sort((a, b) => a.name.localeCompare(b.name));
  const texts = await Promise.all(files.map((f) => f.async('string')));
  return texts.flatMap((t) => t.split('\n').filter(Boolean).map((l) => JSON.parse(l)));
}

export async function loadTrace(file: string): Promise<Trace> {
  let buf: Buffer;
  try {
    buf = await readFile(file);
  } catch {
    throw new UsageError(`cannot read ${file}`);
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new UsageError(`${file} is not a zip file`);
  }
  if (!zip.file('test.trace')) throw new UsageError(`${file} has no test.trace (expected a trace from @playwright/test)`);

  const events = await lines(zip, /^test\.trace$/);
  const after = new Map(events.filter((e) => e.type === 'after').map((e) => [e.callId, e]));
  const actions = events
    .filter((e) => e.type === 'before' && !e.parentId && !e.group && ACTION_METHODS.has(e.method))
    .map((e): Action => {
      const end = after.get(e.callId);
      const message: string | undefined = end?.error?.message;
      return {
        title: e.title,
        selector: e.subtitle ?? '',
        duration: end ? end.endTime - e.startTime : 0,
        ...(message !== undefined && { error: message.replace(ANSI, '').split('\n')[0] }),
      };
    });

  const requests = (await lines(zip, /^(\d+-)?trace\.network$/)).map(
    (e): Request => ({ method: e.snapshot.request.method, url: e.snapshot.request.url, status: e.snapshot.response?.status ?? 0 }),
  );
  const consoleErrors = (await lines(zip, /^(\d+-)?trace\.trace$/))
    .filter((e) => e.type === 'console' && e.messageType === 'error')
    .map((e) => e.text);

  return { actions, requests, consoleErrors };
}
