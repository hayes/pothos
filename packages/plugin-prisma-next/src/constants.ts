// Extension keys.

/** The model key a prisma type is based on, set by the plugin on objects and interfaces. */
export const PRISMA_NEXT_MODEL = 'pothosPrismaNextModel';
/** A type's `select` as written. */
export const PRISMA_NEXT_TYPE_SELECT = 'pothosPrismaNextTypeSelect';
/**
 * The `select`s of a type and of its interfaces, each split into its columns, relations and
 * computed values, set by the plugin. The deepest interface comes first and the type itself last.
 */
export const PRISMA_NEXT_TYPE_SELECTS = 'pothosPrismaNextTypeSelects';
/** A field's selection as the planner reads it: a static selection or a select function. */
export const PRISMA_NEXT_FIELD_SELECTION = 'pothosPrismaNextFieldSelection';
/** The relation a `t.relation` or `t.relatedConnection` field returns rows of, and their type. */
export const PRISMA_NEXT_RELATION_ROWS = 'pothosPrismaNextRelationRows';
/** Marks a hierarchy interface that routes rows with the plugin's discriminator `resolveType`. */
export const PRISMA_NEXT_DISCRIMINATED = 'pothosPrismaNextDiscriminated';
/** A prisma interface's registry of its implementations' selections, one per schema build. */
export const PRISMA_NEXT_IMPLEMENTATIONS = 'pothosPrismaNextImplementations';
/** The plugin's config, on each prisma type, so `collectionFromInfo` finds it from `info.schema`. */
export const PRISMA_NEXT_CONFIG = 'pothosPrismaNextConfig';
