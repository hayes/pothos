// Pins the text of type errors: mistyped names list the valid names rather than the alias that
// computes them, and model names given without models in `PrismaTypes` name the setup.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const tsc = `${dirname(createRequire(import.meta.url).resolve('typescript/package.json'))}/bin/tsc`;
const cwd = fileURLToPath(new URL('type-messages/', import.meta.url));

let output = '';

beforeAll(() => {
  try {
    execFileSync(process.execPath, [tsc, '--project', 'tsconfig.json', '--pretty', 'false'], {
      cwd,
      encoding: 'utf8',
    });
  } catch (error) {
    output = (error as { stdout: string }).stdout;
  }
}, 120_000);

function errorsByLine(file: string) {
  const errors = new Map<number, string>();
  const pattern = new RegExp(
    `^${file.replace('.', '\\.')}\\((\\d+),\\d+\\): error (TS\\d+: .*)$`,
    'gm',
  );

  for (const match of output.matchAll(pattern)) {
    errors.set(Number(match[1]), `${errors.get(Number(match[1])) ?? ''}${match[2]}\n`);
  }

  return errors;
}

function markers(file: string, marker: string) {
  const lines = readFileSync(`${cwd}${file}`, 'utf8').split('\n');

  return lines.flatMap((line, index) => {
    const text = new RegExp(`// ${marker}: (.*)$`).exec(line)?.[1];

    return text ? [{ line: index + 1, text }] : [];
  });
}

describe('name errors', () => {
  it('list the valid names', () => {
    const errors = errorsByLine('names.ts');
    const lists = markers('names.ts', 'lists');
    const says = markers('names.ts', 'says');

    expect(lists.length).toBeGreaterThan(0);
    expect([...errors.keys()], output).toEqual(
      [...lists, ...says].map(({ line }) => line).sort((a, b) => a - b),
    );

    for (const { line, text } of lists) {
      const message = errors.get(line)!;

      for (const name of text.split(' ')) {
        expect(message, `line ${line}`).toContain(name);
      }

      expect(message, `line ${line}`).not.toMatch(/CompatibleTypes<|UniqueFieldsFromWhereUnique</);
    }

    for (const { line, text } of says) {
      expect(errors.get(line), `line ${line}`).toContain(text);
    }
  });
});

describe('model names without models in PrismaTypes', () => {
  it('name the setup', () => {
    const errors = errorsByLine('missing.ts');
    const expected = markers('missing.ts', 'says');

    expect(expected.length).toBeGreaterThan(0);
    expect([...errors.keys()], output).toEqual(expected.map(({ line }) => line));

    for (const { line, text } of expected) {
      expect(errors.get(line), `line ${line}`).toContain(text);
    }
  });
});
