// Extension keys.

/** The model key a prisma type is based on, set by the plugin on objects and interfaces. */
export const PRISMA_NEXT_MODEL = 'pothosPrismaNextModel';
export const PRISMA_NEXT_TYPE_SELECT = 'pothosPrismaNextTypeSelect';
/** The split `select`s of a type and its interfaces: the deepest interface first, the type last. */
export const PRISMA_NEXT_TYPE_SELECTS = 'pothosPrismaNextTypeSelects';
export const PRISMA_NEXT_FIELD_SELECTION = 'pothosPrismaNextFieldSelection';
/** The relation a `t.relation` or `t.relatedConnection` field returns rows of, and their type. */
export const PRISMA_NEXT_RELATION_ROWS = 'pothosPrismaNextRelationRows';
/** Marks a hierarchy interface that routes rows with the plugin's discriminator `resolveType`. */
export const PRISMA_NEXT_DISCRIMINATED = 'pothosPrismaNextDiscriminated';
export const PRISMA_NEXT_IMPLEMENTATIONS = 'pothosPrismaNextImplementations';
/** The plugin's config, on each prisma type, so `collectionFromInfo` finds it from `info.schema`. */
export const PRISMA_NEXT_CONFIG = 'pothosPrismaNextConfig';
