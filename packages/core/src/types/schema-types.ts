import { BasePlugin } from '../plugins';

export interface SchemaTypes {
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
  Root: object;
  Context: object;
}

export type MergedScalars<
  PartialTypes extends Partial<GiraphQLSchemaTypes.TypeInfo>
> = SchemaTypes['Scalars'] &
  {
    [K in
      | keyof PartialTypes['Scalars']
      | keyof DefaultScalars]: K extends keyof PartialTypes['Scalars']
      ? PartialTypes['Scalars'][K]
      : K extends keyof DefaultScalars
      ? DefaultScalars[K]
      : never;
  };

export interface DefaultScalars {
  String: { Input: string; Output: string };
  ID: { Input: string | number; Output: string | number };
  Int: { Input: number; Output: number };
  Float: { Input: number; Output: number };
  Boolean: { Input: boolean; Output: boolean };
}

export type BaseScalarNames = 'String' | 'ID' | 'Int' | 'Float' | 'Boolean';

export type ScalarName<Types extends SchemaTypes> = (keyof Types['Scalars'] | BaseScalarNames) &
  string;

export type RootName = 'Query' | 'Mutation' | 'Subscription';

export type PluginConstructorMap = {
  [K in keyof GiraphQLSchemaTypes.Plugins<SchemaTypes>]: {
    new (builder: GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>): GiraphQLSchemaTypes.Plugins<
      SchemaTypes
    >[K] &
      BasePlugin<SchemaTypes> & {
        name: K;
      };
  };
};
