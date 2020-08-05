/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  GraphQLResolveInfo,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
  GraphQLScalarLiteralParser,
} from 'graphql';
import {
  EnumValues,
  SchemaTypes,
  ObjectFieldsShape,
  InterfaceParam,
  ValidateInterfaces,
  OutputShape,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  InputFieldMap,
  InterfaceFieldsShape,
  ObjectParam,
  RootName,
} from '../..';
import { MaybePromise } from '../utils';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface EnumTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Values extends EnumValues = EnumValues
    > {
      description?: string;
      values: Values;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Shape = unknown> {
      description?: string;
      fields?: ObjectFieldsShape<Types, Shape>;
      extensions?: Readonly<Record<string, unknown>>;
      interfaces?: undefined;
      isTypeOf?: undefined;
    }

    export interface ObjectTypeWithInterfaceOptions<
      Types extends SchemaTypes = SchemaTypes,
      Shape = unknown,
      Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[]
    > extends Omit<ObjectTypeOptions<Types, Shape>, 'interfaces' | 'isTypeOf'> {
      interfaces: Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[];
      isTypeOf: (
        obj: OutputShape<Types, Interfaces[number]>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => boolean;
    }

    export interface RootTypeOptions<Types extends SchemaTypes, Type extends RootName> {
      description?: string;
      extensions?: Readonly<Record<string, unknown>>;
    }

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
      Fields extends InputFieldMap = InputFieldMap
    > {
      description?: string;
      fields: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types, 'InputObject'>) => Fields;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface InterfaceTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Shape = unknown,
      Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[]
    > {
      description?: string;
      fields?: InterfaceFieldsShape<Types, Shape>;
      interfaces?: Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[];
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface UnionTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Member extends ObjectParam<Types> = ObjectParam<Types>
    > {
      description?: string;
      types: Member[];
      resolveType: (
        parent: OutputShape<Types, Member>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => MaybePromise<Member | null | undefined>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ScalarTypeOptions<InputShape = unknown, OutputShape = unknown> {
      description?: string;
      // Serializes an internal value to include in a response.
      serialize: GraphQLScalarSerializer<OutputShape>;
      // Parses an externally provided value to use as an input.
      parseValue?: GraphQLScalarValueParser<InputShape>;
      // Parses an externally provided literal value to use as an input.
      parseLiteral?: GraphQLScalarLiteralParser<InputShape>;
      extensions?: Readonly<Record<string, unknown>>;
    }
  }
}
