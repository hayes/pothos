import SchemaBuilder from '../../../src';

export interface SchemaTypes {
  Scalars: {
    ID: {
      Input: string;
      Output: string;
    };
  };
}
export type TypesWithDefault = GiraphQLSchemaTypes.ExtendDefaultTypes<SchemaTypes>;

const builder = new SchemaBuilder<SchemaTypes>({});

export default builder;
