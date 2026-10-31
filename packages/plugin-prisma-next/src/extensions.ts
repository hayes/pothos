export type RefineCallback = (rel: unknown, args: unknown, ctx: unknown) => unknown;

/** `typeName` differs from `modelName` for variants (`prismaObject('User', { variant })`). */
export interface PreparedFieldExtension {
  readonly modelName: string;
  readonly typeName: string;
  readonly isList: boolean;
}
