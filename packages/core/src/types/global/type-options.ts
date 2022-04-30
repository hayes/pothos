/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  GraphQLIsTypeOfFn,
  GraphQLResolveInfo,
  GraphQLScalarLiteralParser,
  GraphQLScalarValueParser,
  GraphQLUnionType,
} from 'graphql';
import {
  EnumValues,
  InputFieldMap,
  InterfaceFieldsShape,
  MutationFieldsShape,
  ObjectFieldsShape,
  QueryFieldsShape,
  SubscriptionFieldsShape,
  ValidateInterfaces,
} from '../builder-options';
import { RootName, SchemaTypes } from '../schema-types';
import type { InterfaceParam, ObjectParam, ParentShape } from '../type-params';
import { MaybePromise } from '../utils';

declare global {
  export namespace PothosSchemaTypes {
    export interface BaseTypeOptions<Types extends SchemaTypes = SchemaTypes> {
      description?: string;
      extensions?: Readonly<Record<string, unknown>>;
    }
    export interface EnumTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Values extends EnumValues<Types> = EnumValues<Types>,
    > extends BaseTypeOptions<Types> {
      values: Values;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Shape = unknown>
      extends BaseTypeOptions<Types> {
      fields?: ObjectFieldsShape<Types, Shape>;
      interfaces?: undefined;
      isTypeOf?: GraphQLIsTypeOfFn<unknown, Types['Context']>;
    }

    export interface ObjectTypeWithInterfaceOptions<
      Types extends SchemaTypes = SchemaTypes,
      Shape = unknown,
      Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[],
    > extends Omit<ObjectTypeOptions<Types, Shape>, 'interfaces'> {
      interfaces:
        | (() => Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[])
        | (Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[]);
    }
    export interface RootTypeOptions<Types extends SchemaTypes, Type extends RootName>
      extends BaseTypeOptions<Types> {}

    export interface QueryTypeOptions<Types extends SchemaTypes = SchemaTypes>
      extends RootTypeOptions<Types, 'Query'> {
      fields?: QueryFieldsShape<Types>;
    }

    export interface MutationTypeOptions<Types extends SchemaTypes = SchemaTypes>
      extends RootTypeOptions<Types, 'Mutation'> {
      fields?: MutationFieldsShape<Types>;
    }

    export interface SubscriptionTypeOptions<Types extends SchemaTypes = SchemaTypes>
      extends RootTypeOptions<Types, 'Subscription'> {
      fields?: SubscriptionFieldsShape<Types>;
    }

    export interface InputObjectTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Fields extends InputFieldMap = InputFieldMap,
    > extends BaseTypeOptions<Types> {
      fields: (t: InputFieldBuilder<Types, 'InputObject'>) => Fields;
    }

    export interface InterfaceTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Shape = unknown,
      Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[],
    > extends BaseTypeOptions<Types> {
      fields?: InterfaceFieldsShape<Types, Shape>;
      interfaces?:
        | (Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[])
        | (() => Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[]);
      resolveType?: (
        parent: Shape,
        context: Types['Context'],
        info: GraphQLResolveInfo,
        type: GraphQLUnionType,
      ) => MaybePromise<ObjectParam<Types> | string | null | undefined>;
    }

    export interface UnionTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Member extends ObjectParam<Types> = ObjectParam<Types>,
    > extends BaseTypeOptions<Types> {
      types: Member[];
      resolveType?: (
        parent: ParentShape<Types, Member>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
        type: GraphQLUnionType,
      ) => MaybePromise<Member | string | null | undefined>;
    }

    export interface ScalarTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      ScalarInputShape = unknown,
      ScalarOutputShape = unknown,
    > extends BaseTypeOptions<Types> {
      // Serializes an internal value to include in a response.
      serialize: (outputValue: ScalarOutputShape) => unknown;
      // Parses an externally provided value to use as an input.
      parseValue?: GraphQLScalarValueParser<ScalarInputShape>;
      // Parses an externally provided literal value to use as an input.
      parseLiteral?: GraphQLScalarLiteralParser<ScalarInputShape>;
    }

    export interface EnumValueConfig<Types extends SchemaTypes> {
      description?: string;
      value?: number | string;
      deprecationReason?: string;
      extensions?: Readonly<Record<string, unknown>>;
    }
  }
}
