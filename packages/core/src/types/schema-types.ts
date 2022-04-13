export interface SchemaTypes extends PothosSchemaTypes.UserSchemaTypes {
  outputShapes: {
    String: unknown;
    ID: unknown;
    Int: unknown;
    Float: unknown;
    Boolean: unknown;
  };
  inputShapes: {
    String: unknown;
    ID: unknown;
    Int: unknown;
    Float: unknown;
    Boolean: unknown;
  };
  Objects: {};
  Interfaces: {};
  Scalars: {
    String: { Input: unknown; Output: unknown };
    ID: { Input: unknown; Output: unknown };
    Int: { Input: unknown; Output: unknown };
    Float: { Input: unknown; Output: unknown };
    Boolean: { Input: unknown; Output: unknown };
  };
  DefaultFieldNullability: boolean;
  DefaultInputFieldRequiredness: boolean;
  Root: object;
  Context: object;
}

export type MergedScalars<PartialTypes extends Partial<PothosSchemaTypes.UserSchemaTypes>> =
  SchemaTypes['Scalars'] & {
    [K in
      | keyof DefaultScalars
      | keyof PartialTypes['Scalars']]: K extends keyof PartialTypes['Scalars']
      ? PartialTypes['Scalars'][K]
      : K extends keyof DefaultScalars
      ? DefaultScalars[K]
      : never;
  };

export interface DefaultScalars {
  String: { Input: string; Output: string };
  ID: { Input: number | string; Output: number | string };
  Int: { Input: number; Output: number };
  Float: { Input: number; Output: number };
  Boolean: { Input: boolean; Output: boolean };
}

export type BaseScalarNames = 'Boolean' | 'Float' | 'ID' | 'Int' | 'String';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type ScalarName<Types extends SchemaTypes> = string &
  (BaseScalarNames | keyof Types['Scalars']);

export type RootName = 'Mutation' | 'Query' | 'Subscription';
