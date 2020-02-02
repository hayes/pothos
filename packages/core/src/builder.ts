import { GraphQLSchema, GraphQLScalarType, GraphQLDirective } from 'graphql';
import {
  ImplementedType,
  EnumValues,
  InputFields,
  InputShapeFromFields,
  ObjectName,
  InterfaceName,
  ScalarName,
  FieldsShape,
  RootFieldsShape,
  ResolverMap,
  ShapeFromTypeParam,
  CompatibleInterfaceParam,
  TypeParam,
  RootName,
} from './types';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import InputFieldBuilder from './fieldUtils/input';
import BasePlugin from './plugin';
import BuildCache from './build-cache';
import RootType from './graphql/root';
import FieldSet from './graphql/field-set';
import RootFieldSet from './graphql/root-field-set';

export default class SchemaBuilder<Types extends GiraphQLSchemaTypes.TypeInfo> {
  private plugins: BasePlugin[];

  private types: ImplementedType[] = [];

  private fields: (FieldSet<Types, TypeParam<Types>> | RootFieldSet<Types>)[] = [];

  private stateful: boolean;

  constructor(options: { plugins?: BasePlugin[]; stateful?: boolean } = {}) {
    this.plugins = options.plugins ?? [];
    this.stateful = options.stateful ?? false;
  }

  objectType<
    Interfaces extends CompatibleInterfaceParam<Types, ShapeFromTypeParam<Types, Type, false>>[],
    Type extends ObjectName<Types>
  >(
    name: Type,
    options:
      | GiraphQLSchemaTypes.ObjectTypeOptions<Types, ShapeFromTypeParam<Types, Type, false>>
      | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<
          Types,
          ShapeFromTypeParam<Types, Type, false>,
          Interfaces
        >,
  ) {
    return this.addType(
      new ObjectType<Types>(
        name,
        options as GiraphQLSchemaTypes.ObjectTypeOptions<
          Types,
          ShapeFromTypeParam<Types, Type, false>
        >,
      ),
    );
  }

  objectFields<Type extends ObjectName<Types>>(
    name: Type,
    shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>, 'Object'>,
  ) {
    return this.addFields(new FieldSet<Types, Type>(name, shape));
  }

  queryType(options: GiraphQLSchemaTypes.QueryTypeOptions<Types>) {
    return this.addType(new RootType<Types, 'Query'>('Query', options));
  }

  queryFields(shape: RootFieldsShape<Types, 'Query'>) {
    return this.addFields(new RootFieldSet('Query', shape));
  }

  mutationType(options: GiraphQLSchemaTypes.MutationTypeOptions<Types>) {
    return this.addType(new RootType<Types, 'Mutation'>('Mutation', options));
  }

  mutationFields(shape: RootFieldsShape<Types, 'Mutation'>) {
    return this.addFields(new RootFieldSet('Mutation', shape));
  }

  subscriptionType(options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>) {
    return this.addType(new RootType<Types, 'Subscription'>('Subscription', options));
  }

  subscriptionFields(shape: RootFieldsShape<Types, 'Subscription'>) {
    return this.addFields(new RootFieldSet('Subscription', shape));
  }

  args<Shape extends InputFields<Types>>(shape: (t: InputFieldBuilder<Types>) => Shape) {
    return shape(new InputFieldBuilder<Types>());
  }

  interfaceType<Type extends InterfaceName<Types>>(
    name: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<
      Types,
      ShapeFromTypeParam<Types, Type, false>
    >,
  ) {
    return this.addType(new InterfaceType<Types, Type>(name, options));
  }

  interfaceFields<Type extends InterfaceName<Types>>(
    name: Type,
    shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>, 'Interface'>,
  ) {
    return this.addFields(new FieldSet(name, shape));
  }

  unionType<Member extends ObjectName<Types>, Name extends string>(
    name: Name,
    options: GiraphQLSchemaTypes.UnionOptions<Types, Member>,
  ) {
    return this.addType(new UnionType<Types, Member>(name, options));
  }

  enumType<Name extends string, Values extends EnumValues>(
    name: Name,
    options: GiraphQLSchemaTypes.EnumTypeOptions<Values>,
  ) {
    return this.addType(new EnumType(name, options));
  }

  scalarType<Name extends ScalarName<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.ScalarOptions<
      Types['Scalar'][Name]['Input'],
      Types['Scalar'][Name]['Output']
    >,
  ) {
    return this.addType(
      new ScalarType<Types['Scalar'][Name]['Input'], Types['Scalar'][Name]['Output']>(
        name,
        options,
      ),
    );
  }

  addScalarType<Name extends ScalarName<Types>>(name: Name, scalar: GraphQLScalarType) {
    return this.addType(
      new ScalarType<Types['Scalar'][Name]['Input'], Types['Scalar'][Name]['Output']>(name, {
        name,
        description: scalar.description ?? undefined,
        serialize: scalar.serialize,
        parseLiteral: scalar.parseLiteral,
        parseValue: scalar.parseValue,
        extensions: scalar.extensions ?? undefined,
      }),
    );
  }

  inputType<Name extends string, Fields extends InputFields<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
  ) {
    return this.addType(
      new InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>(
        name,
        options,
      ),
    );
  }

  // Temporarily alias old names for compatibility
  createQueryType = this.queryType;

  createMutationType = this.mutationType;

  createSubscriptionType = this.subscriptionType;

  createObjectType = this.objectType;

  createInterfaceType = this.interfaceType;

  createQueryFields = this.queryFields;

  createMutationFields = this.mutationFields;

  createSubscriptionFields = this.subscriptionFields;

  createObjectFields = this.objectFields;

  createInterfaceFields = this.interfaceFields;

  createUnionType = this.unionType;

  createEnumType = this.enumType;

  createScalarType = this.addScalarType;

  createInputType = this.inputType;

  createArgs = this.args;

  toSchema(
    types?: ImplementedType[],
    {
      fieldDefinitions,
      directives,
      extensions,
      mocks,
    }: {
      directives?: readonly GraphQLDirective[];
      extensions?: Record<string, unknown>;
      fieldDefinitions?: (FieldSet<Types, TypeParam<Types>> | RootFieldSet<Types, RootName>)[];
      mocks?: ResolverMap;
    } = {},
  ) {
    const buildCache = new BuildCache([...this.types, ...(types ?? [])], {
      plugins: this.plugins,
      fieldDefinitions: [...this.fields, ...(fieldDefinitions ?? [])],
      mocks,
    });

    buildCache.buildAll();

    const builtTypes = [...buildCache.types.values()].map(entry => entry.built);

    const schema = new GraphQLSchema({
      query: buildCache.has('Query') ? buildCache.getEntryOfType('Query', 'Root').built : undefined,
      mutation: buildCache.has('Mutation')
        ? buildCache.getEntryOfType('Mutation', 'Root').built
        : undefined,
      subscription: buildCache.has('Subscription')
        ? buildCache.getEntryOfType('Subscription', 'Root').built
        : undefined,
      extensions,
      directives: directives as GraphQLDirective[],
      types: builtTypes,
    });

    return schema;
  }

  private addType<T extends ImplementedType>(type: T) {
    if (this.stateful) {
      this.types.push(type);
    }

    return type;
  }

  private addFields<T extends FieldSet<Types, TypeParam<Types>> | RootFieldSet<Types>>(fields: T) {
    if (this.stateful) {
      this.fields.push(fields);
    }

    return fields;
  }
}
