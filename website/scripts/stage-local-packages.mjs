import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

// npm does not understand pnpm's workspace: protocol. Copy the built packages
// and replace only those dependency ranges with the version of the local package.
const root = new URL('../../', import.meta.url);
const local = new URL('../local-examples/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('package.json', local), 'utf8'));
for (const name of Object.keys(manifest.dependencies).filter((name) =>
  name.startsWith('@pothos/'),
)) {
  const directory = name.replace('@pothos/', '');
  const source = new URL(`packages/${directory}/`, root);
  const target = new URL(`.packages/${directory}/`, local);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const entry of ['lib', 'esm', 'dts', 'bin', 'generated.js', 'generated.d.ts', 'LICENSE']) {
    if (existsSync(new URL(entry, source))) {
      cpSync(new URL(entry, source), new URL(entry, target), { recursive: true });
    }
  }
  const pkg = JSON.parse(readFileSync(new URL('package.json', source), 'utf8'));
  delete pkg.devDependencies;
  for (const [dependency, version] of Object.entries(pkg.dependencies ?? {})) {
    if (version.startsWith('workspace:')) {
      const dependencyPkg = new URL(
        `packages/${dependency.replace('@pothos/', '')}/package.json`,
        root,
      );
      pkg.dependencies[dependency] = JSON.parse(readFileSync(dependencyPkg, 'utf8')).version;
    }
  }
  writeFileSync(new URL('package.json', target), `${JSON.stringify(pkg, null, 2)}\n`);
}
