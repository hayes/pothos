import type {
  FieldKind,
  FieldNullability,
  FieldRequiredness,
  InputFieldMap,
  InputFieldsFromShape,
  InputType,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import type { PothosZodPlugin } from '.';
import type { StandardSchemaV1 } from './standard-schema';
import type { ValidationPluginOptions } from './types';

declare module 'graphql' {
  interface GraphQLInputFieldExtensions {
    '@pothos/plugin-validation'?: {
      schemas?: StandardSchemaV1[];
      parentSchemas?: StandardSchemaV1[];
    };
  }

  interface GraphQLObjectTypeExtensions {
    '@pothos/plugin-validation'?: {
      schemas?: StandardSchemaV1[];
    };
  }

  interface GraphQLInputObjectTypeExtensions {
    '@pothos/plugin-validation'?: {
      schemas?: StandardSchemaV1[];
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: needs to match GraphQL types
  interface GraphQLFieldExtensions<_TSource, _TContext, _TArgs = any> {
    '@pothos/plugin-validation'?: {
      schemas?: StandardSchemaV1[];
    };
  }
}

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      validation: PothosZodPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      validation?: ValidationPluginOptions<Types>;
    }

    export interface FieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      validate?: StandardSchemaV1;
    }

    export interface InputObjectTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Fields extends InputFieldMap = InputFieldMap,
    > {
      validate?: StandardSchemaV1;
    }

    export interface InputFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > {
      validate?: StandardSchemaV1;
    }

    export interface InputObjectRef<Types extends SchemaTypes, T> {
      validate<R>(schema: StandardSchemaV1<unknown, R>): InputObjectRef<Types, R>;
    }

    export interface FieldRef<
      Types extends SchemaTypes,
      T = unknown,
      Kind extends FieldKind = FieldKind,
    > {
      validate<R>(schema: StandardSchemaV1<unknown, R>): FieldRef<Types, R, Kind>;
    }

    export interface InputFieldRef<Types extends SchemaTypes, T> {
      validate<R>(schema: StandardSchemaV1<unknown, R>): InputFieldRef<Types, R>;
    }

    export interface ArgumentRef<Types extends SchemaTypes, T> {
      validate<R>(schema: StandardSchemaV1<unknown, R>): ArgumentRef<Types, R>;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      validate<Args extends InputFieldMap, R>(
        args: Args,
        schema: StandardSchemaV1<unknown, R>,
      ): InputFieldsFromShape<Types, R, 'Arg'>;
    }
  }
}
