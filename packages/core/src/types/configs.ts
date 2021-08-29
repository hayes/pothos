import {
  GraphQLEnumType,
  GraphQLEnumTypeConfig,
  GraphQLEnumValueConfig,
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
  GraphQLInputObjectType,
  GraphQLInputObjectTypeConfig,
  GraphQLInterfaceType,
  GraphQLInterfaceTypeConfig,
  GraphQLObjectType,
  GraphQLObjectTypeConfig,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
  GraphQLUnionType,
  GraphQLUnionTypeConfig,
} from 'graphql';
import { Merge } from './utils';

import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  FieldRequiredness,
  InputFieldMap,
  InputType,
  InputTypeParam,
  ObjectParam,
  OutputType,
  SchemaTypes,
  TypeParam,
} from '..';

export interface GiraphQLQueryTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Query';
  graphqlKind: 'Object';
  giraphqlOptions: GiraphQLSchemaTypes.QueryTypeOptions;
}
export interface GiraphQLMutationTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Mutation';
  graphqlKind: 'Object';
  giraphqlOptions: GiraphQLSchemaTypes.MutationTypeOptions;
}

export interface GiraphQLSubscriptionTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Subscription';
  graphqlKind: 'Object';
  giraphqlOptions: GiraphQLSchemaTypes.SubscriptionTypeOptions;
}

export interface GiraphQLObjectTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Object';
  graphqlKind: 'Object';
  interfaces: ObjectParam<SchemaTypes>[];
  giraphqlOptions: GiraphQLSchemaTypes.ObjectTypeOptions;
}

export interface GiraphQLInterfaceTypeConfig
  extends Omit<GraphQLInterfaceTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Interface';
  graphqlKind: 'Interface';
  interfaces: ObjectParam<SchemaTypes>[];
  giraphqlOptions: GiraphQLSchemaTypes.InterfaceTypeOptions;
}

export interface GiraphQLUnionTypeConfig
  extends Omit<GraphQLUnionTypeConfig<unknown, object>, 'types'> {
  kind: 'Union';
  graphqlKind: 'Union';
  types: ObjectParam<SchemaTypes>[];
  giraphqlOptions: GiraphQLSchemaTypes.UnionTypeOptions;
}

export interface GiraphQLEnumTypeConfig extends GraphQLEnumTypeConfig {
  kind: 'Enum';
  graphqlKind: 'Enum';
  giraphqlOptions: GiraphQLSchemaTypes.EnumTypeOptions;
}

export interface GiraphQLScalarTypeConfig extends GraphQLScalarTypeConfig<unknown, unknown> {
  kind: 'Scalar';
  graphqlKind: 'Scalar';
  giraphqlOptions: GiraphQLSchemaTypes.ScalarTypeOptions;
}

export interface GiraphQLInputObjectTypeConfig
  extends Omit<GraphQLInputObjectTypeConfig, 'fields'> {
  kind: 'InputObject';
  graphqlKind: 'InputObject';
  giraphqlOptions: GiraphQLSchemaTypes.InputObjectTypeOptions;
}

export type GiraphQLTypeConfig =
  | GiraphQLEnumTypeConfig
  | GiraphQLInputObjectTypeConfig
  | GiraphQLInterfaceTypeConfig
  | GiraphQLMutationTypeConfig
  | GiraphQLObjectTypeConfig
  | GiraphQLQueryTypeConfig
  | GiraphQLScalarTypeConfig
  | GiraphQLSubscriptionTypeConfig
  | GiraphQLUnionTypeConfig;

export type GiraphQLTypeKind = GiraphQLTypeConfig['kind'];

export type GiraphQLKindToGraphQLTypeClass<T extends GiraphQLTypeKind> = {
  Object: GraphQLObjectType;
  Interface: GraphQLInterfaceType;
  Union: GraphQLUnionType;
  Enum: GraphQLEnumType;
  Scalar: GraphQLScalarType;
  InputObject: GraphQLInputObjectType;
}[GiraphQLSchemaTypes.GiraphQLKindToGraphQLType[T]];

export type GiraphQLFieldKindToConfig<Types extends SchemaTypes, Kind extends FieldKind> = {
  [K in FieldKind]: Merge<
    Omit<GraphQLFieldConfig<unknown, object>, 'args' | 'type'> & {
      kind: K;
      graphqlKind: GiraphQLSchemaTypes.GiraphQLKindToGraphQLType[K];
      parentType: string;
      name: string;
      type: GiraphQLOutputFieldType<Types>;
      args: Record<string, GiraphQLInputFieldConfig<Types>>;
      giraphqlOptions: FieldOptionsFromKind<
        Types,
        unknown,
        TypeParam<Types>,
        FieldNullability<[unknown]>,
        InputFieldMap,
        K,
        unknown,
        unknown
      >;
    }
  >;
}[Kind];

export interface GiraphQLInputFieldConfig<Types extends SchemaTypes>
  extends Omit<GraphQLInputFieldConfig, 'type'> {
  kind: 'Arg' | 'InputObject';
  graphqlKind: 'Arg' | 'InputObject';
  name: string;
  parentField: string | undefined;
  parentType: string;
  type: GiraphQLInputFieldType<Types>;
  giraphqlOptions: GiraphQLSchemaTypes.InputFieldOptionsByKind<
    Types,
    InputTypeParam<Types>,
    FieldRequiredness<[unknown]>
  >[keyof GiraphQLSchemaTypes.InputFieldOptionsByKind];
}

export interface GiraphQLEnumValueConfig<Types extends SchemaTypes> extends GraphQLEnumValueConfig {
  giraphqlOptions: GiraphQLSchemaTypes.EnumValueConfig<Types>;
}

export type GiraphQLOutputFieldConfig<Types extends SchemaTypes> = GiraphQLFieldKindToConfig<
  Types,
  FieldKind
>;

export type GiraphQLFieldConfig<Types extends SchemaTypes> =
  | GiraphQLInputFieldConfig<Types>
  | GiraphQLOutputFieldConfig<Types>;

export type GraphQLFieldKind = GiraphQLFieldConfig<SchemaTypes>['graphqlKind'];

export type GiraphQLOutputFieldType<Types extends SchemaTypes> =
  | {
      kind: 'Enum' | 'Interface' | 'Object' | 'Scalar' | 'Union';
      ref: OutputType<Types>;
      nullable: boolean;
    }
  | {
      kind: 'List';
      type: GiraphQLNameOutputFieldType<Types>;
      nullable: boolean;
    };
export type GiraphQLNameOutputFieldType<Types extends SchemaTypes> = Exclude<
  GiraphQLOutputFieldType<Types>,
  { kind: 'List' }
>;

export type GiraphQLInputFieldType<Types extends SchemaTypes> =
  | {
      kind: 'Enum' | 'InputObject' | 'Scalar';
      ref: InputType<Types>;
      required: boolean;
    }
  | {
      kind: 'List';
      type: GiraphQLNameInputFieldType<Types>;
      required: boolean;
    };

export type GiraphQLNameInputFieldType<Types extends SchemaTypes> = Exclude<
  GiraphQLInputFieldType<Types>,
  { kind: 'List' }
>;
