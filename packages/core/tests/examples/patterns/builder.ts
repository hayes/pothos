import SchemaBuilder from '../../../src';

export interface SchemaTypes {
  Scalars: {
    ID: {
      Input: string;
      Output: string;
    };
  };
}
export type TypesWithDefault = PothosSchemaTypes.ExtendDefaultTypes<SchemaTypes>;

const builder = new SchemaBuilder<SchemaTypes>({});

export default builder;
