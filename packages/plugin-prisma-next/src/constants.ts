// Extension keys.

/** The model key a prisma type is based on, set by the plugin on objects and interfaces. */
export const PRISMA_MODEL = 'pothosPrismaModel';
export const PRISMA_TYPE_SELECT = 'pothosPrismaTypeSelect';
/** The split `select`s of a type and its interfaces: the deepest interface first, the type last. */
export const PRISMA_TYPE_SELECTS = 'pothosPrismaTypeSelects';
export const PRISMA_FIELD_SELECTION = 'pothosPrismaFieldSelection';
/** The relation a `t.relation` or `t.relatedConnection` field returns rows of, and their type. */
export const PRISMA_RELATION_ROWS = 'pothosPrismaRelationRows';
/** Marks a hierarchy interface that routes rows with the plugin's discriminator `resolveType`. */
export const PRISMA_DISCRIMINATED = 'pothosPrismaDiscriminated';
export const PRISMA_IMPLEMENTATIONS = 'pothosPrismaImplementations';
/** The plugin's config, on each prisma type, so `collectionFromInfo` finds it from `info.schema`. */
export const PRISMA_CONFIG = 'pothosPrismaConfig';

/** Budget for joined relation loads, below the supported SQL targets' join limits. */
export const MAX_RELATION_LOADS = 61;
