import JSZip from 'jszip';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/main.js';

export const FIXTURES = path.join(import.meta.dirname, 'fixtures');
export const PASS = path.join(FIXTURES, 'pass.zip');
export const FAIL = path.join(FIXTURES, 'fail.zip');

export const tmpFile = (name: string, data: string | Uint8Array) => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'tracediff-')), name);
  writeFileSync(file, data);
  return file;
};

export async function zipOf(files: Record<string, string>) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function run(argv: string[]) {
  let stdout = '';
  let stderr = '';
  const code = await main(argv, {
    out: (t) => {
      stdout += t.endsWith('\n') ? t : t + '\n';
    },
    err: (t) => {
      stderr += t.endsWith('\n') ? t : t + '\n';
    },
  });
  return { code, stdout, stderr };
}
