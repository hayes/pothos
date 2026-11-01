// Extension keys. A name says what its extension holds and can differ from the key string, which
// stays fixed because code outside the plugin may read it.

/** The contract model a prisma type is based on, set by the plugin on objects and interfaces. */
export const PRISMA_NEXT_MODEL = 'pothosPrismaNextModel';
/** A type's `select` as written. */
export const PRISMA_NEXT_TYPE_SELECT = 'pothosPrismaNextSelect';
/** A field's selection as the planner reads it: a static query or a select function. */
export const PRISMA_NEXT_FIELD_SELECTION = 'pothosPrismaNextFieldSelect';
/** A planned field's check that the data it reads is on the parent it resolves with. */
export const PRISMA_NEXT_LOADED = 'pothosPrismaNextLoaded';
/** Marks a hierarchy interface that routes rows with the plugin's discriminator `resolveType`. */
export const PRISMA_NEXT_DISCRIMINATED = 'pothosPrismaNextDiscriminated';
/** Whether a field's selection comes from its own `select` option. */
export const PRISMA_NEXT_FIELD_HAS_SELECT = 'pothosPrismaNextDeclaredSelect';
/** A prisma interface's registry of its implementations' selections, one per schema build. */
export const PRISMA_NEXT_IMPLEMENTATIONS = 'pothosPrismaNextImplementations';
