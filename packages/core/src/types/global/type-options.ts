/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  GraphQLResolveInfo,
  GraphQLScalarLiteralParser,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
} from 'graphql';
import {
  EnumValues,
  InputFieldMap,
  InterfaceFieldsShape,
  InterfaceParam,
  MutationFieldsShape,
  ObjectFieldsShape,
  ObjectParam,
  OutputShape,
  QueryFieldsShape,
  RootName,
  SchemaTypes,
  SubscriptionFieldsShape,
  ValidateInterfaces,
} from '../..';
import { MaybePromise } from '../utils';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface BaseTypeOptions<Types extends SchemaTypes = SchemaTypes> {
      description?: string;
      extensions?: Readonly<Record<string, unknown>>;
    }
    export interface EnumTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Values extends EnumValues<Types> = EnumValues<Types>
    > extends BaseTypeOptions<Types> {
      values: Values;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Shape = unknown>
      extends BaseTypeOptions<Types> {
      fields?: ObjectFieldsShape<Types, Shape>;
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
      Fields extends InputFieldMap = InputFieldMap
    > extends BaseTypeOptions<Types> {
      fields: (t: InputFieldBuilder<Types, 'InputObject'>) => Fields;
    }

    export interface InterfaceTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Shape = unknown,
      Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[]
    > extends BaseTypeOptions<Types> {
      fields?: InterfaceFieldsShape<Types, Shape>;
      interfaces?: Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[];
    }

    export interface UnionTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Member extends ObjectParam<Types> = ObjectParam<Types>
    > extends BaseTypeOptions<Types> {
      types: Member[];
      resolveType: (
        parent: OutputShape<Types, Member>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => MaybePromise<Member | null | undefined>;
    }

    export interface ScalarTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      ScalarInputShape = unknown,
      ScalarOutputShape = unknown
    > extends BaseTypeOptions<Types> {
      // Serializes an internal value to include in a response.
      serialize: GraphQLScalarSerializer<ScalarOutputShape>;
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
