// The errors for mistyped names list the valid names rather than the alias that computes them, and
// a builder without `DrizzleRelations` says what to set.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tsc = `${dirname(createRequire(import.meta.url).resolve('typescript/package.json'))}/bin/tsc`;
const cwd = fileURLToPath(new URL('type-messages/', import.meta.url));

function errorsByLine() {
  let output = '';

  try {
    execFileSync(process.execPath, [tsc, '--project', 'tsconfig.json', '--pretty', 'false'], {
      cwd,
      encoding: 'utf8',
    });
  } catch (error) {
    output = (error as { stdout: string }).stdout;
  }

  const errors = new Map<number, string>();

  for (const match of output.matchAll(/^names\.ts\((\d+),\d+\): error (TS\d+: .*)$/gm)) {
    errors.set(Number(match[1]), `${errors.get(Number(match[1])) ?? ''}${match[2]}\n`);
  }

  return { output, errors };
}

describe('name errors', () => {
  it('list the valid names', { timeout: 120_000 }, () => {
    const { output, errors } = errorsByLine();
    const lines = readFileSync(`${cwd}names.ts`, 'utf8').split('\n');
    const expected = lines.flatMap((line, index) => {
      const [, kind, text] = /\/\/ (lists|says): (.*)$/.exec(line) ?? [];

      return text ? [{ line: index + 1, names: kind === 'lists' ? text.split(' ') : [text] }] : [];
    });

    expect(expected.length).toBeGreaterThan(0);
    expect([...errors.keys()], output).toEqual(expected.map(({ line }) => line));

    for (const { line, names } of expected) {
      const message = errors.get(line)!;

      for (const name of names) {
        expect(message, `line ${line}`).toContain(name);
      }

      expect(message, `line ${line}`).not.toMatch(/CompatibleTypes<|ListRelation</);
    }
  });
});
