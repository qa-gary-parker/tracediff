import { Command, CommanderError } from 'commander';
import { diffTraces } from './diff.js';
import { UsageError } from './errors.js';
import { formatMarkdown } from './format.js';
import { loadTrace } from './trace.js';
import { VERSION } from './version.js';

export interface Io {
  out(text: string): void;
  err(text: string): void;
}

const defaultIo: Io = {
  out: (t) => process.stdout.write(t.endsWith('\n') ? t : t + '\n'),
  err: (t) => process.stderr.write(t.endsWith('\n') ? t : t + '\n'),
};

export async function main(argv: string[], io: Io = defaultIo): Promise<number> {
  let exitCode = 0;
  const program = new Command();
  program
    .name('tracediff')
    .description('Diff a passing and a failing Playwright trace.zip. Exit 0 if the runs match, 1 if they differ, 2 on usage or IO errors.')
    .version(VERSION)
    .exitOverride()
    .showHelpAfterError()
    .configureOutput({ writeOut: (s) => io.out(s), writeErr: (s) => io.err(s) })
    .argument('<pass.zip>', 'trace.zip from the passing run')
    .argument('<fail.zip>', 'trace.zip from the failing run')
    .option('--json', 'machine-readable output')
    .action(async (passFile: string, failFile: string, o: { json?: boolean }) => {
      const diff = diffTraces(await loadTrace(passFile), await loadTrace(failFile));
      io.out(o.json ? JSON.stringify(diff, null, 2) : formatMarkdown(diff));
      exitCode = diff.same ? 0 : 1;
    });

  try {
    await program.parseAsync(argv, { from: 'user' });
    return exitCode;
  } catch (e) {
    if (e instanceof CommanderError) {
      return ['commander.helpDisplayed', 'commander.version', 'commander.help'].includes(e.code) ? 0 : 2;
    }
    if (e instanceof UsageError) {
      io.err(`tracediff: ${e.message}`);
      return 2;
    }
    io.err(`tracediff: error: ${(e as Error).stack ?? String(e)}`);
    return 2;
  }
}
