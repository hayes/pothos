export const PRISMA_NEXT_MODEL = 'pothosPrismaNextModel';
export const PRISMA_NEXT_PREPARED = 'pothosPrismaNextPrepared';
export const PRISMA_NEXT_SELECT = 'pothosPrismaNextSelect';
export const PRISMA_NEXT_RELATIONS = 'pothosPrismaNextRelations';
export const PRISMA_NEXT_COLUMNS = 'pothosPrismaNextColumns';
/**
 * Stamped on every field of a model-backed type by `onOutputFieldConfig`: the parent model's
 * name and, when the field returns a model-backed type (seen through any indirect-include
 * wrapper), that model's name. The adapter compiles the field's `select` against these; the
 * walker hands it a bare `GraphQLField`, which knows neither.
 */
export const PRISMA_NEXT_FIELD = 'pothosPrismaNextField';
/**
 * A selection the plugin's own sugar compiled ahead of `onOutputFieldConfig` (a
 * `t.relatedConnection` select function). Takes the place of the compile from `pothosOptions`.
 */
export const PRISMA_NEXT_FIELD_SELECT = 'pothosPrismaNextFieldSelect';
