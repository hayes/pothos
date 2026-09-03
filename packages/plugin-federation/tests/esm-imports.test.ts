import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const srcDir = join(import.meta.dirname, '../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function packageSubpathImports(file: string) {
  const specifiers = [...readFileSync(file, 'utf8').matchAll(/(?:from|import\()\s*'([^']+)'/g)].map(
    ([, specifier]) => specifier,
  );

  return specifiers.filter((specifier) => {
    if (specifier.startsWith('.') || specifier.startsWith('node:')) {
      return false;
    }

    const segments = specifier.split('/');

    return specifier.startsWith('@') ? segments.length > 2 : segments.length > 1;
  });
}

describe('esm imports', () => {
  // Node's ESM resolver never appends extensions to package subpaths, so a subpath that isn't
  // remapped by the target package's `exports` map has to name a file that exists. Biome's
  // useImportExtensions rule only covers relative imports, so nothing else catches this.
  it('uses subpaths that resolve without extension guessing', () => {
    for (const file of sourceFiles(srcDir)) {
      for (const specifier of packageSubpathImports(file)) {
        const segments = specifier.split('/');
        const name = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
        const subpath = specifier.slice(name.length + 1);

        let manifestPath: string;

        try {
          manifestPath = require.resolve(`${name}/package.json`);
        } catch {
          // package.json isn't reachable, which means an `exports` map governs the subpath
          continue;
        }

        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { exports?: unknown };

        if (manifest.exports) {
          continue;
        }

        expect(
          existsSync(join(dirname(manifestPath), subpath)) ? null : specifier,
          `${specifier} in ${file} does not resolve to a file`,
        ).toBeNull();
      }
    }
  });
});
