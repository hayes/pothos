export type RefineCallback = (rel: unknown, args: unknown, ctx: unknown) => unknown;

/**
 * `typeName` and `modelName` diverge for variant prismaObjects:
 * `prismaObject('User', { variant: 'AdminUser' })` registers a GraphQL
 * type named `AdminUser` backed by contract model `User`. `typeName` is
 * the public-facing identity that plugin-relay's `getTypeBrand` returns.
 */
export interface PreparedFieldExtension {
  readonly modelName: string;
  readonly typeName: string;
}
