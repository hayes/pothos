import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseCodeBlocksWithLines } from './doc-code-blocks.mjs';

// Shared by the checks that type-check the inline TypeScript of doc pages. Each check turns the
// blocks into modules, and this compiles them and reports errors at the page and line of the block.

const include = /<include(?:regions)?\b[^>]*>[^<]*<\/include(?:regions)?>/g;
const marker = /^\/\/ @doc (.+):(\d+):(\d+)$/;

/** The inline TypeScript blocks of each page. Source includes are left out: the playground checks them. */
export async function readDocBlocks(root, pages) {
  const blocks = [];
  for (const page of pages) {
    // Blank the include tags line for line, so block lines still match the page.
    const source = (await readFile(join(root, page), 'utf8')).replace(include, (tag) =>
      tag.replace(/[^\n]/g, ''),
    );
    for (const { code, line } of parseCodeBlocksWithLines(source, ['ts', 'typescript'])) {
      blocks.push({ page, line, code });
    }
  }
  return blocks;
}

/**
 * A block's code for a module, with a marker that maps compiler errors back to the page. Changes to
 * the code must keep its lines where they are, so imports are blanked rather than removed.
 */
export function located(block, code = block.code) {
  const lines = code.trimEnd().split('\n');
  return `// @doc ${block.page}:${block.line}:${lines.length}\n${lines.join('\n')}\n`;
}

/** Splits a block into its import lines and its code with those lines blanked. */
export function hoistImports(code) {
  const lines = code.split('\n');
  return {
    imports: lines.filter((line) => line.startsWith('import ')),
    body: lines.map((line) => (line.startsWith('import ') ? '' : line)).join('\n'),
  };
}

// Each entry names one block by page and a snippet of its code.
function findBlock(blocks, entry, list) {
  const matches = blocks.filter(
    (block) => block.page.endsWith(`/${entry.page}`) && block.code.includes(entry.snippet),
  );
  if (matches.length !== 1) {
    throw new Error(
      `${list} entry for ${entry.page} matches ${matches.length} blocks, expected 1: ${JSON.stringify(entry.snippet)}`,
    );
  }
  return matches[0];
}

function parseDiagnostics(output) {
  const diagnostics = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (match) {
      const [, file, row, column, code, message] = match;
      diagnostics.push({ file, row: Number(row), column: Number(column), code, message });
    } else if (line.trim() && diagnostics.length) {
      diagnostics.at(-1).message += `\n${line}`;
    } else if (line.trim()) {
      diagnostics.push({ message: line });
    }
  }
  return diagnostics;
}

// Finds the block a line of a module belongs to from the nearest marker above it.
function locate(lines, row) {
  for (let i = row - 1; i >= 0; i--) {
    const match = lines[i].match(marker);
    if (match) {
      const [, page, start, length] = match;
      const offset = row - i - 2;
      return {
        page,
        start: Number(start),
        line: Number(start) + offset,
        inBlock: offset < Number(length),
      };
    }
  }
  return null;
}

/**
 * Type-checks `blocks`. `build` writes the modules for the blocks it is given into the fixture
 * directory and returns `{ files, compilerOptions }`.
 *
 * `skipped` and `knownFailures` name blocks by `{ page, snippet }`, and each must match exactly one
 * block. Skipped blocks are not compiled. A known failure is compiled, and its errors are ignored
 * while one of them contains `error`; the check fails once none does.
 */
export async function checkDocBlocks({
  root,
  tsc,
  fixtureIn,
  blocks,
  expected,
  skipped = [],
  knownFailures = [],
  build,
}) {
  const skip = new Set(skipped.map((entry) => findBlock(blocks, entry, 'skipped')));
  const known = knownFailures.map((entry) => ({
    ...entry,
    block: findBlock(blocks, entry, 'knownFailures'),
  }));
  const checked = blocks.filter((block) => !skip.has(block));
  if (checked.length !== expected) {
    throw new Error(
      `Expected ${expected} doc blocks to check, found ${checked.length}. Update \`expected\` when blocks are added or removed.`,
    );
  }

  const fixture = await mkdtemp(join(fixtureIn, '.docs-check-'));
  const problems = [];
  try {
    const { files, compilerOptions } = await build(checked, fixture);
    await writeFile(
      join(fixture, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { ...compilerOptions, noEmit: true }, files }),
    );
    let output = '';
    try {
      execFileSync(process.execPath, [tsc, '-p', fixture, '--pretty', 'false'], {
        cwd: fixtureIn,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
      if (!output.trim()) {
        throw error;
      }
    }

    const modules = new Map();
    const diagnostics = [];
    for (const diagnostic of parseDiagnostics(output)) {
      if (!diagnostic.file) {
        problems.push(diagnostic.message);
        continue;
      }
      const path = join(fixtureIn, diagnostic.file);
      if (!modules.has(path)) {
        modules.set(path, (await readFile(path, 'utf8')).split('\n'));
      }
      const lines = modules.get(path);
      diagnostics.push({ ...diagnostic, path, lines, where: locate(lines, diagnostic.row) });
    }
    const inBlock = (entry, { where }) =>
      where && entry.block.page === where.page && entry.block.line === where.start;
    const failing = known.filter((entry) =>
      diagnostics.some(
        (diagnostic) => inBlock(entry, diagnostic) && diagnostic.message.includes(entry.error),
      ),
    );
    for (const diagnostic of diagnostics) {
      if (failing.some((entry) => inBlock(entry, diagnostic))) {
        continue;
      }
      const { path, lines, where } = diagnostic;
      const text = `error ${diagnostic.code}: ${diagnostic.message}`;
      problems.push(
        !where
          ? `${relative(root, path)}:${diagnostic.row} (code the check adds)\n  ${lines[diagnostic.row - 1].trim()}\n  ${text}`
          : where.inBlock
            ? `${where.page}:${where.line}:${diagnostic.column}\n  ${text}`
            : `${where.page}:${where.start} (code the check adds around this block)\n  ${lines[diagnostic.row - 1].trim()}\n  ${text}`,
      );
    }
    for (const entry of known.filter((entry) => !failing.includes(entry))) {
      problems.push(
        `${entry.block.page}:${entry.block.line} is listed in knownFailures but no longer fails with ${JSON.stringify(entry.error)}. Remove it from the list.`,
      );
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
  if (problems.length) {
    throw new Error(`Doc blocks failed to type-check:\n\n${problems.join('\n\n')}`);
  }
  return { checked: checked.length, skipped: skip.size, knownFailures: known.length };
}
