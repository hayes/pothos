import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const local = fileURLToPath(new URL('../local-examples/', import.meta.url));
// Build current sources before npm copies the local packages. --install-links
// prevents symlinks from pulling GraphQL 17 through the workspace's node_modules.
execFileSync(
  'pnpm',
  [
    'turbo',
    'run',
    'build',
    '--filter=@pothos/core',
    '--filter=@pothos/plugin-grafast',
    '--filter=@pothos/plugin-smart-subscriptions',
    '--filter=@pothos/plugin-directives',
    '--filter=@pothos/plugin-federation',
    '--filter=@pothos/plugin-prisma',
    '--filter=@pothos/plugin-prisma-utils',
    '--filter=@pothos/plugin-relay',
  ],
  { cwd: root, stdio: 'inherit' },
);
execFileSync('node', ['website/scripts/stage-local-packages.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync('npm', ['ci', '--install-links', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd: local,
  stdio: 'inherit',
});
execFileSync('npm', ['rebuild', 'better-sqlite3', '--ignore-scripts=false'], {
  cwd: local,
  stdio: 'inherit',
});
execFileSync('npm', ['run', 'generate'], { cwd: local, stdio: 'inherit' });
execFileSync('npm', ['test'], { cwd: local, stdio: 'inherit' });
