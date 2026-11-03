// Emits the package's declarations as an installed package, then emits declarations for the
// consumer files beside this one. A type the consumer's exports name but the package's entry doesn't
// export fails with TS2742 or TS2883. Pass the tsc command to run, e.g. `node emit.mts tsc`.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [command, ...prefix] = process.argv.slice(2);

if (!command) {
  throw new Error('Usage: node tests/declarations/emit.mts <tsc command>');
}

const root = fileURLToPath(new URL('../../', import.meta.url));
// The package is installed under another name, so the consumers don't resolve it to the package
// they sit in. The consumers' declarations are emitted beside it, in `node_modules/.emitted`.
const modules = fileURLToPath(new URL('node_modules/', import.meta.url));
const installed = `${modules}plugin-under-test/`;

function tsc(...args: string[]) {
  try {
    execFileSync(command, [...prefix, ...args], { cwd: root, stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}

rmSync(modules, { recursive: true, force: true });
mkdirSync(installed, { recursive: true });

tsc(
  '--project',
  'tsconfig.json',
  '--outDir',
  `${installed}dts`,
  '--declarationMap',
  'false',
  '--composite',
  'false',
  '--incremental',
  'false',
);
// The build copies the declarations beside the ESM output, which the `import` condition resolves.
cpSync(`${installed}dts`, `${installed}esm`, { recursive: true });

const manifest = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
writeFileSync(
  `${installed}package.json`,
  JSON.stringify({ ...manifest, name: 'plugin-under-test' }, null, 2),
);

tsc('--project', 'tsconfig.declarations.json');
