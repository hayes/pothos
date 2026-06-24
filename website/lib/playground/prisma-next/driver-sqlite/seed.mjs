// Registry the playground uses to hand a seed SQL string to the
// sql.js-backed driver without changing the canonical
// `sqlite({ path })` user-code shape. The user passes `path: "seed:<key>"`
// and the driver looks up the registered SQL by key.

const seeds = new Map();

export function registerSeed(key, sql) {
  seeds.set(key, sql);
}

export function takeSeed(key) {
  return seeds.get(key);
}

export function clearSeed(key) {
  seeds.delete(key);
}
