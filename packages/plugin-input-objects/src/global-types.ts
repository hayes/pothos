import { FieldNullability, InputFieldMap, SchemaTypes, TypeParam } from '@giraphql/core';
import { QueryFieldWithInputOptions, WithInputOptions } from './types';
import { GiraphQLInputObjectsPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      inputObjects: GiraphQLInputObjectsPlugin<Types>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      withInput: <Fields extends InputFieldMap, InputName extends string = 'input'>(
        options: WithInputOptions<Types, Fields, InputName>,
      ) => {
        queryField: <
          Type extends TypeParam<Types>,
          Nullable extends FieldNullability<Type>,
          ResolveReturnShape,
        >(
          name: string,
          options: QueryFieldWithInputOptions<
            Types,
            Fields,
            Type,
            Nullable,
            InputName,
            ResolveReturnShape
          >,
        ) => void;
      };
    }
  }
}
