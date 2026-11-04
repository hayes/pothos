import type {
  BuildCache,
  PothosOutputFieldConfig,
  PothosTypeConfig,
  SchemaTypes,
} from '@pothos/core';
import type { TypeLevelConflict } from '@pothos/selection-mapper';

/** The scope-auth options read here, which this plugin's types don't know. */
interface ScopeOptions {
  authScopes?: unknown;
  grantScopes?: unknown;
  runScopesOnType?: boolean;
  skipInterfaceScopes?: boolean;
  skipTypeScopes?: boolean;
}

function scopeOptions(config: { pothosOptions: object }) {
  return config.pothosOptions as ScopeOptions;
}

/** Whether a type has scope-auth checks that read its rows. */
export function hasTypeScopes(config: PothosTypeConfig) {
  const { authScopes, grantScopes } = scopeOptions(config);

  return !!authScopes || !!grantScopes;
}

/**
 * The types whose scope-auth checks read a parent row of the field `fieldConfig`: the type-level
 * `authScopes` and `grantScopes` scope-auth runs on the field (the steps its `createResolveSteps`
 * builds), and the type the field's own checks are typed with.
 */
export function fieldScopeReaders<Types extends SchemaTypes>(
  buildCache: BuildCache<Types>,
  runScopesOnType: boolean | undefined,
  fieldConfig: PothosOutputFieldConfig<Types>,
): Set<string> {
  const readers = new Set<string>();
  const parent = buildCache.getTypeConfig(fieldConfig.parentType);
  const declaring = fieldConfig.declaringType
    ? buildCache.getTypeConfig(fieldConfig.declaringType)
    : parent;
  const field = scopeOptions(fieldConfig);
  const inherited = declaring !== parent;
  const skipDeclaring =
    inherited &&
    (!!field.skipInterfaceScopes ||
      (parent.kind === 'Object' && !!scopeOptions(parent).skipInterfaceScopes));
  const runsOnField = (config: PothosTypeConfig) =>
    !(scopeOptions(config).runScopesOnType ?? runScopesOnType ?? false);

  if (runsOnField(declaring)) {
    addTypeSteps(
      readers,
      buildCache,
      declaring,
      !!field.skipTypeScopes || skipDeclaring,
      !!field.skipInterfaceScopes || skipDeclaring,
    );
  }

  if (inherited && runsOnField(parent)) {
    addTypeSteps(readers, buildCache, parent, !!field.skipTypeScopes, !!field.skipInterfaceScopes);
  }

  if (field.authScopes || field.grantScopes) {
    readers.add(declaring.name);
  }

  return readers;
}

/**
 * The types whose checks scope-auth runs on a row of `typeName` from `isTypeOf`, with
 * `runScopesOnType`: the steps its `createStepsForType` builds for the type.
 */
export function typeScopeReaders<Types extends SchemaTypes>(
  buildCache: BuildCache<Types>,
  typeName: string,
): Set<string> {
  const readers = new Set<string>();

  addTypeSteps(readers, buildCache, buildCache.getTypeConfig(typeName), false, false);

  return readers;
}

/**
 * Adds the types whose checks scope-auth's `createStepsForType` runs for `config` to `readers`:
 * its own `authScopes` (unless `skipType`) and `grantScopes`, and its interfaces' `authScopes`
 * (unless `skipInterfaces`, or an object type's `skipInterfaceScopes`).
 */
function addTypeSteps<Types extends SchemaTypes>(
  readers: Set<string>,
  buildCache: BuildCache<Types>,
  config: PothosTypeConfig,
  skipType: boolean,
  skipInterfaces: boolean,
) {
  const { authScopes, grantScopes } = scopeOptions(config);

  if ((authScopes && !skipType) || grantScopes) {
    readers.add(config.name);
  }

  if (
    skipInterfaces ||
    (config.kind !== 'Object' && config.kind !== 'Interface') ||
    (config.kind === 'Object' && scopeOptions(config).skipInterfaceScopes)
  ) {
    return;
  }

  for (const iface of config.interfaces) {
    const interfaceConfig = buildCache.getTypeConfig(iface, 'Interface');

    if (scopeOptions(interfaceConfig).authScopes) {
      readers.add(interfaceConfig.name);
    }
  }
}

/**
 * Why a reload that left out the selections of the types in `skipped` can't serve the checks of
 * `readers`, or undefined when it can.
 */
export function uncheckedReload(
  skipped: ReadonlyMap<string, string>,
  readers: ReadonlySet<string>,
): string | undefined {
  for (const [name, message] of skipped) {
    if (readers.has(name)) {
      return message;
    }
  }

  return undefined;
}

/**
 * Why `iface`'s scope checks can't run on a row of `type` Pothos reloads: the row can hold only one
 * of the conflicting selections. `other` is the type `iface` conflicts with, when a single one
 * does. Modelled on the planner's error for the same conflict.
 */
export function uncheckedScopesMessage(
  iface: string,
  type: string,
  other: string | undefined,
  conflict: TypeLevelConflict | undefined,
) {
  const subject = other
    ? `Type-level selections of ${iface} and ${other} conflict`
    : `The type-level selection of ${iface} conflicts with the selections merged for ${type}`;
  const unchecked = `so ${iface}'s scope checks can't run on a row Pothos reloads.`;

  if (!conflict) {
    return `${subject}, ${unchecked} Move the conflicting selection to a field-level select on one of the types.`;
  }

  switch (conflict.kind) {
    case 'relation':
      return `${subject} on relation "${conflict.name}", ${unchecked} Move the relation arguments to a field-level select on one of the types.`;
    // Prisma reports a conflicting `_count` as a relation, so this is never reached.
    case 'extra':
      return `${subject} on "${conflict.name}", ${unchecked} Move it to a field-level select on one of the types.`;
    default: {
      const unknown: never = conflict.kind;

      return `${subject} on ${unknown as string}, ${unchecked}`;
    }
  }
}
