// Prepares a throwaway checkout for a preview of @pothos/plugin-prisma-next. The package stays
// private on main so changesets can't publish it as `latest`; only CI runners remove the flag.
//
//   node scripts/prisma-next-preview.mjs [--version <plugin>] [--mapper-version <mapper>]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    version: { type: 'string' },
    'mapper-version': { type: 'string' },
  },
});

function updateManifest(directory, update) {
  const url = new URL(`../packages/${directory}/package.json`, import.meta.url);
  const manifest = JSON.parse(readFileSync(url, 'utf8'));
  update(manifest);
  writeFileSync(url, `${JSON.stringify(manifest, null, 2)}\n`);
}

updateManifest('plugin-prisma-next', (manifest) => {
  delete manifest.private;
  if (values.version) {
    manifest.version = values.version;
  }
});

// The plugin depends on `workspace:*`, so packing it picks up this version.
if (values['mapper-version']) {
  updateManifest('selection-mapper', (manifest) => {
    manifest.version = values['mapper-version'];
  });
}
