// Extension keys.

/** The model key a prisma type is based on, set by the plugin on objects and interfaces. */
export const PRISMA_NEXT_MODEL = 'pothosPrismaNextModel';
/** A type's `select` as written. */
export const PRISMA_NEXT_TYPE_SELECT = 'pothosPrismaNextTypeSelect';
/** A field's selection as the planner reads it: a static selection or a select function. */
export const PRISMA_NEXT_FIELD_SELECTION = 'pothosPrismaNextFieldSelection';
/** A planned field's check that the data it reads is on the parent it resolves with. */
export const PRISMA_NEXT_LOADED_CHECK = 'pothosPrismaNextLoadedCheck';
/** Marks a hierarchy interface that routes rows with the plugin's discriminator `resolveType`. */
export const PRISMA_NEXT_DISCRIMINATED = 'pothosPrismaNextDiscriminated';
/** A prisma interface's registry of its implementations' selections, one per schema build. */
export const PRISMA_NEXT_IMPLEMENTATIONS = 'pothosPrismaNextImplementations';
/** The to-one relation a field loads with its own query or variant, replacing the declared one. */
export const PRISMA_NEXT_REFINED_TO_ONE = 'pothosPrismaNextRefinedToOne';
/** Marks a connection's field that doesn't read the connection's rows, so they aren't loaded for it. */
export const PRISMA_NEXT_CONNECTION_AGGREGATE = 'pothosPrismaNextConnectionAggregate';
/** The plugin's config, on each prisma type, so `collectionFromInfo` finds it from `info.schema`. */
export const PRISMA_NEXT_CONFIG = 'pothosPrismaNextConfig';
