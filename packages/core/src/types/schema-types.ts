export interface MergedSchemaTypes<Info extends GiraphQLSchemaTypes.TypeInfo> extends SchemaTypes {
  outputShapes: { [K in keyof Info['Object']]: Info['Object'][K] } &
    { [K in keyof Info['Interface']]: Info['Interface'][K] } &
    { [K in keyof Info['Scalar']]: Info['Scalar'][K]['Output'] };
  inputShapes: { [K in keyof Info['Scalar']]: Info['Scalar'][K]['Input'] };
  context: Info['Context'];
  root: Info['Root'];
  objects: Extract<keyof Info['Object'], string>;
  interfaces: Extract<keyof Info['Interface'], string>;
  scalars: Extract<keyof Info['Scalar'], string>;
}

export interface SchemaTypes {
  outputShapes: {
    ID: unknown;
    Int: unknown;
    Float: unknown;
    String: unknown;
    Boolean: unknown;
  };
  inputShapes: {
    ID: unknown;
    Int: unknown;
    Float: unknown;
    String: unknown;
    Boolean: unknown;
  };
  context: object;
  objects: string;
  interfaces: string;
  scalars: string;
  root: unknown;
}

export type MergedScalars<Partial extends { [s: string]: { Input: unknown; Output: unknown } }> = {
  [K in keyof DefaultScalars]: Partial[K] extends { Input: unknown; Output: unknown }
    ? Partial[K]
    : DefaultScalars[K];
};

export interface DefaultScalars {
  String: { Input: string; Output: string };
  ID: { Input: string; Output: string | number };
  Int: { Input: number; Output: number };
  Float: { Input: number; Output: number };
  Boolean: { Input: boolean; Output: boolean };
}
export type ScalarName<Types extends SchemaTypes> = Types['scalars'] &
  keyof Types['outputShapes'] &
  keyof Types['inputShapes'];

export type RootName = 'Query' | 'Mutation' | 'Subscription';
